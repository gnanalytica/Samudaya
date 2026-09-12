-- ============================================================================
-- Samudaya · 0600 · Announcements
-- ----------------------------------------------------------------------------
-- Committee notices. These are one of the card types in the community feed;
-- the rest of the feed is assembled from activity suggestions, volunteer gaps
-- and open polls rather than stored as rows.
-- ============================================================================

create table public.announcements (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  -- Null when the author's membership is later removed; the notice stays.
  author_id     uuid references public.memberships (id) on delete set null,
  -- Notices can hang off an event, which is how "Sound system confirmed for
  -- Ganesh Chaturthi" reaches only the people following that event.
  event_id      uuid,
  title         text not null,
  body          text not null,
  audience      public.announcement_audience not null default 'all',
  is_pinned     boolean not null default false,
  published_at  timestamptz not null default now(),
  expires_at    timestamptz,
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
    when 'residents' then true
    when 'committee' then p_role in ('committee', 'admin', 'owner')
  end;
$$;

grant execute on function app.audience_matches(public.announcement_audience, public.member_role)
  to authenticated, service_role;

alter table public.announcements      enable row level security;
alter table public.announcement_reads enable row level security;

create policy announcements_select_audience
  on public.announcements for select to authenticated
  using (
    app.is_member(community_id)
    and app.audience_matches(audience, coalesce(app.member_role_in(community_id), 'resident'))
    and (expires_at is null or expires_at > now())
    and published_at <= now()
  );

-- A `for all` policy also covers SELECT, so committee and above additionally
-- see scheduled and expired notices. That is what an admin console needs; the
-- resident feed filters by date in the query.
create policy announcements_write_committee
  on public.announcements for all to authenticated
  using (app.is_committee(community_id))
  with check (app.is_committee(community_id));

create policy announcement_reads_own
  on public.announcement_reads for all to authenticated
  using (
    exists (
      select 1 from public.memberships m
       where m.id = announcement_reads.membership_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
       where m.id = announcement_reads.membership_id and m.user_id = (select auth.uid())
    )
  );
