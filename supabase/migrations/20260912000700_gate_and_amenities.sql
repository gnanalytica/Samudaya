-- ============================================================================
-- Samudaya · 0700 · Visitor passes (gate) and amenity bookings
-- ============================================================================

-- Needed so an exclusion constraint can mix uuid equality with range overlap.
create extension if not exists "btree_gist" with schema extensions;

create or replace function app.random_pass_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- One 3-byte draw read as a 24-bit integer, folded into six digits.
  select lpad(
    (
      (
        get_byte(b, 0) * 65536 + get_byte(b, 1) * 256 + get_byte(b, 2)
      ) % 1000000
    )::text,
    6, '0'
  )
  from (select extensions.gen_random_bytes(3) as b) s;
$$;

-- ---------------------------------------------------------------------------
-- visitor_passes — a resident pre-authorises a guest; the gate verifies a code
-- ---------------------------------------------------------------------------
create table public.visitor_passes (
  id             uuid primary key default extensions.gen_random_uuid(),
  community_id   uuid not null references public.communities (id) on delete cascade,
  unit_id        uuid references public.units (id) on delete set null,
  created_by     uuid references public.memberships (id) on delete set null,
  visitor_name   text not null,
  visitor_phone  text,
  kind           public.visitor_kind not null default 'guest',
  purpose        text,
  vehicle_number text,
  party_size     integer not null default 1,
  -- Short numeric code the guest reads out at the gate. A DEFAULT rather than
  -- a trigger-only assignment, so clients (and generated types) can treat it
  -- as optional on insert while it stays non-null on read. The trigger below
  -- is only responsible for resolving collisions.
  pass_code      text not null default app.random_pass_code(),
  status         public.visitor_status not null default 'expected',
  expected_at    timestamptz not null default now(),
  valid_until    timestamptz not null default (now() + interval '1 day'),
  checked_in_at  timestamptz,
  checked_out_at timestamptz,
  channel        public.origin_channel not null default 'web',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint visitor_passes_name_not_blank check (length(btrim(visitor_name)) > 0),
  constraint visitor_passes_party_size check (party_size between 1 and 50),
  constraint visitor_passes_window check (valid_until > expected_at),
  constraint visitor_passes_phone_e164
    check (visitor_phone is null or visitor_phone ~ '^\+[1-9][0-9]{7,14}$')
);

-- Codes only need to be unique among passes that can still be used, so they
-- can stay short and get recycled once a pass is done.
create unique index visitor_passes_active_code_key
  on public.visitor_passes (community_id, pass_code)
  where status in ('expected', 'arrived');

create index visitor_passes_community_idx
  on public.visitor_passes (community_id, expected_at desc);
create index visitor_passes_unit_idx on public.visitor_passes (unit_id);

create trigger visitor_passes_touch_updated_at
  before update on public.visitor_passes
  for each row execute function app.touch_updated_at();

-- The DEFAULT above supplies a code; this only steps in when that code is
-- already in use by a pass that can still be presented at the gate.
create or replace function app.assign_pass_code()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_try integer := 0;
begin
  if new.pass_code is null or length(btrim(new.pass_code)) = 0 then
    new.pass_code := app.random_pass_code();
  end if;

  while exists (
    select 1 from public.visitor_passes p
     where p.community_id = new.community_id
       and p.pass_code = new.pass_code
       and p.status in ('expected', 'arrived')
  ) loop
    v_try := v_try + 1;
    if v_try >= 20 then
      raise exception 'Could not allocate a free gate pass code';
    end if;
    new.pass_code := app.random_pass_code();
  end loop;

  return new;
end;
$$;

create trigger visitor_passes_assign_code
  before insert on public.visitor_passes
  for each row execute function app.assign_pass_code();

create table public.visitor_events (
  id           uuid primary key default extensions.gen_random_uuid(),
  pass_id      uuid not null references public.visitor_passes (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  status       public.visitor_status not null,
  recorded_by  uuid references public.memberships (id) on delete set null,
  note         text,
  occurred_at  timestamptz not null default now()
);

create index visitor_events_pass_idx on public.visitor_events (pass_id, occurred_at);

-- ---------------------------------------------------------------------------
-- amenities and bookings
-- ---------------------------------------------------------------------------
create table public.amenities (
  id                uuid primary key default extensions.gen_random_uuid(),
  community_id      uuid not null references public.communities (id) on delete cascade,
  name              text not null,
  description       text,
  capacity          integer,
  opens_at          time not null default '06:00',
  closes_at         time not null default '22:00',
  slot_minutes      integer not null default 60,
  max_hours_per_booking integer not null default 3,
  requires_approval boolean not null default false,
  booking_fee       numeric(12, 2) not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (community_id, name),
  constraint amenities_slot_minutes check (slot_minutes between 15 and 1440),
  constraint amenities_fee_non_negative check (booking_fee >= 0)
);

create trigger amenities_touch_updated_at
  before update on public.amenities
  for each row execute function app.touch_updated_at();

create table public.amenity_bookings (
  id            uuid primary key default extensions.gen_random_uuid(),
  amenity_id    uuid not null references public.amenities (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  unit_id       uuid references public.units (id) on delete set null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  guests        integer not null default 0,
  status        public.booking_status not null default 'confirmed',
  notes         text,
  channel       public.origin_channel not null default 'web',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint amenity_bookings_window check (ends_at > starts_at),
  constraint amenity_bookings_guests_non_negative check (guests >= 0),
  -- Double-booking is prevented in the database, not in application code, so
  -- a race between two residents tapping "Book" cannot produce a clash.
  constraint amenity_bookings_no_overlap
    exclude using gist (
      amenity_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status in ('pending', 'confirmed'))
);

create index amenity_bookings_community_idx
  on public.amenity_bookings (community_id, starts_at desc);
create index amenity_bookings_membership_idx on public.amenity_bookings (membership_id);

create trigger amenity_bookings_touch_updated_at
  before update on public.amenity_bookings
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.visitor_passes   enable row level security;
alter table public.visitor_events   enable row level security;
alter table public.amenities        enable row level security;
alter table public.amenity_bookings enable row level security;

-- The gate needs to see every expected visitor; a resident sees only their own.
create policy visitor_passes_select
  on public.visitor_passes for select to authenticated
  using (
    app.is_gate_staff(community_id)
    or created_by = app.my_membership_id(community_id)
    or (unit_id is not null and unit_id in (select app.my_unit_ids(community_id)))
  );

create policy visitor_passes_insert_member
  on public.visitor_passes for insert to authenticated
  with check (
    app.is_member(community_id)
    and (
      created_by = app.my_membership_id(community_id)
      or app.is_gate_staff(community_id)
    )
  );

create policy visitor_passes_update
  on public.visitor_passes for update to authenticated
  using (
    app.is_gate_staff(community_id)
    or created_by = app.my_membership_id(community_id)
  )
  with check (
    app.is_gate_staff(community_id)
    or created_by = app.my_membership_id(community_id)
  );

create policy visitor_passes_delete_admin
  on public.visitor_passes for delete to authenticated
  using (app.is_admin(community_id));

create policy visitor_events_select
  on public.visitor_events for select to authenticated
  using (
    app.is_gate_staff(community_id)
    or exists (
      select 1 from public.visitor_passes p
       where p.id = visitor_events.pass_id
         and (
           p.created_by = app.my_membership_id(p.community_id)
           or (p.unit_id is not null and p.unit_id in (select app.my_unit_ids(p.community_id)))
         )
    )
  );

-- Only the gate desk records arrivals and departures.
create policy visitor_events_insert_gate
  on public.visitor_events for insert to authenticated
  with check (app.is_gate_staff(community_id));

create policy amenities_select_member
  on public.amenities for select to authenticated
  using (app.is_member(community_id));

create policy amenities_write_admin
  on public.amenities for all to authenticated
  using (app.is_admin(community_id))
  with check (app.is_admin(community_id));

-- Bookings are visible community-wide: residents need to see what is already
-- taken before choosing a slot.
create policy amenity_bookings_select_member
  on public.amenity_bookings for select to authenticated
  using (app.is_member(community_id));

create policy amenity_bookings_insert_own
  on public.amenity_bookings for insert to authenticated
  with check (
    app.is_member(community_id)
    and membership_id = app.my_membership_id(community_id)
    and exists (
      select 1 from public.amenities a
       where a.id = amenity_bookings.amenity_id
         and a.community_id = amenity_bookings.community_id
         and a.is_active
    )
  );

create policy amenity_bookings_update_own_or_admin
  on public.amenity_bookings for update to authenticated
  using (
    app.is_admin(community_id)
    or membership_id = app.my_membership_id(community_id)
  )
  with check (
    app.is_admin(community_id)
    or membership_id = app.my_membership_id(community_id)
  );

create policy amenity_bookings_delete_own_or_admin
  on public.amenity_bookings for delete to authenticated
  using (
    app.is_admin(community_id)
    or membership_id = app.my_membership_id(community_id)
  );
