-- ============================================================================
-- Samudaya · 20260913000600 · Notifications and per-flat contributor counts
-- ----------------------------------------------------------------------------
-- Notifications are written by the database at the moment something happens,
-- so they fire the same whether the action came from the web, the phone or an
-- integration. Each row is an in-app notification; a push is then sent for it
-- by the web app's dispatch endpoint, which pg_net calls after every batch of
-- new rows (and a pg_cron sweep retries anything left unsent).
--
-- The dispatch URL and secret live in app.push_dispatch_config, set per
-- environment outside migrations. Without it (local tests, a fresh project),
-- notifications are still recorded and simply not pushed.
--
-- Contributors are now counted by flat: a payment staff record for a flat with
-- no app account counts, and two people from one flat count once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Contributors by flat
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
  select sum(c.amount) as raised,
         -- A household is a flat when we know it, otherwise the member.
         count(distinct coalesce('unit:' || c.unit_id::text, 'member:' || c.membership_id::text))
           as contributors
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

-- ---------------------------------------------------------------------------
-- Notification rows
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column pushed_at timestamptz,
  add column push_error text;

create index notifications_unpushed_idx
  on public.notifications (created_at) where pushed_at is null;

-- Active members of a community holding any of the given roles.
create or replace function app.member_user_ids(p_community uuid, p_roles public.member_role[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id
    from public.memberships m
   where m.community_id = p_community
     and m.status = 'active'
     and m.role = any (p_roles);
$$;

create or replace function app.notify(
  p_community uuid,
  p_user_ids  uuid[],
  p_kind      text,
  p_title     text,
  p_body      text,
  p_data      jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  select c.slug into v_slug from public.communities c where c.id = p_community;
  insert into public.notifications (community_id, user_id, kind, title, body, data)
  select distinct p_community, u, p_kind, left(p_title, 140), left(p_body, 400),
         p_data || jsonb_build_object('community_slug', v_slug)
    from unnest(p_user_ids) as u
   where u is not null
     -- Nobody needs a notification about their own action.
     and u is distinct from (select auth.uid());
end;
$$;

create or replace function app.money(p_amount numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select '₹' || to_char(p_amount, 'FM99,99,99,999');
$$;

create or replace function app.flat_label(p_unit uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(u.block || '-', '') || u.number from public.units u where u.id = p_unit;
$$;

-- Join requests --------------------------------------------------------------

create or replace function app.notify_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_community text;
begin
  select c.name into v_community from public.communities c where c.id = new.community_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    perform app.notify(
      new.community_id,
      array(select app.member_user_ids(new.community_id, array['staff', 'committee']::public.member_role[])),
      'join_request',
      'New join request',
      new.claimed_name || coalesce(' · Flat ' || app.flat_label(new.unit_id), ' · works for the society'),
      jsonb_build_object('screen', 'join_requests', 'request_id', new.id)
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    perform app.notify(
      new.community_id,
      array[new.user_id],
      case when new.status = 'approved' then 'join_approved' else 'join_declined' end,
      case when new.status = 'approved' then 'Welcome to ' || v_community
           else 'Your request to join ' || v_community || ' was declined' end,
      case when new.status = 'approved' then 'You can now see events, contribute and vote.'
           else coalesce(new.decline_reason, 'Contact your society committee for details.') end,
      jsonb_build_object('screen', case when new.status = 'approved' then 'home' else 'join' end)
    );
  end if;
  return null;
end;
$$;

create trigger join_requests_notify
  after insert or update of status on public.join_requests
  for each row execute function app.notify_join_request();

-- Payments -------------------------------------------------------------------

create or replace function app.notify_contribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_payer uuid;
begin
  select * into v_event from public.events e where e.id = new.event_id;
  select m.user_id into v_payer from public.memberships m where m.id = new.membership_id;

  if tg_op = 'INSERT' and new.status = 'pending' and new.membership_id is not null then
    perform app.notify(
      new.community_id,
      array(select app.member_user_ids(new.community_id, array['staff', 'committee']::public.member_role[])),
      'payment_reported',
      'Payment to confirm: ' || app.money(new.amount),
      coalesce('Flat ' || app.flat_label(new.unit_id) || ' · ', '') || v_event.name,
      jsonb_build_object('screen', 'payments', 'event_slug', v_event.slug, 'contribution_id', new.id)
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('succeeded', 'failed') then
    perform app.notify(
      new.community_id,
      array[v_payer],
      case when new.status = 'succeeded' then 'payment_confirmed' else 'payment_declined' end,
      case when new.status = 'succeeded' then 'Payment confirmed: ' || app.money(new.amount)
           else 'Payment not confirmed: ' || app.money(new.amount) end,
      case when new.status = 'succeeded' then 'Thank you for supporting ' || v_event.name || '.'
           else coalesce(new.review_note, 'Staff could not match it with the bank statement.') end,
      jsonb_build_object('screen', 'event', 'event_slug', v_event.slug)
    );
  end if;
  return null;
end;
$$;

create trigger contributions_notify
  after insert or update of status on public.contributions
  for each row execute function app.notify_contribution();

-- Bills ----------------------------------------------------------------------

create or replace function app.notify_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_requester uuid;
begin
  select * into v_event from public.events e where e.id = new.event_id;
  select m.user_id into v_requester from public.memberships m where m.id = new.requested_by;

  if new.status = 'pending'
     and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    perform app.notify(
      new.community_id,
      array(
        select u from app.member_user_ids(new.community_id, array['committee']::public.member_role[]) u
         where u is distinct from v_requester
      ),
      'bill_pending',
      'Bill to approve: ' || app.money(new.amount),
      new.name || coalesce(' · ' || new.vendor, '') || ' · ' || v_event.name,
      jsonb_build_object('screen', 'bills', 'event_slug', v_event.slug, 'expense_id', new.id)
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending'
        and new.status in ('approved', 'rejected', 'changes_requested') then
    perform app.notify(
      new.community_id,
      array[v_requester],
      'bill_' || new.status::text,
      case new.status
        when 'approved' then 'Bill approved: '
        when 'rejected' then 'Bill rejected: '
        else 'Bill sent back: ' end || new.name,
      coalesce(new.review_note, app.money(new.amount) || ' · ' || v_event.name),
      jsonb_build_object('screen', 'bills', 'event_slug', v_event.slug, 'expense_id', new.id)
    );
  end if;
  return null;
end;
$$;

create trigger expenses_notify
  after insert or update of status on public.expenses
  for each row execute function app.notify_expense();

-- Events and campaigns -------------------------------------------------------

create or replace function app.notify_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participants uuid[];
begin
  v_participants := array(
    select app.member_user_ids(new.community_id, array['resident', 'committee']::public.member_role[])
  );

  if tg_op = 'INSERT' and new.status = 'proposed' then
    perform app.notify(
      new.community_id,
      array(select app.member_user_ids(new.community_id, array['committee']::public.member_role[])),
      'campaign_proposed',
      'Campaign to review: ' || new.name,
      'Target ' || app.money(new.fund_target) || '. Approve it to open collections.',
      jsonb_build_object('screen', 'approvals', 'event_slug', new.slug)
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if old.status = 'proposed' and new.status = 'published' then
      perform app.notify(new.community_id, array[new.created_by], 'campaign_approved',
        'Your campaign was approved', new.name || ' is now open for contributions.',
        jsonb_build_object('screen', 'event', 'event_slug', new.slug));
    elsif old.status = 'proposed' and new.status = 'cancelled' then
      perform app.notify(new.community_id, array[new.created_by], 'campaign_declined',
        'Your campaign was not approved', new.name,
        jsonb_build_object('screen', 'events'));
    end if;

    if new.status = 'published' then
      perform app.notify(
        new.community_id,
        array(select u from unnest(v_participants) u where u is distinct from new.created_by or old.status <> 'proposed'),
        case when new.kind = 'campaign' then 'campaign_published' else 'event_published' end,
        case when new.kind = 'campaign' then 'New campaign: ' else 'New event: ' end || new.name,
        coalesce(to_char(new.starts_on, 'DD Mon YYYY'), '') || coalesce(' · ' || new.venue, ''),
        jsonb_build_object('screen', 'event', 'event_slug', new.slug)
      );
    end if;
  end if;
  return null;
end;
$$;

create trigger events_notify
  after insert or update of status on public.events
  for each row execute function app.notify_event();

-- Suggestions ----------------------------------------------------------------

create or replace function app.notify_suggestion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_slug text;
  v_suggester uuid;
begin
  select e.slug into v_event_slug from public.events e where e.id = new.event_id;
  select m.user_id into v_suggester from public.memberships m where m.id = new.suggested_by;

  if tg_op = 'INSERT' and new.status = 'new' then
    perform app.notify(
      new.community_id,
      array(select app.member_user_ids(new.community_id, array['committee']::public.member_role[])),
      'suggestion_new',
      'New ' || new.kind || ' suggestion',
      new.name,
      jsonb_build_object('screen', 'approvals', 'event_slug', v_event_slug, 'suggestion_id', new.id)
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'accepted' then
      perform app.notify(
        new.community_id,
        array(select app.member_user_ids(new.community_id, array['resident', 'committee']::public.member_role[])),
        'suggestion_voting',
        'Vote now: ' || new.name,
        'The committee opened this suggestion for voting.',
        jsonb_build_object('screen', 'event', 'event_slug', v_event_slug, 'suggestion_id', new.id)
      );
    elsif new.status = 'declined' then
      perform app.notify(new.community_id, array[v_suggester], 'suggestion_declined',
        'Suggestion not taken up: ' || new.name,
        coalesce(new.review_note, 'The committee decided not to go ahead with it.'),
        jsonb_build_object('screen', 'event', 'event_slug', v_event_slug));
    end if;
  end if;
  return null;
end;
$$;

create trigger activity_suggestions_notify
  after insert or update of status on public.activity_suggestions
  for each row execute function app.notify_suggestion();

-- Let a member clear their bell in one call.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications n
     set read_at = now()
   where n.user_id = (select auth.uid())
     and n.read_at is null
     and (p_ids is null or n.id = any (p_ids));
$$;

grant execute on function public.mark_notifications_read(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Push dispatch
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end
$$;

create table app.push_dispatch_config (
  id     boolean primary key default true check (id),
  url    text not null,
  secret text not null
);

revoke all on app.push_dispatch_config from public, anon, authenticated;

-- Asks the web app to send pushes for unsent notifications. Fire and forget:
-- a failure here must never roll back the action that produced the rows.
create or replace function app.request_push_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select c.url, c.secret into v_url, v_secret from app.push_dispatch_config c where c.id;
  if v_url is null or not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
    using v_url, '{}'::jsonb,
          jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret);
exception when others then
  return;
end;
$$;

create or replace function app.request_push_dispatch_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.request_push_dispatch();
  return null;
end;
$$;

create trigger notifications_request_push
  after insert on public.notifications
  for each statement execute function app.request_push_dispatch_trigger();

-- Safety net: every five minutes, retry anything the per-insert call missed.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'samudaya-push-sweep',
      '*/5 * * * *',
      $cron$select app.request_push_dispatch() where exists (
        select 1 from public.notifications where pushed_at is null
          and created_at > now() - interval '1 day')$cron$
    );
  end if;
end
$$;
