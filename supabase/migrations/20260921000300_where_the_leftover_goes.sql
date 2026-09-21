-- ============================================================================
-- Samudaya · 0921.0300 · Where the leftover goes
-- ----------------------------------------------------------------------------
-- An event budgets ₹50,000, collects ₹30,000 and spends ₹20,000. Ten thousand
-- rupees of residents' money is left, and the app has had nothing to say about
-- it: `available` goes on reading ₹10,000 against a closed event forever, and
-- the next event opens at zero and asks sixty flats for money the society is
-- already holding.
--
-- The committee decides at closure, and there are three answers:
--
--   next_event        the next thing on the calendar. The money shows on that
--                     event's bar as already received, so residents are asked
--                     only for the difference.
--   next_edition      next year's run of the same festival. Same movement; the
--                     app offers to create the event when it does not exist
--                     yet, and the name is kept because "carried to Ganesh
--                     2027" reads differently from "carried to the next event".
--   society_balance   kept by the society, unassigned. It shows on everybody's
--                     home screen, and tapping it lists where every rupee of
--                     it came from.
--
-- The committee decides rather than the society voting on it. That is a
-- deliberate choice and it is worth naming: fund_reallocations, next door,
-- exists precisely so moving money between funds takes a vote that clears a
-- threshold, and this route goes around it. What keeps it honest is that the
-- decision is a row — who decided, when, how much, and where it went — visible
-- to every member on the same screen as the balance itself.
--
-- The fourth kind, from_balance, is the way back out. Without it the third
-- answer is a one-way door: a society that always keeps its surplus would
-- accumulate a number it could look at and never use.
--
-- A movement is money the society already has, not money it received again. It
-- is its own number on an event (`fund_carried`), never folded into
-- fund_raised, because "sixty flats contributed ₹30,000" and "the committee
-- moved ₹10,000 across from last year" are different sentences and only one of
-- them is a contribution.
-- ============================================================================

create type public.fund_movement_kind as enum (
  'next_event',
  'next_edition',
  'society_balance',
  'from_balance'
);

create table public.fund_movements (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  kind          public.fund_movement_kind not null,
  -- The event the money is leaving. Null when it is coming out of the balance.
  from_event_id uuid references public.events (id) on delete cascade,
  -- The event the money is going to. Null when it is going into the balance.
  to_event_id   uuid references public.events (id) on delete cascade,
  amount        numeric(12, 2) not null,
  note          text,
  decided_by    uuid references public.memberships (id) on delete set null,
  decided_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  constraint fund_movements_amount_positive check (amount > 0),
  constraint fund_movements_has_two_ends
    check (from_event_id is not null or to_event_id is not null),
  constraint fund_movements_not_circular
    check (from_event_id is null or from_event_id is distinct from to_event_id),
  -- The kind is not decoration: it says which of the three answers the
  -- committee gave, and the shape of the row has to match the answer.
  constraint fund_movements_kind_matches_ends check (
    case kind
      when 'society_balance' then from_event_id is not null and to_event_id is null
      when 'from_balance'    then from_event_id is null and to_event_id is not null
      else from_event_id is not null and to_event_id is not null
    end
  )
);

create index fund_movements_community_idx
  on public.fund_movements (community_id, decided_at desc);
create index fund_movements_to_event_idx
  on public.fund_movements (to_event_id) where to_event_id is not null;
create index fund_movements_from_event_idx
  on public.fund_movements (from_event_id) where from_event_id is not null;

comment on table public.fund_movements is
  'Where an event''s surplus went, decided by the committee when the event '
  'closed. Append-only in practice: there is no update or delete policy, and '
  'allocate_surplus() is the only way a row gets in.';

alter table public.fund_movements enable row level security;

-- Every member reads it. That is the whole point: a committee decision about
-- residents' money that residents cannot see is not an improvement on a
-- WhatsApp message saying the same thing.
create policy fund_movements_select_member
  on public.fund_movements for select to authenticated
  using (app.is_member(community_id));

-- No insert, update or delete policy anywhere. The functions below are
-- security definer and are the only door in; nothing can rewrite a movement
-- afterwards, including the committee member who made it.

-- ---------------------------------------------------------------------------
-- What the society is holding
-- ---------------------------------------------------------------------------

create view public.society_balance
with (security_invoker = false) as
select m.community_id,
       (coalesce(sum(m.amount) filter (where m.to_event_id is null), 0)
        - coalesce(sum(m.amount) filter (where m.from_event_id is null), 0))::numeric(12,2)
         as balance,
       count(*) filter (where m.to_event_id is null)::integer as movements_in,
       max(m.decided_at) filter (where m.to_event_id is null or m.from_event_id is null)
         as last_decided_at
  from public.fund_movements m
 where app.is_member(m.community_id)
 group by m.community_id;

grant select on public.society_balance to authenticated, service_role;

comment on view public.society_balance is
  'What the society is holding that is not assigned to an event: surpluses '
  'kept at closure, less anything taken back out. A society with no movements '
  'has no row, which reads as zero.';

-- ---------------------------------------------------------------------------
-- event_stats, with the money the society moved across
-- ---------------------------------------------------------------------------
-- Appended rather than slotted in beside fund_raised: `create or replace view`
-- will not reorder existing columns, and every caller selects by name anyway.
--
-- `available` changes meaning, though not its name or its type: money carried
-- in is money this event can spend, and money carried out is money it no
-- longer has. Leaving it out would let a closed event go on reporting a
-- surplus it had already given away.
create or replace view public.event_stats
with (security_invoker = false) as
select
  e.id                                as event_id,
  e.community_id,
  e.fund_target,
  coalesce(f.raised, 0)::numeric(12,2)   as fund_raised,
  coalesce(f.contributors, 0)::integer   as contributors,
  coalesce(x.spent, 0)::numeric(12,2)    as spent,
  (coalesce(f.raised, 0) + coalesce(mv.carried, 0) - coalesce(x.spent, 0))::numeric(12,2)
                                         as available,
  coalesce(x.pending_count, 0)::integer  as pending_expenses,
  coalesce(t.total, 0)::integer          as tasks_total,
  coalesce(t.done, 0)::integer           as tasks_done,
  case when coalesce(t.total, 0) = 0 then 0
       else round((t.done::numeric / t.total) * 100)::integer
  end                                    as readiness,
  coalesce(p.participants, 0)::integer   as participants,
  coalesce(v.volunteers, 0)::integer     as volunteers,
  -- Reported, not yet confirmed. Never added to fund_raised anywhere.
  coalesce(f.pending, 0)::numeric(12,2)  as fund_pending,
  coalesce(f.pending_contributors, 0)::integer as pending_contributors,
  -- Moved across by the committee, net of anything moved on again. Not a
  -- contribution, and never added to fund_raised.
  coalesce(mv.carried, 0)::numeric(12,2) as fund_carried
from public.events e
left join lateral (
  select sum(c.amount) filter (where c.status = 'succeeded') as raised,
         -- A household is a flat when we know it, otherwise the member.
         count(distinct coalesce('unit:' || c.unit_id::text, 'member:' || c.membership_id::text))
           filter (where c.status = 'succeeded') as contributors,
         sum(c.amount) filter (where c.status = 'pending') as pending,
         count(distinct coalesce('unit:' || c.unit_id::text, 'member:' || c.membership_id::text))
           filter (where c.status = 'pending') as pending_contributors
    from public.contributions c
   where c.event_id = e.id
) f on true
left join lateral (
  select sum(x2.amount) filter (where x2.status = 'approved') as spent,
         count(*) filter (where x2.status = 'pending') as pending_count
    from public.expenses x2
   where x2.event_id = e.id
) x on true
left join lateral (
  select coalesce(sum(m.amount) filter (where m.to_event_id = e.id), 0)
       - coalesce(sum(m.amount) filter (where m.from_event_id = e.id), 0) as carried
    from public.fund_movements m
   where m.to_event_id = e.id or m.from_event_id = e.id
) mv on true
left join lateral (
  select count(*) as total, count(*) filter (where t2.status = 'done') as done
    from public.event_tasks t2
   where t2.event_id = e.id
) t on true
left join lateral (
  select count(distinct ap.membership_id) as participants
    from public.activity_participants ap
    join public.event_activities a on a.id = ap.activity_id
   where a.event_id = e.id
) p on true
left join lateral (
  select count(distinct ev.membership_id) as volunteers
    from public.event_volunteers ev
    join public.volunteer_roles r on r.id = ev.role_id
   where r.event_id = e.id
) v on true
where app.is_member(e.community_id);

grant select on public.event_stats to authenticated, service_role;

comment on view public.event_stats is
  'Every derived number a screen shows for an event. fund_raised is confirmed '
  'contributions only; fund_pending is what has been reported and not yet '
  'matched against the bank; fund_carried is money the committee moved across '
  'from another event or the society balance. None of the three is ever added '
  'to another.';

-- ---------------------------------------------------------------------------
-- Deciding
-- ---------------------------------------------------------------------------

/**
 * What a closed event still has that nobody has decided about.
 *
 * The same arithmetic as event_stats.available, read directly rather than
 * through the view, because the view is gated on app.is_member() and a
 * definer function has no business depending on who is asking.
 */
create or replace function app.event_surplus(p_event_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((select sum(c.amount) from public.contributions c
               where c.event_id = p_event_id and c.status = 'succeeded'), 0)
    + coalesce((select sum(m.amount) from public.fund_movements m
                 where m.to_event_id = p_event_id), 0)
    - coalesce((select sum(m.amount) from public.fund_movements m
                 where m.from_event_id = p_event_id), 0)
    - coalesce((select sum(x.amount) from public.expenses x
                 where x.event_id = p_event_id and x.status = 'approved'), 0)
  )::numeric(12,2);
$$;

/**
 * The committee decides where a closed event's leftover money goes.
 *
 * Takes the whole of what is left rather than an amount, because the figure is
 * not a matter of opinion: it is what the ledger says, and letting the caller
 * name it would be inviting a typo into the one number nobody is checking.
 * Calling it twice is harmless — the second call finds nothing left and says
 * so.
 */
create or replace function public.allocate_surplus(
  p_event_id    uuid,
  p_kind        public.fund_movement_kind,
  p_to_event_id uuid default null,
  p_note        text default null
)
returns public.fund_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_target public.events;
  v_amount numeric(12,2);
  v_row public.fund_movements;
begin
  select * into v_event from public.events e where e.id = p_event_id;
  if v_event.id is null then
    raise exception 'No such event' using errcode = 'P0002';
  end if;

  if not app.is_committee(v_event.community_id) then
    raise exception 'Only the committee can decide where a surplus goes'
      using errcode = '42501';
  end if;

  if v_event.status <> 'completed' then
    raise exception 'A surplus is decided when the event closes, not before'
      using errcode = '22023';
  end if;

  if p_kind = 'from_balance' then
    raise exception 'Use spend_society_balance() to bring society funds into an event'
      using errcode = '22023';
  end if;

  v_amount := app.event_surplus(p_event_id);
  if v_amount <= 0 then
    raise exception 'This event has nothing left to allocate'
      using errcode = '22023';
  end if;

  if p_kind = 'society_balance' then
    if p_to_event_id is not null then
      raise exception 'Keeping a surplus does not name another event'
        using errcode = '22023';
    end if;
  else
    select * into v_target from public.events e where e.id = p_to_event_id;
    if v_target.id is null or v_target.community_id <> v_event.community_id then
      raise exception 'No such event' using errcode = 'P0002';
    end if;
    if v_target.id = v_event.id then
      raise exception 'A surplus cannot be carried into the event it came from'
        using errcode = '22023';
    end if;
    -- Carrying into an event that is finished puts money somewhere nobody can
    -- spend it, which is the problem this function exists to solve.
    if v_target.status in ('completed', 'cancelled') then
      raise exception 'That event is closed; carry the money somewhere it can be spent'
        using errcode = '22023';
    end if;
  end if;

  insert into public.fund_movements
    (community_id, kind, from_event_id, to_event_id, amount, note, decided_by)
  values (v_event.community_id, p_kind, v_event.id, p_to_event_id, v_amount,
          nullif(btrim(coalesce(p_note, '')), ''),
          app.my_membership_id(v_event.community_id))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.allocate_surplus(uuid, public.fund_movement_kind, uuid, text) from public;
revoke all on function public.allocate_surplus(uuid, public.fund_movement_kind, uuid, text) from anon;
grant execute on function public.allocate_surplus(uuid, public.fund_movement_kind, uuid, text)
  to authenticated, service_role;

/**
 * The way back out: the committee puts some of the society balance behind an
 * event that is still collecting.
 *
 * Takes an amount, unlike allocate_surplus(), because the balance is a pot
 * rather than a closing figure and spending all of it is rarely what anybody
 * means.
 */
create or replace function public.spend_society_balance(
  p_to_event_id uuid,
  p_amount      numeric,
  p_note        text default null
)
returns public.fund_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.events;
  v_balance numeric(12,2);
  v_row public.fund_movements;
begin
  select * into v_target from public.events e where e.id = p_to_event_id;
  if v_target.id is null then
    raise exception 'No such event' using errcode = 'P0002';
  end if;

  if not app.is_committee(v_target.community_id) then
    raise exception 'Only the committee can spend the society balance'
      using errcode = '42501';
  end if;

  if v_target.status in ('completed', 'cancelled') then
    raise exception 'That event is closed; carry the money somewhere it can be spent'
      using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than zero'
      using errcode = '22023';
  end if;

  select coalesce(sum(m.amount) filter (where m.to_event_id is null), 0)
       - coalesce(sum(m.amount) filter (where m.from_event_id is null), 0)
    into v_balance
    from public.fund_movements m
   where m.community_id = v_target.community_id;

  if p_amount > v_balance then
    raise exception 'The society balance is smaller than that'
      using errcode = '22023';
  end if;

  insert into public.fund_movements
    (community_id, kind, from_event_id, to_event_id, amount, note, decided_by)
  values (v_target.community_id, 'from_balance', null, v_target.id, p_amount::numeric(12,2),
          nullif(btrim(coalesce(p_note, '')), ''),
          app.my_membership_id(v_target.community_id))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.spend_society_balance(uuid, numeric, text) from public;
revoke all on function public.spend_society_balance(uuid, numeric, text) from anon;
grant execute on function public.spend_society_balance(uuid, numeric, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Telling everybody
-- ---------------------------------------------------------------------------

/**
 * A decision about money residents gave is not committee business once it is
 * made. Everybody who can take part hears where it went, on the same terms as
 * a new event.
 */
create or replace function app.notify_fund_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
  v_to text;
begin
  select e.name into v_from from public.events e where e.id = new.from_event_id;
  select e.name into v_to from public.events e where e.id = new.to_event_id;

  perform app.notify(
    new.community_id,
    array(select app.member_user_ids(new.community_id,
            array['resident', 'staff', 'committee']::public.member_role[])),
    'fund_moved',
    case
      when new.to_event_id is null then app.money(new.amount) || ' kept by the society'
      when new.from_event_id is null then app.money(new.amount) || ' from the society balance'
      else app.money(new.amount) || ' carried forward'
    end,
    case
      when new.to_event_id is null
        then 'Left over from ' || coalesce(v_from, 'a closed event')
             || '. It stays with the society until the committee puts it behind an event.'
      when new.from_event_id is null
        then 'The committee put it behind ' || coalesce(v_to, 'an event') || '.'
      else 'Left over from ' || coalesce(v_from, 'a closed event')
           || ', now counting towards ' || coalesce(v_to, 'the next event') || '.'
    end,
    jsonb_build_object(
      'screen', case when new.to_event_id is null then 'money' else 'event' end,
      'event_slug', (select e.slug from public.events e where e.id = new.to_event_id)
    )
  );
  return null;
end;
$$;

create trigger fund_movements_notify
  after insert on public.fund_movements
  for each row execute function app.notify_fund_movement();
