-- ============================================================================
-- Samudaya · 20260913000800 · A cheap To do count and indexes for hot paths
-- ----------------------------------------------------------------------------
-- Every signed-in page shows the To do badge and the unread bell. The badge
-- used to run todo_items() — six joined subqueries, labels and names — only to
-- count its rows. todo_count() applies the same filters without the joins.
--
-- The indexes cover the filters those two badges hit on every page view:
-- payments waiting for confirmation, bills sent back, and unread
-- notifications for one member in one society.
-- ============================================================================

create index if not exists contributions_pending_idx
  on public.contributions (community_id, created_at desc) where status = 'pending';

create index if not exists expenses_changes_requested_idx
  on public.expenses (community_id, requested_by) where status = 'changes_requested';

create index if not exists notifications_unread_community_idx
  on public.notifications (user_id, community_id) where read_at is null;

-- Must stay in step with todo_items(): same kinds, same role checks, same
-- filters. Row-level security applies because it runs with the caller's rights.
create or replace function public.todo_count(p_community_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select app.is_staff(p_community_id) as staff,
           app.is_committee(p_community_id) as committee,
           app.my_membership_id(p_community_id) as membership
  )
  select case when not me.staff then 0 else (
      (select count(*) from public.join_requests r
        where r.community_id = p_community_id and r.status = 'pending')
    + (select count(*) from public.contributions c
        where c.community_id = p_community_id and c.status = 'pending')
    + (select count(*) from public.expenses x
        where x.community_id = p_community_id and x.status = 'changes_requested'
          and x.requested_by = me.membership)
    + case when not me.committee then 0 else (
          (select count(*) from public.expenses x
            where x.community_id = p_community_id and x.status = 'pending'
              and x.requested_by is distinct from me.membership)
        + (select count(*) from public.events e
            where e.community_id = p_community_id and e.status = 'proposed')
        + (select count(*) from public.activity_suggestions s
            where s.community_id = p_community_id and s.status = 'new')
      ) end
  )::integer end
  from me;
$$;

grant execute on function public.todo_count(uuid) to authenticated, service_role;
