-- ============================================================================
-- Samudaya · 0850 · Taking part: cultural activities and volunteering
-- ----------------------------------------------------------------------------
-- The difference between an event people attend and one they own.
-- ============================================================================

create table public.event_activities (
  id            uuid primary key default extensions.gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  name          text not null,
  emoji         text not null default '🎭',
  description   text,
  coordinator_id uuid references public.memberships (id) on delete set null,
  -- Rehearsal dates, in order. An array because they are shown as a list and
  -- never queried individually.
  practice_dates date[] not null default '{}',
  -- Null means no cap; the UI shows "N interested" rather than "N of M".
  capacity      integer,
  is_open       boolean not null default true,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint event_activities_name_not_blank check (length(btrim(name)) > 0),
  constraint event_activities_capacity_positive check (capacity is null or capacity > 0),
  unique (event_id, name)
);

create index event_activities_event_idx on public.event_activities (event_id, position);

create trigger event_activities_touch_updated_at
  before update on public.event_activities
  for each row execute function app.touch_updated_at();

create trigger event_activities_inherit_community
  before insert or update of event_id on public.event_activities
  for each row execute function app.inherit_event_community();

create table public.activity_participants (
  id            uuid primary key default extensions.gen_random_uuid(),
  activity_id   uuid not null references public.event_activities (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  -- The follow-up details the prototype collects after someone signs up.
  performance_type text,
  age_group     text,
  experience    text,
  special_requirements text,
  channel       public.origin_channel not null default 'web',
  joined_at     timestamptz not null default now(),
  -- Signing up twice is a double tap, not a second performer.
  constraint activity_participants_unique unique (activity_id, membership_id)
);

create index activity_participants_membership_idx
  on public.activity_participants (membership_id);

-- ---------------------------------------------------------------------------
-- Volunteering
-- ---------------------------------------------------------------------------
create table public.volunteer_roles (
  id            uuid primary key default extensions.gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  name          text not null,
  emoji         text not null default '🙋',
  description   text,
  -- How many people this job needs in total. "N more needed" is this minus
  -- the sign-ups, computed on read — storing a countdown invites it to drift.
  target_count  integer not null default 1,
  coordinator_id uuid references public.memberships (id) on delete set null,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint volunteer_roles_name_not_blank check (length(btrim(name)) > 0),
  constraint volunteer_roles_target_positive check (target_count > 0),
  unique (event_id, name)
);

create index volunteer_roles_event_idx on public.volunteer_roles (event_id, position);

create trigger volunteer_roles_touch_updated_at
  before update on public.volunteer_roles
  for each row execute function app.touch_updated_at();

create trigger volunteer_roles_inherit_community
  before insert or update of event_id on public.volunteer_roles
  for each row execute function app.inherit_event_community();

create table public.event_volunteers (
  id            uuid primary key default extensions.gen_random_uuid(),
  role_id       uuid not null references public.volunteer_roles (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  note          text,
  channel       public.origin_channel not null default 'web',
  signed_up_at  timestamptz not null default now(),
  constraint event_volunteers_unique unique (role_id, membership_id)
);

create index event_volunteers_membership_idx on public.event_volunteers (membership_id);

-- ---------------------------------------------------------------------------
-- Counts every screen shows, aggregated past RLS on the join rows
-- ---------------------------------------------------------------------------
create view public.activity_stats
with (security_invoker = false) as
select a.id as activity_id, a.event_id, a.community_id,
       count(p.id)::integer as interested
  from public.event_activities a
  left join public.activity_participants p on p.activity_id = a.id
 where app.is_member(a.community_id)
 group by a.id, a.event_id, a.community_id;

grant select on public.activity_stats to authenticated, service_role;

create view public.volunteer_role_stats
with (security_invoker = false) as
select r.id as role_id, r.event_id, r.community_id, r.target_count,
       count(v.id)::integer as signed_up,
       greatest(r.target_count - count(v.id), 0)::integer as still_needed
  from public.volunteer_roles r
  left join public.event_volunteers v on v.role_id = r.id
 where app.is_member(r.community_id)
 group by r.id, r.event_id, r.community_id, r.target_count;

grant select on public.volunteer_role_stats to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.event_activities      enable row level security;
alter table public.activity_participants enable row level security;
alter table public.volunteer_roles       enable row level security;
alter table public.event_volunteers      enable row level security;

create policy event_activities_select_member
  on public.event_activities for select to authenticated
  using (app.is_member(community_id));

create policy event_activities_write_committee
  on public.event_activities for all to authenticated
  using (app.is_committee(community_id))
  with check (app.is_committee(community_id));

-- Who else signed up is visible to the community: people join a dance because
-- their neighbours are in it, and the coordinator needs the list.
create policy activity_participants_select_member
  on public.activity_participants for select to authenticated
  using (
    exists (
      select 1 from public.event_activities a
       where a.id = activity_participants.activity_id and app.is_member(a.community_id)
    )
  );

create policy activity_participants_join_self
  on public.activity_participants for insert to authenticated
  with check (
    exists (
      select 1 from public.event_activities a
       join public.events e on e.id = a.event_id
       where a.id = activity_participants.activity_id
         and a.is_open
         and e.status = 'published'
         and activity_participants.membership_id = app.my_membership_id(a.community_id)
    )
  );

-- You can edit or withdraw your own sign-up; a coordinator can manage anyone's.
create policy activity_participants_update_own_or_staff
  on public.activity_participants for update to authenticated
  using (
    exists (
      select 1 from public.event_activities a
       where a.id = activity_participants.activity_id
         and (
           app.is_committee(a.community_id)
           or activity_participants.membership_id = app.my_membership_id(a.community_id)
         )
    )
  )
  with check (
    exists (
      select 1 from public.event_activities a
       where a.id = activity_participants.activity_id
         and (
           app.is_committee(a.community_id)
           or activity_participants.membership_id = app.my_membership_id(a.community_id)
         )
    )
  );

create policy activity_participants_leave_own_or_staff
  on public.activity_participants for delete to authenticated
  using (
    exists (
      select 1 from public.event_activities a
       where a.id = activity_participants.activity_id
         and (
           app.is_committee(a.community_id)
           or activity_participants.membership_id = app.my_membership_id(a.community_id)
         )
    )
  );

create policy volunteer_roles_select_member
  on public.volunteer_roles for select to authenticated
  using (app.is_member(community_id));

create policy volunteer_roles_write_committee
  on public.volunteer_roles for all to authenticated
  using (app.is_committee(community_id))
  with check (app.is_committee(community_id));

create policy event_volunteers_select_member
  on public.event_volunteers for select to authenticated
  using (
    exists (
      select 1 from public.volunteer_roles r
       where r.id = event_volunteers.role_id and app.is_member(r.community_id)
    )
  );

create policy event_volunteers_join_self
  on public.event_volunteers for insert to authenticated
  with check (
    exists (
      select 1 from public.volunteer_roles r
       join public.events e on e.id = r.event_id
       where r.id = event_volunteers.role_id
         and e.status = 'published'
         and event_volunteers.membership_id = app.my_membership_id(r.community_id)
    )
  );

create policy event_volunteers_leave_own_or_staff
  on public.event_volunteers for delete to authenticated
  using (
    exists (
      select 1 from public.volunteer_roles r
       where r.id = event_volunteers.role_id
         and (
           app.is_committee(r.community_id)
           or event_volunteers.membership_id = app.my_membership_id(r.community_id)
         )
    )
  );
