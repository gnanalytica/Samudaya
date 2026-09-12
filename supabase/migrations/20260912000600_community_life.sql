-- ============================================================================
-- Samudaya · 0600 · Announcements and service requests
-- ============================================================================

-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------
create table public.announcements (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  author_id     uuid references public.memberships (id) on delete set null,
  title         text not null,
  body          text not null,
  audience      public.announcement_audience not null default 'all',
  is_pinned     boolean not null default false,
  published_at  timestamptz not null default now(),
  expires_at    timestamptz,
  attachments   jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint announcements_title_not_blank check (length(btrim(title)) > 0),
  constraint announcements_window check (expires_at is null or expires_at > published_at)
);

create index announcements_feed_idx
  on public.announcements (community_id, is_pinned desc, published_at desc);

create trigger announcements_touch_updated_at
  before update on public.announcements
  for each row execute function app.touch_updated_at();

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  membership_id   uuid not null references public.memberships (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, membership_id)
);

-- Decides whether a given role is in an announcement's audience.
create or replace function app.audience_matches(
  p_audience public.announcement_audience,
  p_role     public.member_role
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_audience
    when 'all'       then true
    when 'residents' then p_role in ('resident', 'committee', 'admin', 'owner')
    when 'owners'    then p_role in ('resident', 'committee', 'admin', 'owner')
    when 'committee' then p_role in ('committee', 'admin', 'owner')
    when 'staff'     then p_role in ('security', 'admin', 'owner')
  end;
$$;

grant execute on function app.audience_matches(public.announcement_audience, public.member_role)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- service_requests — complaints, maintenance tickets, helpdesk
-- ---------------------------------------------------------------------------
create sequence public.service_request_ticket_seq;

create table public.service_requests (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  -- Global sequence rather than a per-community counter: numbering stays
  -- race-free without row locks, and residents only ever see their own.
  ticket_no     bigint not null default nextval('public.service_request_ticket_seq'),
  unit_id       uuid references public.units (id) on delete set null,
  raised_by     uuid references public.memberships (id) on delete set null,
  assigned_to   uuid references public.memberships (id) on delete set null,
  category      public.request_category not null default 'other',
  priority      public.request_priority not null default 'normal',
  status        public.request_status not null default 'open',
  title         text not null,
  description   text,
  attachments   jsonb not null default '[]'::jsonb,
  channel       public.origin_channel not null default 'web',
  acknowledged_at timestamptz,
  resolved_at   timestamptz,
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint service_requests_title_not_blank check (length(btrim(title)) > 0)
);

create unique index service_requests_ticket_no_key on public.service_requests (ticket_no);
create index service_requests_community_status_idx
  on public.service_requests (community_id, status, created_at desc);
create index service_requests_raised_by_idx on public.service_requests (raised_by);
create index service_requests_assigned_idx
  on public.service_requests (assigned_to) where assigned_to is not null;

create trigger service_requests_touch_updated_at
  before update on public.service_requests
  for each row execute function app.touch_updated_at();

-- Keep the lifecycle timestamps consistent with status without making every
-- caller remember to set them.
create or replace function app.stamp_request_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'acknowledged' and new.acknowledged_at is null then
      new.acknowledged_at := now();
    elsif new.status = 'resolved' and new.resolved_at is null then
      new.resolved_at := now();
    elsif new.status in ('closed', 'rejected') and new.closed_at is null then
      new.closed_at := now();
    end if;
    -- Reopening clears the terminal stamps so SLA reporting stays truthful.
    if new.status in ('open', 'in_progress') then
      new.resolved_at := null;
      new.closed_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger service_requests_stamp_status
  before update on public.service_requests
  for each row execute function app.stamp_request_status();

create table public.service_request_comments (
  id           uuid primary key default extensions.gen_random_uuid(),
  request_id   uuid not null references public.service_requests (id) on delete cascade,
  author_id    uuid references public.memberships (id) on delete set null,
  body         text not null,
  -- Internal notes are visible to staff only, never to the resident.
  is_internal  boolean not null default false,
  channel      public.origin_channel not null default 'web',
  created_at   timestamptz not null default now(),
  constraint service_request_comments_body_not_blank check (length(btrim(body)) > 0)
);

create index service_request_comments_request_idx
  on public.service_request_comments (request_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.announcements            enable row level security;
alter table public.announcement_reads       enable row level security;
alter table public.service_requests         enable row level security;
alter table public.service_request_comments enable row level security;

create policy announcements_select_audience
  on public.announcements for select to authenticated
  using (
    app.is_member(community_id)
    and app.audience_matches(audience, coalesce(app.member_role_in(community_id), 'resident'))
    and (expires_at is null or expires_at > now())
    and published_at <= now()
  );

-- Committee members and above can post; residents cannot.
create policy announcements_write_committee
  on public.announcements for all to authenticated
  using (app.has_role_at_least(community_id, 'committee'))
  with check (app.has_role_at_least(community_id, 'committee'));

create policy announcement_reads_own
  on public.announcement_reads for all to authenticated
  using (
    exists (
      select 1 from public.memberships m
       where m.id = announcement_reads.membership_id
         and m.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
       where m.id = announcement_reads.membership_id
         and m.user_id = (select auth.uid())
    )
  );

-- A resident sees the tickets they raised plus anything filed against a unit
-- they occupy. Committee and above see everything in the community.
create policy service_requests_select_own_or_staff
  on public.service_requests for select to authenticated
  using (
    app.has_role_at_least(community_id, 'committee')
    or raised_by = app.my_membership_id(community_id)
    or assigned_to = app.my_membership_id(community_id)
    or (unit_id is not null and unit_id in (select app.my_unit_ids(community_id)))
  );

create policy service_requests_insert_member
  on public.service_requests for insert to authenticated
  with check (
    app.is_member(community_id)
    and raised_by = app.my_membership_id(community_id)
  );

-- Residents may edit their own ticket only while it is still open; staff may
-- always work it.
create policy service_requests_update_own_or_staff
  on public.service_requests for update to authenticated
  using (
    app.has_role_at_least(community_id, 'committee')
    or (raised_by = app.my_membership_id(community_id) and status in ('open', 'acknowledged'))
  )
  with check (
    app.has_role_at_least(community_id, 'committee')
    or raised_by = app.my_membership_id(community_id)
  );

create policy service_requests_delete_admin
  on public.service_requests for delete to authenticated
  using (app.is_admin(community_id));

create policy service_request_comments_select
  on public.service_request_comments for select to authenticated
  using (
    exists (
      select 1 from public.service_requests r
       where r.id = service_request_comments.request_id
         and (
           app.has_role_at_least(r.community_id, 'committee')
           or (
             not service_request_comments.is_internal
             and (
               r.raised_by = app.my_membership_id(r.community_id)
               or r.assigned_to = app.my_membership_id(r.community_id)
               or (r.unit_id is not null and r.unit_id in (select app.my_unit_ids(r.community_id)))
             )
           )
         )
    )
  );

create policy service_request_comments_insert
  on public.service_request_comments for insert to authenticated
  with check (
    exists (
      select 1 from public.service_requests r
       where r.id = service_request_comments.request_id
         and app.is_member(r.community_id)
         and service_request_comments.author_id = app.my_membership_id(r.community_id)
         -- only staff may write an internal note
         and (
           not service_request_comments.is_internal
           or app.has_role_at_least(r.community_id, 'committee')
         )
    )
  );
