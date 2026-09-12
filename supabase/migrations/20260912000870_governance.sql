-- ============================================================================
-- Samudaya · 0870 · Community voice: polls, fund reallocation, suggestions
-- ----------------------------------------------------------------------------
-- The committee proposes; the community decides. Money that residents gave for
-- one purpose cannot be moved to another on an admin's say-so — it takes a
-- vote that clears a threshold, and the outcome is written down.
-- ============================================================================

create table public.polls (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  event_id      uuid references public.events (id) on delete cascade,
  question      text not null,
  detail        text,
  status        public.proposal_status not null default 'voting',
  closes_at     timestamptz,
  created_by    uuid references public.memberships (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint polls_question_not_blank check (length(btrim(question)) > 0)
);

create index polls_community_idx on public.polls (community_id, created_at desc);

create trigger polls_touch_updated_at
  before update on public.polls
  for each row execute function app.touch_updated_at();

-- Options rather than a yes/no column. The prototype only asks yes/no
-- questions, but "which date suits you?" is one poll away and would otherwise
-- mean rebuilding this table and everything reading it.
create table public.poll_options (
  id        uuid primary key default extensions.gen_random_uuid(),
  poll_id   uuid not null references public.polls (id) on delete cascade,
  label     text not null,
  emoji     text,
  position  integer not null default 0,
  constraint poll_options_label_not_blank check (length(btrim(label)) > 0)
);

create index poll_options_poll_idx on public.poll_options (poll_id, position);

create table public.poll_votes (
  id            uuid primary key default extensions.gen_random_uuid(),
  poll_id       uuid not null references public.polls (id) on delete cascade,
  option_id     uuid not null references public.poll_options (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  channel       public.origin_channel not null default 'web',
  voted_at      timestamptz not null default now(),
  -- One vote per member per poll, enforced here rather than in the app: a
  -- double-tap or a retried request must not become two votes.
  constraint poll_votes_one_per_member unique (poll_id, membership_id)
);

create index poll_votes_option_idx on public.poll_votes (option_id);

-- Results are public; who voted for what is not.
create view public.poll_results
with (security_invoker = false) as
select o.poll_id, o.id as option_id, o.label, o.emoji, o.position,
       count(v.id)::integer as votes,
       (select count(*) from public.poll_votes v2 where v2.poll_id = o.poll_id)::integer as total_votes
  from public.poll_options o
  left join public.poll_votes v on v.option_id = o.id
  join public.polls p on p.id = o.poll_id
 where app.is_member(p.community_id)
 group by o.poll_id, o.id, o.label, o.emoji, o.position;

grant select on public.poll_results to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fund reallocation
-- ---------------------------------------------------------------------------
create table public.fund_reallocations (
  id             uuid primary key default extensions.gen_random_uuid(),
  community_id   uuid not null references public.communities (id) on delete cascade,
  from_event_id  uuid not null references public.events (id) on delete cascade,
  -- Either to another event, or to a named destination such as the general
  -- fund. Exactly one of the two.
  to_event_id    uuid references public.events (id) on delete set null,
  to_label       text,
  amount         numeric(12, 2) not null,
  reason         text not null,
  -- Share of eligible members who must approve. Stored per proposal so a
  -- community can require more for a larger sum.
  threshold_pct  integer not null default 60,
  status         public.proposal_status not null default 'voting',
  closes_at      timestamptz,
  resolved_at    timestamptz,
  created_by     uuid references public.memberships (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint fund_reallocations_amount_positive check (amount > 0),
  constraint fund_reallocations_reason_not_blank check (length(btrim(reason)) > 0),
  constraint fund_reallocations_threshold check (threshold_pct between 1 and 100),
  constraint fund_reallocations_destination
    check (num_nonnulls(to_event_id, to_label) = 1),
  constraint fund_reallocations_not_circular
    check (to_event_id is null or to_event_id <> from_event_id)
);

create index fund_reallocations_community_idx
  on public.fund_reallocations (community_id, status, created_at desc);

create trigger fund_reallocations_touch_updated_at
  before update on public.fund_reallocations
  for each row execute function app.touch_updated_at();

create table public.reallocation_votes (
  id              uuid primary key default extensions.gen_random_uuid(),
  reallocation_id uuid not null references public.fund_reallocations (id) on delete cascade,
  membership_id   uuid not null references public.memberships (id) on delete cascade,
  approve         boolean not null,
  channel         public.origin_channel not null default 'web',
  voted_at        timestamptz not null default now(),
  constraint reallocation_votes_one_per_member unique (reallocation_id, membership_id)
);

create view public.reallocation_results
with (security_invoker = false) as
select r.id as reallocation_id,
       r.community_id,
       count(v.id) filter (where v.approve)::integer      as approve_votes,
       count(v.id) filter (where not v.approve)::integer  as reject_votes,
       count(v.id)::integer                                as total_votes,
       (select count(*) from public.memberships m
         where m.community_id = r.community_id and m.status = 'active')::integer as eligible,
       r.threshold_pct
  from public.fund_reallocations r
  left join public.reallocation_votes v on v.reallocation_id = r.id
 where app.is_member(r.community_id)
 group by r.id, r.community_id, r.threshold_pct;

grant select on public.reallocation_results to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Casting a vote, and resolving the proposal when it clears
-- ---------------------------------------------------------------------------
-- One function so the tally and the threshold check happen in the same
-- transaction as the vote. Deciding the outcome in application code would let
-- two simultaneous votes both read a pre-threshold tally and neither resolve.
create or replace function public.vote_on_reallocation(
  p_reallocation_id uuid,
  p_approve         boolean,
  p_channel         public.origin_channel default 'web'
)
returns table (
  status        text,
  approve_votes integer,
  reject_votes  integer,
  eligible      integer,
  resolved      boolean,
  approved      boolean
)
language plpgsql
security definer
set search_path = ''
as $$
-- Returns a column called `status`, which would otherwise shadow
-- memberships.status when counting eligible voters.
#variable_conflict use_column
declare
  v_row public.fund_reallocations;
  v_membership uuid;
  v_approve integer;
  v_reject integer;
  v_eligible integer;
  v_resolved boolean := false;
  v_approved boolean := false;
begin
  select * into v_row
    from public.fund_reallocations r
   where r.id = p_reallocation_id
   for update;

  if v_row.id is null then
    return query select 'not_found'::text, 0, 0, 0, false, false;
    return;
  end if;

  v_membership := app.my_membership_id(v_row.community_id);
  if v_membership is null then
    return query select 'not_a_member'::text, 0, 0, 0, false, false;
    return;
  end if;

  if v_row.status <> 'voting' then
    return query select 'already_resolved'::text, 0, 0, 0, true,
                        (v_row.status = 'approved');
    return;
  end if;

  -- Changing your mind is allowed while the vote is open; voting twice is not.
  insert into public.reallocation_votes (reallocation_id, membership_id, approve, channel)
  values (p_reallocation_id, v_membership, p_approve, p_channel)
  on conflict on constraint reallocation_votes_one_per_member
  do update set approve = excluded.approve, voted_at = now();

  select count(*) filter (where approve), count(*) filter (where not approve)
    into v_approve, v_reject
    from public.reallocation_votes where reallocation_id = p_reallocation_id;

  select count(*) into v_eligible
    from public.memberships
   where community_id = v_row.community_id and status = 'active';

  if v_eligible > 0 then
    if (v_approve::numeric / v_eligible) * 100 >= v_row.threshold_pct then
      v_resolved := true; v_approved := true;
    -- Once enough members have refused that approval can no longer be reached,
    -- the proposal is dead; leaving it open just collects pointless votes.
    elsif ((v_eligible - v_reject)::numeric / v_eligible) * 100 < v_row.threshold_pct then
      v_resolved := true; v_approved := false;
    end if;
  end if;

  if v_resolved then
    update public.fund_reallocations
       set status = (case when v_approved then 'approved' else 'rejected' end)::public.proposal_status,
           resolved_at = now()
     where id = p_reallocation_id;

    if v_approved then
      insert into public.audit_logs (community_id, actor_user_id, action, entity_type, entity_id, channel, metadata)
      values (
        v_row.community_id, (select auth.uid()), 'fund_reallocation.approved',
        'fund_reallocation', v_row.id, p_channel,
        jsonb_build_object(
          'amount', v_row.amount,
          'from_event_id', v_row.from_event_id,
          'to_event_id', v_row.to_event_id,
          'to_label', v_row.to_label,
          'approve_votes', v_approve,
          'eligible', v_eligible
        )
      );
    end if;
  end if;

  return query select 'ok'::text, v_approve, v_reject, v_eligible, v_resolved, v_approved;
end;
$$;

grant execute on function public.vote_on_reallocation(uuid, boolean, public.origin_channel)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Activity suggestions
-- ---------------------------------------------------------------------------
create table public.activity_suggestions (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  event_id      uuid references public.events (id) on delete set null,
  name          text not null,
  description   text,
  expected_participants integer,
  wants_to_coordinate boolean not null default false,
  status        public.suggestion_status not null default 'new',
  suggested_by  uuid references public.memberships (id) on delete set null,
  review_note   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint activity_suggestions_name_not_blank check (length(btrim(name)) > 0)
);

create index activity_suggestions_community_idx
  on public.activity_suggestions (community_id, status, created_at desc);

create trigger activity_suggestions_touch_updated_at
  before update on public.activity_suggestions
  for each row execute function app.touch_updated_at();

-- "23 interested" on a feed card is what tells the committee a suggestion is
-- worth acting on.
create table public.suggestion_interests (
  suggestion_id uuid not null references public.activity_suggestions (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (suggestion_id, membership_id)
);

create view public.suggestion_stats
with (security_invoker = false) as
select s.id as suggestion_id, s.community_id, count(i.membership_id)::integer as interested
  from public.activity_suggestions s
  left join public.suggestion_interests i on i.suggestion_id = s.id
 where app.is_member(s.community_id)
 group by s.id, s.community_id;

grant select on public.suggestion_stats to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.polls                 enable row level security;
alter table public.poll_options          enable row level security;
alter table public.poll_votes            enable row level security;
alter table public.fund_reallocations    enable row level security;
alter table public.reallocation_votes    enable row level security;
alter table public.activity_suggestions  enable row level security;
alter table public.suggestion_interests  enable row level security;

create policy polls_select_member
  on public.polls for select to authenticated
  using (app.is_member(community_id));

create policy polls_write_committee
  on public.polls for all to authenticated
  using (app.is_committee(community_id))
  with check (app.is_committee(community_id));

create policy poll_options_select_member
  on public.poll_options for select to authenticated
  using (
    exists (select 1 from public.polls p where p.id = poll_options.poll_id and app.is_member(p.community_id))
  );

create policy poll_options_write_committee
  on public.poll_options for all to authenticated
  using (
    exists (select 1 from public.polls p where p.id = poll_options.poll_id and app.is_committee(p.community_id))
  )
  with check (
    exists (select 1 from public.polls p where p.id = poll_options.poll_id and app.is_committee(p.community_id))
  );

-- A ballot is secret: you can read your own vote and nobody else's. Totals
-- come from poll_results.
create policy poll_votes_select_own
  on public.poll_votes for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
       where m.id = poll_votes.membership_id and m.user_id = (select auth.uid())
    )
  );

create policy poll_votes_cast_own
  on public.poll_votes for insert to authenticated
  with check (
    exists (
      select 1 from public.polls p
       where p.id = poll_votes.poll_id
         and p.status = 'voting'
         and (p.closes_at is null or p.closes_at > now())
         and poll_votes.membership_id = app.my_membership_id(p.community_id)
    )
  );

create policy poll_votes_change_own
  on public.poll_votes for update to authenticated
  using (
    exists (
      select 1 from public.polls p
       where p.id = poll_votes.poll_id
         and p.status = 'voting'
         and poll_votes.membership_id = app.my_membership_id(p.community_id)
    )
  )
  with check (
    exists (
      select 1 from public.polls p
       where p.id = poll_votes.poll_id
         and poll_votes.membership_id = app.my_membership_id(p.community_id)
    )
  );

create policy fund_reallocations_select_member
  on public.fund_reallocations for select to authenticated
  using (app.is_member(community_id));

-- Only an admin may propose moving money, and only through this table; the
-- outcome is decided by vote_on_reallocation, not by editing the status.
create policy fund_reallocations_insert_admin
  on public.fund_reallocations for insert to authenticated
  with check (app.is_admin(community_id) and status = 'voting');

create policy fund_reallocations_withdraw_admin
  on public.fund_reallocations for update to authenticated
  using (app.is_admin(community_id) and status = 'voting')
  with check (app.is_admin(community_id) and status in ('voting', 'withdrawn'));

create policy reallocation_votes_select_own
  on public.reallocation_votes for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
       where m.id = reallocation_votes.membership_id and m.user_id = (select auth.uid())
    )
  );

-- Votes are written by vote_on_reallocation, which also tallies them. No
-- insert policy: a direct write would skip the threshold check.

create policy activity_suggestions_select_member
  on public.activity_suggestions for select to authenticated
  using (app.is_member(community_id));

create policy activity_suggestions_insert_member
  on public.activity_suggestions for insert to authenticated
  with check (
    app.is_member(community_id)
    and suggested_by = app.my_membership_id(community_id)
    and status = 'new'
  );

create policy activity_suggestions_update_committee
  on public.activity_suggestions for update to authenticated
  using (app.is_committee(community_id))
  with check (app.is_committee(community_id));

create policy suggestion_interests_select_member
  on public.suggestion_interests for select to authenticated
  using (
    exists (
      select 1 from public.activity_suggestions s
       where s.id = suggestion_interests.suggestion_id and app.is_member(s.community_id)
    )
  );

create policy suggestion_interests_toggle_own
  on public.suggestion_interests for all to authenticated
  using (
    exists (
      select 1 from public.activity_suggestions s
       where s.id = suggestion_interests.suggestion_id
         and suggestion_interests.membership_id = app.my_membership_id(s.community_id)
    )
  )
  with check (
    exists (
      select 1 from public.activity_suggestions s
       where s.id = suggestion_interests.suggestion_id
         and suggestion_interests.membership_id = app.my_membership_id(s.community_id)
    )
  );
