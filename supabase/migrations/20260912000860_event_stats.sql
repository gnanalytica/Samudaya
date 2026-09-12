-- ============================================================================
-- Samudaya · 0860 · Derived event numbers
-- ----------------------------------------------------------------------------
-- Created after the participation tables because it aggregates over them.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- event_stats — the numbers every screen shows
-- ---------------------------------------------------------------------------
-- A view rather than counter columns on `events`: totals that are recomputed
-- cannot drift out of step with the rows they summarise, and a drifting total
-- in a transparency ledger is worse than a slow one.
--
-- It runs with the definer's rights so it can aggregate over contribution rows
-- a resident may not read individually — which is exactly the point, since
-- "₹1,32,000 from 124 families" must be public while "A-101 gave ₹5,000" is
-- not. The `is_member` filter is what keeps it scoped.
create view public.event_stats
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
  coalesce(v.volunteers, 0)::integer     as volunteers
from public.events e
left join lateral (
  select sum(c.amount) as raised, count(distinct c.membership_id) as contributors
    from public.contributions c
   where c.event_id = e.id and c.status = 'succeeded'
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

