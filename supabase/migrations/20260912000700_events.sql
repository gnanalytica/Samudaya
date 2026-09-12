-- ============================================================================
-- Samudaya · 0700 · Events and their checklists
-- ----------------------------------------------------------------------------
-- The event is the organising unit of this product. Everything else — the
-- fund, the ledger, the activities, the volunteers — hangs off one.
-- ============================================================================

create table public.events (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  slug          text not null,
  emoji         text not null default '🎉',
  name          text not null,
  -- A real date, not the display string: the app formats it, and "September
  -- 14" cannot be sorted, filtered or reasoned about.
  starts_on     date not null,
  ends_on       date,
  venue         text,
  organizer     text,
  description   text,
  status        public.event_status not null default 'draft',
  expected_attendance integer,
  -- The sum of the budget lines agreed in the creation wizard.
  fund_target   numeric(12, 2) not null default 0,
  -- Fixed at creation, before any money exists, so nobody decides the fate of
  -- a surplus after seeing how large it is.
  fund_rule     public.fund_rule not null default 'general_fund',
  fund_rule_note text,
  published_at  timestamptz,
  closed_at     timestamptz,
  -- Written once at closure so the report cannot drift if rows change later.
  closing_summary jsonb,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint events_name_not_blank check (length(btrim(name)) > 0),
  constraint events_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  constraint events_fund_target_non_negative check (fund_target >= 0),
  constraint events_dates check (ends_on is null or ends_on >= starts_on),
  unique (community_id, slug)
);

create index events_community_idx on public.events (community_id, starts_on desc);
create index events_status_idx on public.events (community_id, status);

create trigger events_touch_updated_at
  before update on public.events
  for each row execute function app.touch_updated_at();

-- Publishing is the moment an event becomes real to residents, so stamp it
-- rather than relying on every caller to remember.
create or replace function app.stamp_event_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'published' and new.published_at is null then
      new.published_at := now();
    elsif new.status = 'completed' and new.closed_at is null then
      new.closed_at := now();
    elsif new.status in ('draft', 'cancelled') then
      new.closed_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger events_stamp_status
  before update on public.events
  for each row execute function app.stamp_event_status();

-- Announcements can hang off an event (declared in 0600 without the FK so the
-- tables could be created in either order).
alter table public.announcements
  add constraint announcements_event_id_fkey
  foreign key (event_id) references public.events (id) on delete cascade;

create index announcements_event_idx
  on public.announcements (event_id) where event_id is not null;

-- ---------------------------------------------------------------------------
-- event_tasks — the checklist that drives "Readiness %"
-- ---------------------------------------------------------------------------
create table public.event_tasks (
  id            uuid primary key default extensions.gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  name          text not null,
  notes         text,
  status        public.task_status not null default 'todo',
  assignee_id   uuid references public.memberships (id) on delete set null,
  due_on        date,
  position      integer not null default 0,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint event_tasks_name_not_blank check (length(btrim(name)) > 0)
);

create index event_tasks_event_idx on public.event_tasks (event_id, position, created_at);
create index event_tasks_assignee_idx
  on public.event_tasks (assignee_id) where assignee_id is not null;

create trigger event_tasks_touch_updated_at
  before update on public.event_tasks
  for each row execute function app.touch_updated_at();

create or replace function app.stamp_task_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    -- Reopening a task clears the stamp, so readiness history stays truthful.
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger event_tasks_stamp_completion
  before insert or update on public.event_tasks
  for each row execute function app.stamp_task_completion();

-- Keeping community_id on the child avoids a join in every RLS policy, but it
-- then has to be kept honest.
create or replace function app.inherit_event_community()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_community uuid;
begin
  select e.community_id into v_community from public.events e where e.id = new.event_id;
  if v_community is null then
    raise exception 'No such event' using errcode = '23503';
  end if;
  new.community_id := v_community;
  return new;
end;
$$;

create trigger event_tasks_inherit_community
  before insert or update of event_id on public.event_tasks
  for each row execute function app.inherit_event_community();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.events      enable row level security;
alter table public.event_tasks enable row level security;

-- A draft is the committee's working copy. Residents see an event the moment
-- it is published, and never before.
create policy events_select_member
  on public.events for select to authenticated
  using (
    app.is_member(community_id)
    and (status <> 'draft' or app.is_committee(community_id))
  );

create policy events_write_committee
  on public.events for all to authenticated
  using (app.is_committee(community_id))
  with check (app.is_committee(community_id));

-- Only an admin may publish, close or cancel — a committee member can prepare
-- an event but not put it in front of the whole society.
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
  if new.status is distinct from old.status and not app.is_admin(new.community_id) then
    raise exception 'Only a community admin can change an event''s status'
      using errcode = '42501';
  end if;
  -- A closed event is a published record. Reopening it would let the ledger
  -- change under a report residents have already read.
  if old.status = 'completed' and new.status <> 'completed'
     and not app.is_platform_admin() then
    raise exception 'A closed event cannot be reopened'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger events_guard_status
  before update on public.events
  for each row execute function app.guard_event_status();

create policy event_tasks_select_member
  on public.event_tasks for select to authenticated
  using (app.is_member(community_id));

-- Residents watch the checklist; the committee works it.
create policy event_tasks_write_committee
  on public.event_tasks for all to authenticated
  using (app.is_committee(community_id))
  with check (app.is_committee(community_id));
