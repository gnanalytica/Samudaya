-- ============================================================================
-- Samudaya · 0922.0400 · A resident can say they moved
-- ----------------------------------------------------------------------------
-- 0922.0300 gave the committee a way to seat anybody. It left the person who
-- actually knows — the resident — with nothing to say. Somebody who moves from
-- B-404 to C-1102, or who picked the wrong flat from a 400-row dropdown on the
-- day they joined, can see the mistake on every payment they make and has no
-- way to even mention it in the app.
--
-- Which flat somebody lives in is not theirs to set: it decides who the ledger
-- names against money and who the directory lists at that door. But asking is
-- theirs, and the society already has the shape for "a resident asks, the
-- committee decides" — join requests, campaign proposals, suggestions. This is
-- the same shape, in the same queue.
--
-- Deliberately not reusing join_requests. That table is about somebody who is
-- not a member yet: it carries a claimed name and phone because there is no
-- profile to read them from, and its unique index is one pending request per
-- *user* per community. A member asking to move is a different question with a
-- different answer, and folding it in would make every read of join_requests
-- ask "but is this one a real join?".
-- ============================================================================

create table public.unit_change_requests (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  -- Null means "I do not live in a flat here any more", which a resident who
  -- has moved out but still runs an event needs to be able to say.
  unit_id       uuid references public.units (id) on delete cascade,
  note          text,
  status        public.join_request_status not null default 'pending',
  reviewed_by   uuid references public.memberships (id) on delete set null,
  reviewed_at   timestamptz,
  decline_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint unit_change_note_length check (note is null or length(note) <= 300),
  constraint unit_change_reason_length
    check (decline_reason is null or length(decline_reason) <= 300)
);

-- One outstanding request per member: asking again edits the question rather
-- than queueing a second one for the committee to wade through.
create unique index unit_change_requests_one_pending
  on public.unit_change_requests (membership_id)
  where status = 'pending';

create index unit_change_requests_pending_idx
  on public.unit_change_requests (community_id) where status = 'pending';

create trigger unit_change_requests_touch_updated_at
  before update on public.unit_change_requests
  for each row execute function app.touch_updated_at();

alter table public.unit_change_requests enable row level security;

-- Readable by the member who asked and by staff, who see the queue. Every
-- write goes through the two functions below, so there is no insert, update or
-- delete policy at all: a resident cannot approve their own move by writing
-- the row, and the committee cannot decide one outside the audit trail.
create policy unit_change_requests_select_own_or_staff
  on public.unit_change_requests for select to authenticated
  using (
    membership_id = app.my_membership_id(community_id)
    or app.is_staff(community_id)
  );

comment on table public.unit_change_requests is
  'A member asking to be moved to another flat, or out of one. The committee '
  'decides; every write goes through request_unit_change() and '
  'review_unit_change(), so RLS grants select and nothing else. Shares '
  'join_request_status, where a no is spelled "rejected" — the notification '
  'kinds say "declined", matching join_declined and payment_declined.';

-- ---------------------------------------------------------------------------
-- Seating, in one place
-- ---------------------------------------------------------------------------
-- set_member_unit() owned this logic and now shares it: approving a request
-- has to move somebody exactly the way the committee moving them by hand does,
-- or the two paths drift and the difference shows up as a resident in two
-- flats at once.
create or replace function app.seat_member(p_membership_id uuid, p_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_primary boolean;
begin
  -- Out of wherever they were. Left as history rather than deleted: a payment
  -- from back then still wants the flat they were in at the time.
  update public.unit_occupants o
     set moved_out_on = current_date
   where o.membership_id = p_membership_id
     and o.moved_out_on is null
     and (p_unit_id is null or o.unit_id <> p_unit_id);

  if p_unit_id is null then return; end if;

  -- Primary only when the flat has nobody holding that seat, so the unique
  -- index on (unit_id) where is_primary stays satisfied.
  v_primary := not exists (
    select 1 from public.unit_occupants o
     where o.unit_id = p_unit_id
       and o.is_primary
       and o.moved_out_on is null
       and o.membership_id <> p_membership_id
  );

  insert into public.unit_occupants
    (unit_id, membership_id, relation, is_primary, moved_in_on)
  values (p_unit_id, p_membership_id, 'owner', v_primary, current_date)
  on conflict (unit_id, membership_id) do update
     set moved_out_on = null,
         is_primary   = excluded.is_primary,
         -- Coming back to a flat they never really left keeps the earlier
         -- date, so their older payments stay inside the occupancy.
         moved_in_on  = least(
           coalesce(public.unit_occupants.moved_in_on, excluded.moved_in_on),
           excluded.moved_in_on
         );
end;
$$;

revoke all on function app.seat_member(uuid, uuid) from public;
revoke all on function app.seat_member(uuid, uuid) from anon;
revoke all on function app.seat_member(uuid, uuid) from authenticated;

comment on function app.seat_member(uuid, uuid) is
  'Moves a member into a flat, or out of every flat when the unit is null. No '
  'permission check of its own — the callers do that. Not granted to anyone.';

create or replace function public.set_member_unit(
  p_membership_id uuid,
  p_unit_id       uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_community uuid;
  v_granted   boolean;
  v_user      uuid;
begin
  select m.community_id into v_community
    from public.memberships m where m.id = p_membership_id;
  if v_community is null then return 'no_member'; end if;

  if not app.is_committee(v_community) then return 'not_committee'; end if;

  if p_unit_id is not null then
    if not exists (select 1 from public.units u where u.id = p_unit_id) then
      return 'no_unit';
    end if;
    -- A flat from another society would put a stranger in the directory and
    -- make the ledger nonsense.
    if not exists (
      select 1 from public.units u
       where u.id = p_unit_id and u.community_id = v_community
    ) then
      return 'wrong_community';
    end if;
  end if;

  perform app.seat_member(p_membership_id, p_unit_id);

  -- Seating somebody by hand settles whatever they were asking for. Leaving
  -- the request open is worse than untidy: the committee would see it again
  -- and approving it would undo the flat they had just chosen.
  update public.unit_change_requests r
     set status = (case when r.unit_id is not distinct from p_unit_id
                        then 'approved' else 'rejected' end)::public.join_request_status,
         decline_reason = case when r.unit_id is not distinct from p_unit_id
                          then null else 'The committee set a different flat' end,
         reviewed_by = app.my_membership_id(v_community),
         reviewed_at = now()
   where r.membership_id = p_membership_id and r.status = 'pending'
  returning r.unit_id is not distinct from p_unit_id into v_granted;

  -- Answered is answered: a request settled this way tells the resident the
  -- same as one settled from the queue, or asking would feel like shouting
  -- into a drawer.
  if v_granted is not null then
    select m.user_id into v_user
      from public.memberships m where m.id = p_membership_id;
    if v_user is not null then
      insert into public.notifications (community_id, user_id, kind, title, body)
      values (
        v_community, v_user,
        case when v_granted then 'unit_change_approved' else 'unit_change_declined' end,
        case when v_granted
             then 'You are now at ' || coalesce('Flat ' || app.flat_label(p_unit_id), 'no flat')
             else 'Your flat was set to '
                  || coalesce('Flat ' || app.flat_label(p_unit_id), 'no flat') end,
        case when v_granted then null
             else 'The committee chose a different flat from the one you asked for.' end
      );
    end if;
  end if;

  return 'ok';
end;
$$;

revoke all on function public.set_member_unit(uuid, uuid) from public;
revoke all on function public.set_member_unit(uuid, uuid) from anon;
grant execute on function public.set_member_unit(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Asking
-- ---------------------------------------------------------------------------
/**
 * A member asks to be moved to a flat, or out of one.
 *
 * Asking again replaces the question rather than queueing a second one. The
 * answer is the committee's, so this only files it — and notifies them, since
 * a request nobody is told about is a request nobody answers.
 *
 *   ok | not_a_member | no_unit | wrong_community | already_there
 */
create or replace function public.request_unit_change(
  p_community_id uuid,
  p_unit_id      uuid default null,
  p_note         text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := app.my_membership_id(p_community_id);
  v_name   text;
  v_flat   text;
begin
  if v_member is null then return 'not_a_member'; end if;

  if p_unit_id is not null then
    if not exists (
      select 1 from public.units u
       where u.id = p_unit_id and u.community_id = p_community_id
    ) then
      return case
        when exists (select 1 from public.units u where u.id = p_unit_id)
        then 'wrong_community' else 'no_unit' end;
    end if;
  end if;

  -- Asking for the flat you are already in is a misunderstanding worth naming
  -- rather than a request for the committee to read and puzzle over.
  if exists (
    select 1 from public.unit_occupants o
     where o.membership_id = v_member
       and o.moved_out_on is null
       and o.unit_id is not distinct from p_unit_id
  ) or (
    p_unit_id is null and not exists (
      select 1 from public.unit_occupants o
       where o.membership_id = v_member and o.moved_out_on is null
    )
  ) then
    return 'already_there';
  end if;

  insert into public.unit_change_requests
    (community_id, membership_id, unit_id, note)
  values (p_community_id, v_member, p_unit_id, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (membership_id) where status = 'pending'
  do update set unit_id = excluded.unit_id,
                note    = excluded.note,
                updated_at = now();

  select p.full_name into v_name
    from public.memberships m join public.profiles p on p.id = m.user_id
   where m.id = v_member;
  v_flat := coalesce('Flat ' || app.flat_label(p_unit_id), 'no flat');

  -- The committee decides, so the committee is who hears about it.
  insert into public.notifications (community_id, user_id, kind, title, body, data)
  select p_community_id, m.user_id, 'unit_change_requested',
         coalesce(v_name, 'A resident') || ' asks to move',
         'They say they now live at ' || v_flat || '.',
         jsonb_build_object('membership_id', v_member)
    from public.memberships m
   where m.community_id = p_community_id
     and m.status = 'active'
     and app.role_rank(m.role) >= app.role_rank('committee');

  return 'ok';
end;
$$;

revoke all on function public.request_unit_change(uuid, uuid, text) from public;
revoke all on function public.request_unit_change(uuid, uuid, text) from anon;
grant execute on function public.request_unit_change(uuid, uuid, text)
  to authenticated, service_role;

comment on function public.request_unit_change(uuid, uuid, text) is
  'A member asks to be moved to a flat, or out of one. Files the request and '
  'tells the committee; deciding it is review_unit_change().';

-- ---------------------------------------------------------------------------
-- Deciding
-- ---------------------------------------------------------------------------
/**
 * The committee answers a flat-change request.
 *
 * Committee rather than staff, for the same reason set_member_unit() is: the
 * answer decides who the ledger names against somebody's money. A repeat click
 * on an already-decided request is a no-op rather than an error, the way
 * review_join_request() treats one.
 *
 *   ok | not_committee | no_request | already_decided
 */
create or replace function public.review_unit_change(
  p_request_id uuid,
  p_approve    boolean,
  p_reason     text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row  public.unit_change_requests;
  v_user uuid;
  v_flat text;
begin
  select * into v_row from public.unit_change_requests r
   where r.id = p_request_id for update;
  if v_row.id is null then return 'no_request'; end if;

  if not app.is_committee(v_row.community_id) then return 'not_committee'; end if;
  if v_row.status <> 'pending' then return 'already_decided'; end if;

  if p_approve then
    perform app.seat_member(v_row.membership_id, v_row.unit_id);
  end if;

  update public.unit_change_requests r
     set status = (case when p_approve then 'approved' else 'rejected' end)
                    ::public.join_request_status,
         decline_reason = case when p_approve then null
                          else nullif(btrim(coalesce(p_reason, '')), '') end,
         reviewed_by = app.my_membership_id(v_row.community_id),
         reviewed_at = now()
   where r.id = p_request_id;

  select m.user_id into v_user
    from public.memberships m where m.id = v_row.membership_id;
  v_flat := coalesce('Flat ' || app.flat_label(v_row.unit_id), 'no flat');

  -- Being told is the whole point of asking. A decline says why, where there
  -- is a why, because "no" without one is what sends people to WhatsApp.
  if v_user is not null then
    insert into public.notifications (community_id, user_id, kind, title, body)
    values (
      v_row.community_id, v_user,
      case when p_approve then 'unit_change_approved' else 'unit_change_declined' end,
      case when p_approve then 'You are now at ' || v_flat
           else 'Your flat was not changed' end,
      case when p_approve then null
           else coalesce(nullif(btrim(coalesce(p_reason, '')), ''),
                         'Ask the committee if this is wrong.') end
    );
  end if;

  return 'ok';
end;
$$;

revoke all on function public.review_unit_change(uuid, boolean, text) from public;
revoke all on function public.review_unit_change(uuid, boolean, text) from anon;
grant execute on function public.review_unit_change(uuid, boolean, text)
  to authenticated, service_role;

comment on function public.review_unit_change(uuid, boolean, text) is
  'Committee-only: approves a flat-change request and seats the member, or '
  'declines it with a reason. Either way the resident is told.';

-- ---------------------------------------------------------------------------
-- Into the queue
-- ---------------------------------------------------------------------------
-- The committee is who decides, so the committee is who sees it — the same
-- gate bills and campaigns already use. Rebuilt whole rather than patched:
-- this function is one statement and there is no way to append a branch to a
-- union without restating it.
create or replace function public.todo_items(p_community_id uuid)
returns table (
  kind        text,
  id          uuid,
  title       text,
  subtitle    text,
  amount      numeric,
  event_slug  text,
  event_name  text,
  created_at  timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select app.is_staff(p_community_id) as staff,
           app.is_committee(p_community_id) as committee,
           app.my_membership_id(p_community_id) as membership,
           app.sole_committee_member(p_community_id) as alone
  )
  select * from (
    -- Join requests
    select 'join_request'::text, r.id, r.claimed_name,
           coalesce('Flat ' || app.flat_label(r.unit_id), 'Works for the society'),
           null::numeric, null::text, null::text, r.created_at
      from public.join_requests r, me
     where me.staff and r.community_id = p_community_id and r.status = 'pending'

    union all
    -- UPI payments residents reported (not the confirmer's own)
    select 'payment_to_confirm', c.id,
           coalesce(p.full_name, 'Flat ' || app.flat_label(c.unit_id), 'A resident'),
           concat_ws(' · ', 'Flat ' || app.flat_label(c.unit_id), 'Ref ' || c.reference),
           c.amount, e.slug, e.name, c.created_at
      from public.contributions c
      join public.events e on e.id = c.event_id
      left join public.memberships m on m.id = c.membership_id
      left join public.profiles p on p.id = m.user_id
      cross join me
     where me.staff and c.community_id = p_community_id and c.status = 'pending'
       and (me.alone or c.membership_id is distinct from me.membership)

    union all
    -- Bills waiting for the committee (not the ones the approver wrote)
    select 'bill_to_approve', x.id, x.name,
           concat_ws(' · ', x.category, x.vendor),
           x.amount, e.slug, e.name, x.created_at
      from public.expenses x
      join public.events e on e.id = x.event_id
      cross join me
     where me.committee and x.community_id = p_community_id and x.status = 'pending'
       and (me.alone
            or coalesce(x.revised_by, x.requested_by) is distinct from me.membership)

    union all
    -- The caller's own bills that were sent back for changes
    select 'bill_sent_back', x.id, x.name,
           coalesce(x.review_note, 'Sent back for changes'),
           x.amount, e.slug, e.name, x.updated_at
      from public.expenses x
      join public.events e on e.id = x.event_id
      cross join me
     where me.staff and x.community_id = p_community_id and x.status = 'changes_requested'
       and x.requested_by = me.membership

    union all
    -- Campaigns residents proposed
    select 'campaign_to_review', e.id, e.name,
           'Target ' || app.money(e.fund_target),
           e.fund_target, e.slug, e.name, e.created_at
      from public.events e, me
     where me.committee and e.community_id = p_community_id and e.status = 'proposed'

    union all
    -- New suggestions
    select 'suggestion_to_review', s.id, s.name,
           initcap(s.kind) || coalesce(' · ' || e.name, ''),
           null::numeric, e.slug, e.name, s.created_at
      from public.activity_suggestions s
      left join public.events e on e.id = s.event_id
      cross join me
     where me.committee and s.community_id = p_community_id and s.status = 'new'

    union all
    -- Residents who say they have moved
    select 'flat_change', r.id,
           coalesce(p.full_name, 'A resident'),
           concat_ws(' · ',
             coalesce('Now at ' || app.flat_label(r.unit_id), 'No longer in a flat'),
             'was ' || app.flat_label(o.unit_id),
             r.note),
           null::numeric, null::text, null::text, r.created_at
      from public.unit_change_requests r
      join public.memberships m on m.id = r.membership_id
      left join public.profiles p on p.id = m.user_id
      left join public.unit_occupants o
             on o.membership_id = r.membership_id and o.moved_out_on is null
      cross join me
     where me.committee and r.community_id = p_community_id and r.status = 'pending'
  ) items (kind, id, title, subtitle, amount, event_slug, event_name, created_at)
  order by created_at desc
  limit 200;
$$;

-- security invoker, so this is not the anon hazard the definer functions are;
-- it is re-stated anyway because a security pass reading only the grant should
-- not have to work out which kind of function this is.
revoke all on function public.todo_items(uuid) from public;
revoke all on function public.todo_items(uuid) from anon;
grant execute on function public.todo_items(uuid) to authenticated, service_role;

-- The badge counts what the queue lists, and drifting apart is how a "3" leads
-- to an empty screen. It used to say so in a comment above a hand-written sum
-- that restated all six filters; it counts the queue itself now, so the two
-- cannot disagree even in principle. Same work either way — six subqueries
-- against the same indexes — and one fewer place to remember.
create or replace function public.todo_count(p_community_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer from public.todo_items(p_community_id);
$$;

revoke all on function public.todo_count(uuid) from public;
revoke all on function public.todo_count(uuid) from anon;
grant execute on function public.todo_count(uuid) to authenticated, service_role;
