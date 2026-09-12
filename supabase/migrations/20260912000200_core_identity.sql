-- ============================================================================
-- Samudaya · 0200 · Communities, profiles, memberships, units
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user, created automatically on signup.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  email         extensions.citext,
  phone         text,
  avatar_url    text,
  locale        text not null default 'en',
  -- Platform staff. Deliberately not settable through the API: only the
  -- service role can flip this, and RLS on profiles forbids self-promotion.
  is_platform_admin boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_phone_e164 check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$')
);

create index profiles_phone_idx on public.profiles (phone) where phone is not null;
create index profiles_email_idx on public.profiles (email) where email is not null;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function app.touch_updated_at();

-- Mirror a new auth user into profiles. SECURITY DEFINER because the trigger
-- runs as the auth service, which has no rights on public.profiles.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, phone, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    nullif(new.email, ''),
    nullif(new.phone, ''),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do update
    set full_name  = coalesce(public.profiles.full_name, excluded.full_name),
        email      = coalesce(excluded.email, public.profiles.email),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- Keep email/phone in sync when the user changes them in auth.
create or replace function app.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = nullif(new.email, ''),
         phone = nullif(new.phone, '')
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, phone on auth.users
  for each row execute function app.handle_user_updated();

-- ---------------------------------------------------------------------------
-- communities — the tenant boundary. Every domain row hangs off one of these.
-- ---------------------------------------------------------------------------
create table public.communities (
  id              uuid primary key default extensions.gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  address_line1   text,
  address_line2   text,
  city            text,
  state           text,
  postal_code     text,
  country         text not null default 'IN',
  timezone        text not null default 'Asia/Kolkata',
  currency        char(3) not null default 'INR',
  logo_url        text,
  -- Free-form per-community switches (feature flags, gate settings, etc).
  settings        jsonb not null default '{}'::jsonb,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint communities_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')
);

create trigger communities_touch_updated_at
  before update on public.communities
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- units — a flat / villa / shop inside a community.
-- ---------------------------------------------------------------------------
create table public.units (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  block         text,
  number        text not null,
  floor         integer,
  bedrooms      integer,
  area_sqft     numeric(10, 2),
  -- Used as the default maintenance charge when generating invoices.
  monthly_dues  numeric(12, 2) not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint units_number_not_blank check (length(btrim(number)) > 0),
  constraint units_monthly_dues_non_negative check (monthly_dues >= 0)
);

-- A unit label is unique within a community. COALESCE keeps communities that
-- do not use blocks working, since NULL <> NULL would defeat the constraint.
create unique index units_community_label_key
  on public.units (community_id, coalesce(block, ''), number);
create index units_community_idx on public.units (community_id);

create trigger units_touch_updated_at
  before update on public.units
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- memberships — user ↔ community, carrying the role.
-- ---------------------------------------------------------------------------
create table public.memberships (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  role          public.member_role not null default 'resident',
  status        public.membership_status not null default 'active',
  -- Which invite code let this person in (null for the founding owner).
  invited_via   uuid,
  joined_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (community_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);
create index memberships_community_role_idx on public.memberships (community_id, role);

create trigger memberships_touch_updated_at
  before update on public.memberships
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- unit_occupants — who lives in which unit, and how.
-- ---------------------------------------------------------------------------
create table public.unit_occupants (
  id            uuid primary key default extensions.gen_random_uuid(),
  unit_id       uuid not null references public.units (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  relation      public.occupant_relation not null default 'owner',
  is_primary    boolean not null default false,
  moved_in_on   date,
  moved_out_on  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint unit_occupants_unit_membership_key unique (unit_id, membership_id),
  constraint unit_occupants_dates check (moved_out_on is null or moved_in_on is null or moved_out_on >= moved_in_on)
);

-- At most one primary contact per unit, and only while they still live there.
create unique index unit_occupants_one_primary
  on public.unit_occupants (unit_id)
  where is_primary and moved_out_on is null;

create index unit_occupants_membership_idx on public.unit_occupants (membership_id);

create trigger unit_occupants_touch_updated_at
  before update on public.unit_occupants
  for each row execute function app.touch_updated_at();
