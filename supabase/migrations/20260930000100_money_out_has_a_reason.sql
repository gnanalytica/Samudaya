-- ============================================================================
-- Money out has a reason
-- ============================================================================
-- Money coming in already had its rules: a payment names its flat, and a
-- resident's report carries a transaction ID or a screenshot. Money going out
-- had fewer, and the committee asked for four:
--
--   1. A bill names its vendor and carries a copy. From now on, not for the
--      bills already on the books, which stay as they were approved.
--   2. The society can spend its own balance on something that is no event's —
--      a repair, damage — with a reason, who was paid, and a receipt. Everybody
--      sees it, in the ledger and as a notification.
--   3. When a bill takes an event past what it collected, somebody paid the
--      difference out of their own pocket. The committee hears who, and how
--      much, the moment the bill is approved, and the event sits in their To do
--      until it is settled.
--   4. The committee can settle it from the society balance: they pay the
--      resident back and attach the screenshot of the transfer. Residents see
--      that, too — the point is that people know they will be paid back.
--
-- Nothing here edits a row after the fact. The new table has no update or
-- delete policy, and the only way in is a function that checks the rules.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. A bill names its vendor and carries a copy
-- ---------------------------------------------------------------------------
-- A trigger rather than a check constraint, because a constraint would be
-- checked against every old bill the next time anything about it changed —
-- including its approval — and the bills already on the books were approved
-- under the old rule. New bills, and any change to the vendor or the copy of
-- an old one, have to meet it.

create or replace function app.bill_has_vendor_and_copy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(btrim(new.vendor), '') = '' then
    raise exception 'Name the vendor this bill is from'
      using errcode = '23514';
  end if;
  if coalesce(btrim(new.bill_url), '') = '' then
    raise exception 'Attach a photo or PDF of the bill'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger expenses_need_vendor_and_copy
  before insert on public.expenses
  for each row execute function app.bill_has_vendor_and_copy();

create trigger expenses_keep_vendor_and_copy
  before update of vendor, bill_url on public.expenses
  for each row
  when (new.vendor is distinct from old.vendor or new.bill_url is distinct from old.bill_url)
  execute function app.bill_has_vendor_and_copy();

-- ---------------------------------------------------------------------------
-- 2. The society's own spending
-- ---------------------------------------------------------------------------

create table public.society_expenses (
  id           uuid primary key default extensions.gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  amount       numeric(12, 2) not null,
  -- What it was for, in words a resident can check: "Gate motor repair".
  reason       text not null,
  -- Who got the money: a vendor, a plumber, a resident paid back.
  paid_to      text not null,
  -- The bill or the payment screenshot, in the bills bucket under the society.
  proof_path   text not null,
  spent_on     date not null default current_date,
  recorded_by  uuid references public.memberships (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint society_expenses_amount_positive check (amount > 0),
  constraint society_expenses_reason_not_blank check (length(btrim(reason)) > 0),
  constraint society_expenses_paid_to_not_blank check (length(btrim(paid_to)) > 0),
  constraint society_expenses_proof_not_blank check (length(btrim(proof_path)) > 0)
);

create index society_expenses_community_idx
  on public.society_expenses (community_id, spent_on desc);

comment on table public.society_expenses is
  'Money the society spent from its own balance on something that belongs to no '
  'event. Append-only: record_society_expense() is the only way in.';

alter table public.society_expenses enable row level security;

-- Every member reads it, for the same reason every member reads the ledger.
create policy society_expenses_select_member
  on public.society_expenses for select to authenticated
  using (app.is_member(community_id));

-- A pay-back from the society balance to cover an event's overspend is a fund
-- movement like any other; these say who was paid and show the transfer.
alter table public.fund_movements
  add column if not exists paid_to text,
  add column if not exists proof_path text;

comment on column public.fund_movements.paid_to is
  'Who the society paid back, when the movement covered an event that spent '
  'more than it collected.';
comment on column public.fund_movements.proof_path is
  'Screenshot of that transfer, in the bills bucket. Every member can open it.';

/**
 * What the society is holding outside every event: surpluses kept at closure,
 * less what was put back behind events, less what it spent on its own account.
 *
 * Definer, like app.event_surplus(), so a function deciding whether money can
 * be spent does not depend on who is asking.
 */
create or replace function app.society_pool(p_community uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((select sum(m.amount) from public.fund_movements m
               where m.community_id = p_community and m.to_event_id is null), 0)
    - coalesce((select sum(m.amount) from public.fund_movements m
                 where m.community_id = p_community and m.from_event_id is null), 0)
    - coalesce((select sum(x.amount) from public.society_expenses x
                 where x.community_id = p_community), 0)
  )::numeric(12,2);
$$;

/**
 * Staff or the committee spend some of the society balance: a repair, damage,
 * anything that is not an event's. Every field is required. The money has to
 * be there — the balance never goes below zero — and the proof has to sit in
 * this society's folder, where every member can open it.
 */
create or replace function public.record_society_expense(
  p_community_id uuid,
  p_amount       numeric,
  p_reason       text,
  p_paid_to      text,
  p_proof_path   text,
  p_spent_on     date default null
)
returns public.society_expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.society_expenses;
begin
  if not app.is_staff(p_community_id) then
    raise exception 'Only staff and the committee can spend the society balance'
      using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than zero' using errcode = '22023';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Say what the money was spent on' using errcode = '22023';
  end if;
  if coalesce(btrim(p_paid_to), '') = '' then
    raise exception 'Say who was paid' using errcode = '22023';
  end if;
  if coalesce(btrim(p_proof_path), '') = '' then
    raise exception 'Attach the bill or a screenshot of the payment' using errcode = '22023';
  end if;
  -- In this society's own folder, not an event's: once recorded, every member
  -- can open it, and a bill still waiting for approval is not theirs to see.
  if split_part(p_proof_path, '/', 1) <> p_community_id::text
     or split_part(p_proof_path, '/', 2) <> 'society' then
    raise exception 'That file could not be attached; upload it again' using errcode = '22023';
  end if;

  -- One spend at a time per society, so two people cannot both spend the
  -- last of the balance.
  perform pg_advisory_xact_lock(hashtext('society_pool:' || p_community_id::text));

  if p_amount > app.society_pool(p_community_id) then
    raise exception 'The society balance is smaller than that' using errcode = '22023';
  end if;

  insert into public.society_expenses
    (community_id, amount, reason, paid_to, proof_path, spent_on, recorded_by)
  values (p_community_id, p_amount::numeric(12,2), btrim(p_reason), btrim(p_paid_to),
          btrim(p_proof_path), coalesce(p_spent_on, current_date),
          app.my_membership_id(p_community_id))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_society_expense(uuid, numeric, text, text, text, date)
  from public;
revoke all on function public.record_society_expense(uuid, numeric, text, text, text, date)
  from anon;
grant execute on function public.record_society_expense(uuid, numeric, text, text, text, date)
  to authenticated, service_role;

/** Everybody hears where the society's money went, the way they hear a surplus kept. */
create or replace function app.notify_society_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.notify(
    new.community_id,
    array(select app.member_user_ids(new.community_id,
            array['resident', 'staff', 'committee']::public.member_role[])),
    'society_spent',
    app.money(new.amount) || ' spent from the society balance',
    new.reason || ', paid to ' || new.paid_to || '. The receipt is on the Money page.',
    jsonb_build_object('screen', 'money')
  );
  return null;
end;
$$;

create trigger society_expenses_notify
  after insert on public.society_expenses
  for each row execute function app.notify_society_expense();

-- The existing way to put the balance behind an event, now counting the
-- society's own spending, and taking the same lock.
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

  perform pg_advisory_xact_lock(hashtext('society_pool:' || v_target.community_id::text));

  if p_amount > app.society_pool(v_target.community_id) then
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

-- ---------------------------------------------------------------------------
-- 3. An event that spent more than it collected
-- ---------------------------------------------------------------------------

/**
 * Who paid for a bill, as a name. The phone records the uploader's membership
 * in paid_by, the web a name typed in the form; older bills may have neither,
 * and then it is whoever uploaded it.
 */
create or replace function app.bill_payer(p_paid_by text, p_requested_by uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.full_name
       from public.memberships m
       join public.profiles p on p.id = m.user_id
      where m.id = app.try_uuid(p_paid_by)),
    case when app.try_uuid(p_paid_by) is null then nullif(btrim(p_paid_by), '') end,
    (select p.full_name
       from public.memberships m
       join public.profiles p on p.id = m.user_id
      where m.id = p_requested_by)
  );
$$;

/**
 * The committee hears the moment an approved bill takes an event past what it
 * collected: which event, by how much, who paid, and whether the society
 * balance can pay them back now.
 */
create or replace function app.notify_overspend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_left  numeric(12,2);
  v_event public.events;
  v_payer text;
begin
  v_left := app.event_surplus(new.event_id);
  if v_left >= 0 then
    return null;
  end if;

  select * into v_event from public.events e where e.id = new.event_id;
  v_payer := app.bill_payer(new.paid_by, new.requested_by);

  perform app.notify(
    new.community_id,
    array(select app.member_user_ids(new.community_id,
            array['committee']::public.member_role[])),
    'overspent',
    v_event.name || ' is ' || app.money(-v_left) || ' over what it collected',
    coalesce(v_payer, 'Somebody') || ' paid ' || app.money(new.amount) || ' for ' || new.name
      || coalesce(' (' || nullif(btrim(new.category), '') || ')', '')
      || case
           when app.society_pool(new.community_id) >= -v_left
             then '. The society balance can pay them back.'
           else '. The society balance cannot cover it yet, so it stays in To do.'
         end,
    jsonb_build_object('screen', 'todo', 'event_slug', v_event.slug)
  );
  return null;
end;
$$;

create trigger expenses_notify_overspend
  after update of status on public.expenses
  for each row
  when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function app.notify_overspend();

-- ---------------------------------------------------------------------------
-- 4. Paying them back from the society balance
-- ---------------------------------------------------------------------------

/**
 * The committee pays back whoever covered an event's overspend, from the
 * society balance, and attaches the screenshot of the transfer.
 *
 * A movement from the balance to the event, like spend_society_balance(), but
 * allowed on a closed event — an overspend is usually found at the end — and
 * never for more than the event is actually over by. What cannot be covered
 * yet stays in To do; covering part of it now is allowed.
 */
create or replace function public.cover_overspend(
  p_event_id   uuid,
  p_amount     numeric,
  p_paid_to    text,
  p_proof_path text,
  p_note       text default null
)
returns public.fund_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_over  numeric(12,2);
  v_row   public.fund_movements;
begin
  select * into v_event from public.events e where e.id = p_event_id;
  if v_event.id is null then
    raise exception 'No such event' using errcode = 'P0002';
  end if;

  if not app.is_committee(v_event.community_id) then
    raise exception 'Only the committee can pay back an overspend'
      using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than zero' using errcode = '22023';
  end if;
  if coalesce(btrim(p_paid_to), '') = '' then
    raise exception 'Say who was paid back' using errcode = '22023';
  end if;
  if coalesce(btrim(p_proof_path), '') = '' then
    raise exception 'Attach the screenshot of the transfer' using errcode = '22023';
  end if;
  if split_part(p_proof_path, '/', 1) <> v_event.community_id::text
     or split_part(p_proof_path, '/', 2) <> 'society' then
    raise exception 'That screenshot could not be attached; upload it again'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('society_pool:' || v_event.community_id::text));

  v_over := -app.event_surplus(p_event_id);
  if v_over <= 0 then
    raise exception 'This event has not spent more than it collected'
      using errcode = '22023';
  end if;
  if p_amount > v_over then
    raise exception 'That is more than the event is over by' using errcode = '22023';
  end if;
  if p_amount > app.society_pool(v_event.community_id) then
    raise exception 'The society balance is smaller than that' using errcode = '22023';
  end if;

  insert into public.fund_movements
    (community_id, kind, from_event_id, to_event_id, amount, note, decided_by,
     paid_to, proof_path)
  values (v_event.community_id, 'from_balance', null, v_event.id, p_amount::numeric(12,2),
          nullif(btrim(coalesce(p_note, '')), ''),
          app.my_membership_id(v_event.community_id),
          btrim(p_paid_to), btrim(p_proof_path))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.cover_overspend(uuid, numeric, text, text, text) from public;
revoke all on function public.cover_overspend(uuid, numeric, text, text, text) from anon;
grant execute on function public.cover_overspend(uuid, numeric, text, text, text)
  to authenticated, service_role;

-- Everybody still hears about every movement; a pay-back says who was paid.
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
      when new.paid_to is not null
        then app.money(new.amount) || ' paid back from the society balance'
      when new.to_event_id is null then app.money(new.amount) || ' kept by the society'
      when new.from_event_id is null then app.money(new.amount) || ' from the society balance'
      else app.money(new.amount) || ' carried forward'
    end,
    case
      when new.paid_to is not null
        then new.paid_to || ' paid for ' || coalesce(v_to, 'an event')
             || ' out of their own pocket when it ran short. The committee paid them back.'
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

-- ---------------------------------------------------------------------------
-- What the society is holding, and the ledger, with its own spending
-- ---------------------------------------------------------------------------

create or replace view public.society_balance
with (security_invoker = false) as
with flows as (
  select m.community_id,
         case
           when m.to_event_id is null then m.amount
           when m.from_event_id is null then -m.amount
           else 0
         end                                               as delta,
         (m.to_event_id is null)                           as kept,
         case when m.to_event_id is null or m.from_event_id is null
              then m.decided_at end                        as happened_at
    from public.fund_movements m
  union all
  select x.community_id, -x.amount, false, x.created_at
    from public.society_expenses x
)
select f.community_id,
       sum(f.delta)::numeric(12,2)                          as balance,
       (count(*) filter (where f.kept))::integer             as movements_in,
       max(f.happened_at)                                   as last_decided_at
  from flows f
 where app.is_member(f.community_id)
 group by f.community_id;

comment on view public.society_balance is
  'What the society is holding that is not assigned to an event: surpluses '
  'kept at closure, less anything put back behind an event or spent on the '
  'society''s own account. A society with none of those has no row, which '
  'reads as zero.';

-- The ledger gains a third kind of row: the society's own spending. It has no
-- event; the counterpart is who was paid and the detail is what for.
create or replace view public.society_ledger
with (security_invoker = false) as
with money_in as (
  select
    c.id,
    c.community_id,
    c.event_id,
    c.amount,
    c.method,
    c.paid_at,
    c.receipt_no,
    c.proof_path,
    c.membership_id,
    c.verified_at,
    e.slug                             as event_slug,
    e.name                             as event_name,
    v.full_name                        as verified_by_name,
    coalesce(payer.full_name, resident.full_name)   as payer_name,
    coalesce(
      nullif(btrim(coalesce(u.block || ' ', '') || u.number), ''),
      nullif(btrim(coalesce(home.block || ' ', '') || home.number), '')
    )                                               as unit_label,
    initcap(c.method::text)                         as method_label
    from public.contributions c
    join public.events e on e.id = c.event_id
    left join public.units u on u.id = c.unit_id
    left join public.memberships pm on pm.id = c.membership_id
    left join public.profiles payer on payer.id = pm.user_id
    left join public.memberships vm on vm.id = c.verified_by
    left join public.profiles v on v.id = vm.user_id

    -- The payer's flat, when the payment did not record one. We already know
    -- who paid; this only picks the label to print beside their name, so a
    -- covering occupancy is preferred but never required.
    left join lateral (
      select u2.block, u2.number
        from public.unit_occupants o
        join public.units u2 on u2.id = o.unit_id
       where c.unit_id is null
         and c.membership_id is not null
         and o.membership_id = c.membership_id
       order by
         -- An occupancy that covered the day they paid wins outright.
         ((o.moved_in_on  is null or o.moved_in_on  <= c.paid_at::date)
          and (o.moved_out_on is null or o.moved_out_on >= c.paid_at::date)) desc,
         -- Then where they live now, then the last place they lived.
         (o.moved_out_on is null) desc,
         o.is_primary desc,
         o.moved_in_on desc nulls last
       limit 1
    ) home on true

    -- The flat's resident, when the payment named no account. Hard-bounded:
    -- this one decides *who paid*, and naming the wrong neighbour is worse
    -- than leaving the row with only its flat.
    left join lateral (
      select p.full_name
        from public.unit_occupants o
        join public.memberships m on m.id = o.membership_id
        join public.profiles p on p.id = m.user_id
       where c.membership_id is null
         and c.unit_id is not null
         and o.unit_id = c.unit_id
         and (o.moved_in_on  is null or o.moved_in_on  <= c.paid_at::date)
         and (o.moved_out_on is null or o.moved_out_on >= c.paid_at::date)
       order by o.is_primary desc, o.moved_in_on desc nulls last
       limit 1
    ) resident on true

   where c.status = 'succeeded'
     and app.is_member(c.community_id)
)
select
  ('in:' || c.id::text)                as id,
  c.community_id,
  c.event_id,
  c.event_slug,
  c.event_name,
  'in'::text                           as direction,
  c.paid_at                            as happened_at,
  c.amount                             as amount,
  coalesce(c.payer_name, c.unit_label, c.method_label)  as counterpart,
  case
    when c.payer_name is not null
      then nullif(concat_ws(' · ', c.unit_label, c.method_label), '')
    when c.unit_label is not null then c.method_label
  end                                  as detail,
  c.receipt_no                         as receipt_no,
  case
    when app.is_staff(c.community_id) then c.proof_path
    when c.membership_id is not null
     and c.membership_id = app.my_membership_id(c.community_id) then c.proof_path
  end                                  as document_url,
  c.verified_by_name                   as confirmed_by,
  c.verified_at                        as confirmed_at,
  c.membership_id                      as membership_id,
  c.payer_name                         as payer_name,
  c.unit_label                         as unit_label,
  c.method_label                       as method
  from money_in c

union all

select
  ('out:' || x.id::text),
  x.community_id,
  x.event_id,
  e.slug,
  e.name,
  'out'::text,
  x.spent_on::timestamptz,
  -x.amount,
  coalesce(x.vendor, 'Vendor not recorded'),
  coalesce(x.category, 'Uncategorised'),
  null::bigint,
  x.bill_url,
  a.full_name,
  x.approved_at,
  null::uuid,
  null::text,
  null::text,
  null::text
  from public.expenses x
  join public.events e on e.id = x.event_id
  left join public.memberships am on am.id = x.approved_by
  left join public.profiles a on a.id = am.user_id
 where x.status = 'approved'
   and app.is_member(x.community_id)

union all

select
  ('society:' || s.id::text),
  s.community_id,
  null::uuid,
  null::text,
  null::text,
  'out'::text,
  s.spent_on::timestamptz,
  -s.amount,
  s.paid_to,
  s.reason,
  null::bigint,
  s.proof_path,
  r.full_name,
  s.created_at,
  null::uuid,
  null::text,
  null::text,
  null::text
  from public.society_expenses s
  left join public.memberships rm on rm.id = s.recorded_by
  left join public.profiles r on r.id = rm.user_id
 where app.is_member(s.community_id);

comment on column public.society_ledger.unit_label is
  'The flat: the one recorded on the payment, else the payer''s at the time, '
  'else where they live now. Null for money out.';

comment on column public.society_ledger.event_id is
  'The event the money came in for or went out on. Null for the society''s own '
  'spending, whose detail says what it was for.';

-- ---------------------------------------------------------------------------
-- Every member can open the receipts
-- ---------------------------------------------------------------------------
-- The bills bucket already lets members open an approved bill. The society's
-- own spending and its pay-backs are just as public, and just as permanent:
-- staff can no longer replace or delete a file once a row points at it.

create policy bills_read_society_proofs
  on storage.objects for select to authenticated
  using (
    bucket_id = 'bills'
    and app.is_member(app.try_uuid((storage.foldername(name))[1]))
    and (
      exists (select 1 from public.society_expenses s where s.proof_path = storage.objects.name)
      or exists (select 1 from public.fund_movements m where m.proof_path = storage.objects.name)
    )
  );

drop policy if exists bills_replace_staff on storage.objects;
create policy bills_replace_staff
  on storage.objects for update to authenticated
  using (
    bucket_id = 'bills'
    and app.is_staff(app.try_uuid((storage.foldername(name))[1]))
    and not exists (
      select 1 from public.expenses e
       where e.bill_url = storage.objects.name and e.status = 'approved'
    )
    and not exists (select 1 from public.society_expenses s where s.proof_path = storage.objects.name)
    and not exists (select 1 from public.fund_movements m where m.proof_path = storage.objects.name)
  )
  with check (
    bucket_id = 'bills'
    and app.is_staff(app.try_uuid((storage.foldername(name))[1]))
  );

drop policy if exists bills_delete_staff on storage.objects;
create policy bills_delete_staff
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'bills'
    and app.is_staff(app.try_uuid((storage.foldername(name))[1]))
    and not exists (
      select 1 from public.expenses e
       where e.bill_url = storage.objects.name and e.status = 'approved'
    )
    and not exists (select 1 from public.society_expenses s where s.proof_path = storage.objects.name)
    and not exists (select 1 from public.fund_movements m where m.proof_path = storage.objects.name)
  );

-- ---------------------------------------------------------------------------
-- 5. Into the queue
-- ---------------------------------------------------------------------------
-- An overspent event stays in the committee's To do until what it is over by
-- is paid back. Rebuilt whole, as before: a union cannot be appended to.
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
    -- Bills waiting for the committee (not the ones the approver wrote), and
    -- a warning, before the decision, when approving one would take the event
    -- past what it collected.
    select 'bill_to_approve', x.id, x.name,
           concat_ws(' · ', x.category, x.vendor,
             case when app.event_surplus(x.event_id) < x.amount
                  then 'takes the event ' || app.money(x.amount - app.event_surplus(x.event_id))
                       || ' over what it collected'
             end),
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

    union all
    -- Events that spent more than they collected: somebody paid the difference
    -- and is owed it. The amount is what is still owed.
    select 'overspent', e.id, e.name,
           concat_ws(' · ',
             'Paid by ' || app.bill_payer(last_bill.paid_by, last_bill.requested_by),
             'society balance ' || app.money(app.society_pool(p_community_id))),
           -app.event_surplus(e.id), e.slug, e.name,
           coalesce(last_bill.approved_at, e.created_at)
      from public.events e
      cross join me
      left join lateral (
        select x.paid_by, x.requested_by, x.approved_at
          from public.expenses x
         where x.event_id = e.id and x.status = 'approved'
         order by x.approved_at desc nulls last
         limit 1
      ) last_bill on true
     where me.committee and e.community_id = p_community_id
       and e.status <> 'cancelled'
       and app.event_surplus(e.id) < 0
  ) items (kind, id, title, subtitle, amount, event_slug, event_name, created_at)
  order by created_at desc
  limit 200;
$$;

revoke all on function public.todo_items(uuid) from public;
revoke all on function public.todo_items(uuid) from anon;
grant execute on function public.todo_items(uuid) to authenticated, service_role;
