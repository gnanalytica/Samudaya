-- ============================================================================
-- Samudaya · 20260913000300 · Three roles, campaigns, budgets and suggestion votes
-- ----------------------------------------------------------------------------
-- The pilot runs on three roles:
--
--   resident   views events, contributes, suggests, votes, proposes campaigns
--   staff      operator only: bills, join requests, removing residents,
--              creating and running events, seeing who paid what
--   committee  everything, including approving or rejecting bills,
--              campaigns and suggestions
--
-- Communities are created by the platform team, not by users; residents join
-- with the society code and wait for staff or committee to admit them.
--
-- Role migration, done with enum renames so every policy keeps pointing at the
-- right value: old 'committee' becomes 'staff', old 'owner' (and 'admin') become
-- 'committee'. The retired 'admin' label cannot be dropped from the enum, so a
-- check constraint keeps it unused.
--
-- Helper functions are renamed the same way: policies that used
-- app.is_committee (event operators) now call app.is_staff, and policies that
-- used app.is_admin now call app.is_committee. app.is_admin remains as an alias
-- for function bodies that still call it by name.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

update public.memberships set role = 'owner' where role = 'admin';
update public.invite_codes set role = 'resident' where role in ('admin', 'committee');

alter type public.member_role rename value 'committee' to 'staff';
alter type public.member_role rename value 'owner' to 'committee';

alter table public.memberships
  add constraint memberships_role_not_retired check (role <> 'admin');

create or replace function app.role_rank(p_role public.member_role)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'resident'  then 10
    when 'staff'     then 20
    when 'admin'     then 30  -- retired; kept so old rows could never outrank committee
    when 'committee' then 40
  end;
$$;

alter function app.is_committee(uuid) rename to is_staff;
alter function app.is_admin(uuid) rename to is_committee;

-- Staff or committee: the people who run the society day to day.
create or replace function app.is_staff(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_role_at_least(p_community, 'staff');
$$;

-- The committee: final say on money, campaigns and suggestions.
create or replace function app.is_committee(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_role_at_least(p_community, 'committee');
$$;

-- Alias for function bodies written before the rename.
create or replace function app.is_admin(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_committee(p_community);
$$;

-- Residents and committee members take part (contribute, vote, suggest,
-- register). Staff are operators and do not.
create or replace function app.can_participate(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.member_role_in(p_community) in ('resident', 'committee'), false);
$$;

grant execute on function app.is_staff(uuid) to authenticated, service_role;
grant execute on function app.is_committee(uuid) to authenticated, service_role;
grant execute on function app.is_admin(uuid) to authenticated, service_role;
grant execute on function app.can_participate(uuid) to authenticated, service_role;

create or replace function app.audience_matches(
  p_audience public.announcement_audience,
  p_role     public.member_role
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_audience
    when 'all'       then true
    when 'residents' then true
    when 'committee' then p_role in ('staff', 'committee')
  end;
$$;

-- ---------------------------------------------------------------------------
-- Communities are created by the platform team
-- ---------------------------------------------------------------------------

drop policy if exists communities_insert_authenticated on public.communities;

create or replace function app.seed_community_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.memberships (community_id, user_id, role, status)
    values (new.id, new.created_by, 'committee', 'active')
    on conflict (community_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Memberships: staff may remove residents; only committee changes roles
-- ---------------------------------------------------------------------------

create policy memberships_update_resident_by_staff
  on public.memberships for update to authenticated
  using (app.is_staff(community_id) and role = 'resident')
  with check (app.is_staff(community_id) and role = 'resident');

create policy memberships_delete_resident_by_staff
  on public.memberships for delete to authenticated
  using (app.is_staff(community_id) and role = 'resident');

create or replace function app.guard_membership_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_committee_count integer;
begin
  if current_setting('role', true) = 'service_role' or app.is_platform_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' then
    if old.user_id = v_actor
       and new.role is distinct from old.role
       and app.role_rank(new.role) > app.role_rank(old.role) then
      raise exception 'You cannot raise your own role'
        using errcode = '42501';
    end if;

    if new.role is distinct from old.role
       and not app.is_committee(new.community_id) then
      raise exception 'Only the committee can change roles'
        using errcode = '42501';
    end if;
  end if;

  if (tg_op = 'DELETE' and old.role = 'committee')
     or (tg_op = 'UPDATE' and old.role = 'committee'
         and (new.role <> 'committee' or new.status <> 'active')) then
    select count(*) into v_committee_count
      from public.memberships
     where community_id = old.community_id
       and role = 'committee'
       and status = 'active';
    if v_committee_count <= 1 then
      raise exception 'A community must keep at least one committee member'
        using errcode = '23514';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Joining: one society code, admitted by staff or committee
-- ---------------------------------------------------------------------------

drop policy if exists join_requests_select_self_or_admin on public.join_requests;
create policy join_requests_select_self_or_staff
  on public.join_requests for select to authenticated
  using (user_id = (select auth.uid()) or app.is_staff(community_id));

create or replace function public.review_join_request(
  p_request_id uuid,
  p_approve    boolean,
  p_role       public.member_role default 'resident',
  p_reason     text default null
)
returns public.join_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.join_requests;
  v_membership public.memberships;
begin
  select * into v_row from public.join_requests r where r.id = p_request_id for update;
  if v_row.id is null then
    raise exception 'No such request' using errcode = 'P0002';
  end if;

  if not app.is_staff(v_row.community_id) then
    raise exception 'Only staff or the committee can review join requests'
      using errcode = '42501';
  end if;

  if v_row.status <> 'pending' then
    return v_row;  -- already decided; treat a repeat click as a no-op
  end if;

  if p_role <> 'resident' and not app.is_committee(v_row.community_id) then
    raise exception 'Only the committee can admit someone as staff or committee'
      using errcode = '42501';
  end if;

  if p_role in ('committee', 'admin') then
    raise exception 'Committee access is set by the committee, not granted from a join request'
      using errcode = '42501';
  end if;

  if p_approve then
    insert into public.memberships (community_id, user_id, role, status)
    values (v_row.community_id, v_row.user_id, p_role, 'active')
    on conflict (community_id, user_id) do update set status = 'active'
    returning * into v_membership;

    if v_row.unit_id is not null then
      insert into public.unit_occupants (unit_id, membership_id, relation, is_primary, moved_in_on)
      values (
        v_row.unit_id,
        v_membership.id,
        v_row.relation,
        not exists (
          select 1 from public.unit_occupants o
           where o.unit_id = v_row.unit_id and o.is_primary and o.moved_out_on is null
        ),
        current_date
      )
      on conflict on constraint unit_occupants_unit_membership_key do nothing;
    end if;
  end if;

  update public.join_requests
     set status = (case when p_approve then 'approved' else 'rejected' end)::public.join_request_status,
         reviewed_by = (select auth.uid()),
         reviewed_at = now(),
         decline_reason = case when p_approve then null else p_reason end
   where id = p_request_id
   returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.review_join_request(uuid, boolean, public.member_role, text)
  to authenticated, service_role;

-- Per-flat invite codes are switched off; everyone joins with the society code.
revoke execute on function public.create_invite_code from authenticated;
revoke execute on function public.redeem_invite_code from authenticated;
revoke execute on function public.preview_invite_code from authenticated;

-- ---------------------------------------------------------------------------
-- Money: staff see who paid and record payments; committee signs off bills
-- ---------------------------------------------------------------------------

drop policy if exists contributions_select_own_or_admin on public.contributions;
create policy contributions_select_own_or_staff
  on public.contributions for select to authenticated
  using (
    app.is_staff(community_id)
    or membership_id = app.my_membership_id(community_id)
  );

drop policy if exists contributions_insert_own on public.contributions;
create policy contributions_insert_own
  on public.contributions for insert to authenticated
  with check (
    app.can_participate(community_id)
    and membership_id = app.my_membership_id(community_id)
    and exists (
      select 1 from public.events e
       where e.id = contributions.event_id
         and e.status = 'published'
    )
  );

-- Cash and UPI collected by staff, recorded against a flat or a resident, but
-- never in the staff member's own name: staff do not contribute.
create policy contributions_record_by_staff
  on public.contributions for insert to authenticated
  with check (
    app.is_staff(community_id)
    and membership_id is distinct from app.my_membership_id(community_id)
    and exists (
      select 1 from public.events e
       where e.id = contributions.event_id
         and e.status = 'published'
    )
  );

-- Designated approvers are retired: the committee approves spending.
drop trigger if exists memberships_guard_spending_approvers on public.memberships;
drop trigger if exists communities_guard_spending_restriction on public.communities;
drop function if exists app.guard_spending_approvers();
drop function if exists app.guard_spending_restriction();
drop function if exists app.manages_spending_approval(uuid);
update public.communities set restrict_spending_approval = false;
update public.memberships set approves_spending = false;

create or replace function app.can_approve_spending(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_committee(p_community);
$$;

create or replace function public.review_expense(
  p_expense_id uuid,
  p_decision   public.expense_status,
  p_note       text default null
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.expenses;
  v_actor uuid;
begin
  select * into v_row from public.expenses e where e.id = p_expense_id for update;
  if v_row.id is null then
    raise exception 'No such expense' using errcode = 'P0002';
  end if;

  if not app.is_committee(v_row.community_id) then
    raise exception 'Only the committee can approve or reject a bill'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected', 'changes_requested') then
    raise exception 'A review must approve, reject, or request changes'
      using errcode = '22023';
  end if;

  v_actor := app.my_membership_id(v_row.community_id);

  if p_decision = 'approved' and v_row.requested_by is not null
     and v_row.requested_by = v_actor then
    raise exception 'You cannot approve an expense you requested yourself'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.events e where e.id = v_row.event_id and e.status = 'completed') then
    raise exception 'This event is closed; its ledger cannot be changed'
      using errcode = '42501';
  end if;

  update public.expenses
     set status = p_decision,
         approved_by = case when p_decision = 'approved' then v_actor else null end,
         approved_at = case when p_decision = 'approved' then now() else null end,
         review_note = p_note
   where id = p_expense_id
   returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.review_expense(uuid, public.expense_status, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Events and fundraising campaigns
-- ---------------------------------------------------------------------------

alter table public.events
  add column kind text not null default 'event',
  add constraint events_kind check (kind in ('event', 'campaign'));

drop policy if exists events_select_member on public.events;
create policy events_select_member
  on public.events for select to authenticated
  using (
    app.is_member(community_id)
    and (
      status not in ('draft', 'proposed')
      or app.is_staff(community_id)
      or created_by = (select auth.uid())
    )
  );

-- A resident proposes a campaign; it stays 'proposed' until the committee
-- approves it.
create policy events_propose_campaign
  on public.events for insert to authenticated
  with check (
    app.can_participate(community_id)
    and kind = 'campaign'
    and status = 'proposed'
    and created_by = (select auth.uid())
  );

-- Staff run events: publish, cancel, edit. Approving or turning down a
-- proposed campaign, and closing an event's ledger, are committee decisions.
create or replace function app.guard_event_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;
  if new.status is distinct from old.status then
    if old.status = 'proposed' and not app.is_committee(new.community_id) then
      raise exception 'Only the committee can approve or turn down a proposed campaign'
        using errcode = '42501';
    end if;
    if new.status = 'completed' and not app.is_committee(new.community_id) then
      raise exception 'Only the committee can close an event'
        using errcode = '42501';
    end if;
    if not app.is_staff(new.community_id) then
      raise exception 'Only staff or the committee can change an event''s status'
        using errcode = '42501';
    end if;
  end if;
  if old.status = 'completed' and new.status <> 'completed'
     and not app.is_platform_admin() then
    raise exception 'A closed event cannot be reopened'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Planned spend, line by line. The event's fund target is their sum.
create table public.budget_lines (
  id            uuid primary key default extensions.gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  category      text not null,
  amount        numeric(12, 2) not null,
  notes         text,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint budget_lines_category_not_blank check (length(btrim(category)) > 0),
  constraint budget_lines_amount_non_negative check (amount >= 0)
);

create index budget_lines_event_idx on public.budget_lines (event_id, position);

create trigger budget_lines_inherit_community
  before insert or update of event_id on public.budget_lines
  for each row execute function app.inherit_event_community();

alter table public.budget_lines enable row level security;

create policy budget_lines_select_member
  on public.budget_lines for select to authenticated
  using (app.is_member(community_id));

create policy budget_lines_write_staff
  on public.budget_lines for all to authenticated
  using (app.is_staff(community_id))
  with check (app.is_staff(community_id));

-- ---------------------------------------------------------------------------
-- Activity registration: several people from one flat
-- ---------------------------------------------------------------------------

alter table public.activity_participants
  add column participant_name text,
  drop constraint activity_participants_unique;

create unique index activity_participants_unique_person
  on public.activity_participants (activity_id, membership_id, coalesce(participant_name, ''));

drop policy if exists activity_participants_join_self on public.activity_participants;
create policy activity_participants_join_self
  on public.activity_participants for insert to authenticated
  with check (
    exists (
      select 1 from public.event_activities a
       join public.events e on e.id = a.event_id
       where a.id = activity_participants.activity_id
         and a.is_open
         and e.status = 'published'
         and app.can_participate(a.community_id)
         and activity_participants.membership_id = app.my_membership_id(a.community_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Suggestions: residents suggest, committee approves, residents vote
-- ---------------------------------------------------------------------------

alter table public.activity_suggestions
  add column kind text not null default 'activity',
  add constraint activity_suggestions_kind check (kind in ('activity', 'idea'));

drop policy if exists activity_suggestions_insert_member on public.activity_suggestions;
create policy activity_suggestions_insert_member
  on public.activity_suggestions for insert to authenticated
  with check (
    app.can_participate(community_id)
    and suggested_by = app.my_membership_id(community_id)
    and status = 'new'
  );

-- 'accepted' means approved and open for voting.
create or replace function app.guard_suggestion_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;
  if new.status is distinct from old.status
     and new.status in ('accepted', 'declined')
     and not app.is_committee(new.community_id) then
    raise exception 'Only the committee can approve or decline a suggestion'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger activity_suggestions_guard_status
  before update on public.activity_suggestions
  for each row execute function app.guard_suggestion_status();

-- One vote per person, for or against, changeable while voting is open.
create table public.suggestion_votes (
  id            uuid primary key default extensions.gen_random_uuid(),
  suggestion_id uuid not null references public.activity_suggestions (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  support       boolean not null,
  voted_at      timestamptz not null default now(),
  constraint suggestion_votes_one_per_member unique (suggestion_id, membership_id)
);

create index suggestion_votes_suggestion_idx on public.suggestion_votes (suggestion_id);

alter table public.suggestion_votes enable row level security;

create policy suggestion_votes_select_member
  on public.suggestion_votes for select to authenticated
  using (
    exists (
      select 1 from public.activity_suggestions s
       where s.id = suggestion_votes.suggestion_id
         and app.is_member(s.community_id)
    )
  );

create policy suggestion_votes_cast_own
  on public.suggestion_votes for insert to authenticated
  with check (
    exists (
      select 1 from public.activity_suggestions s
       where s.id = suggestion_votes.suggestion_id
         and s.status = 'accepted'
         and app.can_participate(s.community_id)
         and suggestion_votes.membership_id = app.my_membership_id(s.community_id)
    )
  );

create policy suggestion_votes_change_own
  on public.suggestion_votes for update to authenticated
  using (
    exists (
      select 1 from public.activity_suggestions s
       where s.id = suggestion_votes.suggestion_id
         and s.status = 'accepted'
         and suggestion_votes.membership_id = app.my_membership_id(s.community_id)
    )
  )
  with check (
    exists (
      select 1 from public.activity_suggestions s
       where s.id = suggestion_votes.suggestion_id
         and s.status = 'accepted'
         and suggestion_votes.membership_id = app.my_membership_id(s.community_id)
    )
  );

create policy suggestion_votes_withdraw_own
  on public.suggestion_votes for delete to authenticated
  using (
    exists (
      select 1 from public.activity_suggestions s
       where s.id = suggestion_votes.suggestion_id
         and s.status = 'accepted'
         and suggestion_votes.membership_id = app.my_membership_id(s.community_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Flats for someone joining with the society code
-- ---------------------------------------------------------------------------
-- Applicants are not members, so row-level security hides `units` from them.
-- Knowing the society code is enough to see its flat labels (nothing about who
-- lives there), and wrong codes spend the same brute-force budget as
-- request_to_join.
create or replace function public.society_units(p_join_code text)
returns table (id uuid, block text, number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_community uuid;
  v_recent integer;
begin
  if v_uid is null then
    return;
  end if;

  select count(*) into v_recent
    from public.invite_code_attempts a
   where a.user_id = v_uid
     and a.succeeded = false
     and a.attempted_at > now() - interval '15 minutes';
  if v_recent >= 10 then
    raise exception 'Too many attempts. Please wait a few minutes and try again.'
      using errcode = '54000';
  end if;

  select c.id into v_community
    from public.communities c
   where c.join_code = upper(regexp_replace(coalesce(p_join_code, ''), '[^A-Za-z0-9-]', '', 'g'));

  if v_community is null then
    insert into public.invite_code_attempts (user_id, code_tried, succeeded)
    values (v_uid, upper(coalesce(p_join_code, '')), false);
    return;
  end if;

  return query
    select u.id, u.block, u.number
      from public.units u
     where u.community_id = v_community
     order by u.block nulls first, u.number;
end;
$$;

grant execute on function public.society_units(text) to authenticated, service_role;
