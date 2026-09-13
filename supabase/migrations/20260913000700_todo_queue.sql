-- ============================================================================
-- Samudaya · 20260913000700 · One "To do" queue per role
-- ----------------------------------------------------------------------------
-- Staff and committee used to hunt event by event for things waiting on them.
-- todo_items() returns everything the caller can act on right now, across all
-- events, newest first:
--
--   staff and committee   join requests, UPI payments to confirm,
--                         their own bills that were sent back
--   committee only        bills to approve, proposed campaigns,
--                         new suggestions
--
-- It runs with the caller's rights, so row-level security still decides what
-- each row reveals; the role checks only decide what counts as a task.
-- ============================================================================

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
           app.my_membership_id(p_community_id) as membership
  )
  select * from (
    -- Join requests
    select 'join_request'::text, r.id, r.claimed_name,
           coalesce('Flat ' || app.flat_label(r.unit_id), 'Works for the society'),
           null::numeric, null::text, null::text, r.created_at
      from public.join_requests r, me
     where me.staff and r.community_id = p_community_id and r.status = 'pending'

    union all
    -- UPI payments residents reported
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

    union all
    -- Bills waiting for the committee (not the approver's own)
    select 'bill_to_approve', x.id, x.name,
           concat_ws(' · ', x.category, x.vendor),
           x.amount, e.slug, e.name, x.created_at
      from public.expenses x
      join public.events e on e.id = x.event_id
      cross join me
     where me.committee and x.community_id = p_community_id and x.status = 'pending'
       and x.requested_by is distinct from me.membership

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
  ) items (kind, id, title, subtitle, amount, event_slug, event_name, created_at)
  order by created_at desc
  limit 200;
$$;

grant execute on function public.todo_items(uuid) to authenticated, service_role;
