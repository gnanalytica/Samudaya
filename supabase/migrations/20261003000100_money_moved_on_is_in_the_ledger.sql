-- ============================================================================
-- Money moved on is in the ledger
-- ============================================================================
-- When an event closes with money left, the committee keeps it for the
-- society or puts it behind another event. That decision was recorded — a
-- fund_movements row, a notification to everybody — but the ledger never
-- showed it. Pick Velocity Vipers on the Money page and the list read:
-- ₹2,37,500 in, ₹2,00,000 out, and nothing to say where the other ₹44,490
-- went, or where the ₹6,990 it started with came from. A ledger that does not
-- add up to what the event holds is the thing this app exists to replace.
--
-- So every movement is in the ledger now, as two rows: one on the side the
-- money left (an event, or the society balance) and one on the side it
-- arrived. An event's rows add up to what it holds; the society balance's
-- rows add up to what it holds. Society-wide, the two rows cancel, and the
-- totals leave them out: carrying money from one event to the next is not
-- money collected, and keeping it is not money spent.
--
-- The event's own numbers had the same blind spot from the other side.
-- event_stats carried one figure, carried in less moved out, so an event that
-- received ₹6,990 and later handed on ₹44,490 read as "−₹37,500 carried" —
-- the ₹6,990 vanished from what it collected and the ₹44,490 shrank. Both
-- figures are their own columns now; the net one stays for whatever still
-- reads it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- An event's numbers: carried in and moved on, separately
-- ---------------------------------------------------------------------------

create or replace view public.event_stats
with (security_invoker = false) as
select
  e.id                                as event_id,
  e.community_id,
  e.fund_target,
  coalesce(f.raised, 0)::numeric(12,2)   as fund_raised,
  coalesce(f.contributors, 0)::integer   as contributors,
  coalesce(x.spent, 0)::numeric(12,2)    as spent,
  (coalesce(f.raised, 0) + coalesce(mv.carried_in, 0) - coalesce(mv.moved_out, 0)
     - coalesce(x.spent, 0))::numeric(12,2)
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
  -- Moved across by the committee, net of anything moved on again. Kept for
  -- the screens that already read it; the two below are what it is made of.
  (coalesce(mv.carried_in, 0) - coalesce(mv.moved_out, 0))::numeric(12,2) as fund_carried,
  -- Carried into the event: a closed event's leftover, money from the society
  -- balance, or an overspend the society paid back.
  coalesce(mv.carried_in, 0)::numeric(12,2) as fund_carried_in,
  -- Handed on after it closed: kept for the society, or put behind another event.
  coalesce(mv.moved_out, 0)::numeric(12,2)  as fund_moved_out
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
  select coalesce(sum(m.amount) filter (where m.to_event_id = e.id), 0)   as carried_in,
         coalesce(sum(m.amount) filter (where m.from_event_id = e.id), 0) as moved_out
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

comment on view public.event_stats is
  'Every derived number a screen shows for an event. fund_raised is confirmed '
  'contributions only; fund_pending is what has been reported and not yet '
  'matched against the bank; fund_carried_in is money the committee moved in '
  'from another event or the society balance, and fund_moved_out is what the '
  'event handed on after it closed (fund_carried is the two netted). None of '
  'them is ever added to another.';

comment on column public.event_stats.fund_carried_in is
  'Money carried into the event, gross: a closed event''s leftover, money from '
  'the society balance, or an overspend the society paid back.';
comment on column public.event_stats.fund_moved_out is
  'Money the event handed on after it closed, gross: kept for the society or '
  'put behind another event.';

-- ---------------------------------------------------------------------------
-- The ledger, with every movement in it
-- ---------------------------------------------------------------------------
-- A fourth kind of row, two per movement. `kind` says which of the four a row
-- is, so a screen can leave the movements out of a society-wide list (where
-- the two rows of one decision cancel) and keep them in an event's.
--
-- An event a resident cannot see yet — a draft — is not named to them. Its
-- rows keep their event_id, so they still add up, and lose the name and slug.

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
),
-- Every movement with both of its ends named, as far as the reader may see
-- them, and in the words both of its rows use.
moves as (
  select
    m.id,
    m.community_id,
    m.from_event_id,
    m.to_event_id,
    m.amount,
    m.decided_at,
    m.proof_path,
    d.full_name                                      as decided_by_name,
    -- A draft is staff's until it is published.
    (fe.status = 'draft' and not app.is_staff(m.community_id)) as from_hidden,
    (te.status = 'draft' and not app.is_staff(m.community_id)) as to_hidden,
    fe.slug                                          as from_slug,
    fe.name                                          as from_name,
    te.slug                                          as to_slug,
    te.name                                          as to_name,
    case
      when m.paid_to is not null then 'Overspend paid back to ' || m.paid_to
      when m.kind = 'society_balance' then 'Kept for the society'
      when m.kind = 'from_balance' then 'From the society balance'
      else 'Carried forward'
    end                                              as what
    from public.fund_movements m
    left join public.events fe on fe.id = m.from_event_id
    left join public.events te on te.id = m.to_event_id
    left join public.memberships dm on dm.id = m.decided_by
    left join public.profiles d on d.id = dm.user_id
   where app.is_member(m.community_id)
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
  c.method_label                       as method,
  'payment'::text                      as kind
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
  null::text,
  'bill'::text
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
  null::text,
  'society_spending'::text
  from public.society_expenses s
  left join public.memberships rm on rm.id = s.recorded_by
  left join public.profiles r on r.id = rm.user_id
 where app.is_member(s.community_id)

union all

-- Where a movement left: the closed event, or the society balance when the
-- committee put some of it behind an event. Named after where it went.
select
  ('moved-out:' || mv.id::text),
  mv.community_id,
  mv.from_event_id,
  case when mv.from_hidden then null else mv.from_slug end,
  case when mv.from_hidden then null else mv.from_name end,
  'out'::text,
  mv.decided_at,
  -mv.amount,
  case
    when mv.to_event_id is null then 'Society balance'
    when mv.to_hidden then 'An event not published yet'
    else mv.to_name
  end,
  case when mv.what = 'From the society balance' then 'Put behind the event' else mv.what end,
  null::bigint,
  mv.proof_path,
  mv.decided_by_name,
  mv.decided_at,
  null::uuid,
  null::text,
  null::text,
  null::text,
  'transfer'::text
  from moves mv

union all

-- Where it arrived: another event, or the society balance. Named after where
-- it came from. `method` repeats the detail, which is what a ledger written
-- before this column existed prints under a row coming in.
select
  ('moved-in:' || mv.id::text),
  mv.community_id,
  mv.to_event_id,
  case when mv.to_hidden then null else mv.to_slug end,
  case when mv.to_hidden then null else mv.to_name end,
  'in'::text,
  mv.decided_at,
  mv.amount,
  case
    when mv.from_event_id is null then 'Society balance'
    when mv.from_hidden then 'An event not published yet'
    else mv.from_name
  end,
  case when mv.what = 'Carried forward' then 'Carried in' else mv.what end,
  null::bigint,
  mv.proof_path,
  mv.decided_by_name,
  mv.decided_at,
  null::uuid,
  null::text,
  null::text,
  case when mv.what = 'Carried forward' then 'Carried in' else mv.what end,
  'transfer'::text
  from moves mv;

comment on column public.society_ledger.unit_label is
  'The flat: the one recorded on the payment, else the payer''s at the time, '
  'else where they live now. Null for money out.';

comment on column public.society_ledger.event_id is
  'The event the money came in for or went out of. Null for the society '
  'balance''s own rows: its spending, and money moved into or out of it.';

comment on column public.society_ledger.kind is
  'payment (money in from a resident), bill (an approved bill), '
  'society_spending (spent from the society balance) or transfer (one side '
  'of money the committee moved between events and the society balance). '
  'The two sides of a transfer cancel, so society-wide totals leave them out.';

-- ---------------------------------------------------------------------------
-- Society-wide totals, without the movements
-- ---------------------------------------------------------------------------
-- Each movement's two rows cancel in the balance, but counted as money in and
-- money out they would make every carried rupee look collected twice.

create or replace view public.society_money
with (security_invoker = false) as
select
  c.id                                   as community_id,
  coalesce(sum(l.amount) filter (where l.direction = 'in' and l.kind <> 'transfer'), 0)::numeric(14,2)
                                                                               as total_in,
  coalesce(-sum(l.amount) filter (where l.direction = 'out' and l.kind <> 'transfer'), 0)::numeric(14,2)
                                                                               as total_out,
  coalesce(sum(l.amount) filter (where l.kind <> 'transfer'), 0)::numeric(14,2) as balance,
  count(*) filter (where l.direction = 'in' and l.kind <> 'transfer')::integer  as payments_in,
  count(*) filter (where l.direction = 'out' and l.kind <> 'transfer')::integer as payments_out,
  -- A movement is still a movement: the committee closing an event and
  -- keeping its leftover is the last thing that happened to the money.
  max(l.happened_at)                                                           as last_movement_at
  from public.communities c
  left join public.society_ledger l on l.community_id = c.id
 where app.is_member(c.id)
 group by c.id;

comment on view public.society_money is
  'Society-wide totals over society_ledger: in, out, and what is left. Money '
  'moved between events and the society balance is in neither total.';
