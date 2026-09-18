-- ============================================================================
-- Samudaya · 0920.1200 · Money on its way, and what to ask each flat for
-- ----------------------------------------------------------------------------
-- Two changes to the same moment: a resident paying for an event.
--
-- 1 · Money on its way
--
-- A resident pays, reports it, and the fund bar does not move — because
-- fund_raised counts confirmed contributions only, and confirmation waits for
-- staff to match it against the bank statement. That rule is right and is not
-- changing: the whole product is worth less if the headline total is a total
-- of claims.
--
-- But the resident is left with nothing to show for it at exactly the moment
-- they did the thing we asked, and the bar they were looking at is the reason
-- they did it. So the view now also reports what has been reported and not yet
-- confirmed, as its own number, for the screens to draw as its own segment.
-- Two numbers side by side is honest; one number that quietly includes both is
-- what we are avoiding.
--
-- Counted by flat, the same way contributors already is: a household that pays
-- twice is one household waiting.
--
-- 2 · What to ask each flat for
--
-- The contribute screen offered ₹500 / ₹1,001 / ₹2,001 / ₹5,001 on the web and
-- ₹1,001 / ₹2,001 / ₹5,001 on the phone — hardcoded, inconsistent with each
-- other, and unrelated to the event. Societies do not work that way. They
-- decide a figure — "₹2,100 per flat this year" — and that figure is the ask.
--
-- So the event carries it, set beside the budget that produced it, and both
-- apps offer it instead of guessing. Null means the committee has not named
-- one, and the generic ladder stands in.
-- ============================================================================

alter table public.events
  add column if not exists suggested_amount numeric(12, 2);

alter table public.events
  drop constraint if exists events_suggested_amount_positive;

alter table public.events
  add constraint events_suggested_amount_positive
  check (suggested_amount is null or suggested_amount > 0);

comment on column public.events.suggested_amount is
  'What the committee asks each flat to contribute, in the community currency. '
  'Null means they have not named a figure; it is a suggestion either way, and '
  'the resident can pay anything.';

-- ---------------------------------------------------------------------------
-- event_stats, with the money that is on its way
-- ---------------------------------------------------------------------------
-- Appended rather than slotted in beside fund_raised: `create or replace view`
-- will not reorder existing columns, and every caller selects by name anyway.
create or replace view public.event_stats
with (security_invoker = false) as
select
  e.id                                as event_id,
  e.community_id,
  e.fund_target,
  coalesce(f.raised, 0)::numeric(12,2)   as fund_raised,
  coalesce(f.contributors, 0)::integer   as contributors,
  coalesce(x.spent, 0)::numeric(12,2)    as spent,
  (coalesce(f.raised, 0) - coalesce(x.spent, 0))::numeric(12,2) as available,
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
  coalesce(f.pending_contributors, 0)::integer as pending_contributors
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
  'money only; fund_pending is what has been reported and not yet matched '
  'against the bank, and the two are never added together.';
