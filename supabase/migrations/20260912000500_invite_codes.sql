-- ============================================================================
-- Samudaya · 0500 · Invite codes
-- ----------------------------------------------------------------------------
-- An admin mints a code in the admin panel; a resident types it once to join
-- the community. The code decides the role they get and, optionally, the unit
-- they are attached to. This is how a community regulates who gets in.
-- ============================================================================

create table public.invite_codes (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  -- Canonical form: uppercase, no separators. Globally unique so a resident
  -- can redeem knowing only the code, without picking a community first.
  code          text not null unique,
  label         text,
  role          public.member_role not null default 'resident',
  unit_id       uuid references public.units (id) on delete set null,
  relation      public.occupant_relation not null default 'owner',
  -- NULL means unlimited. A single-use code is max_uses = 1.
  max_uses      integer,
  used_count    integer not null default 0,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  revoked_by    uuid references public.profiles (id) on delete set null,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint invite_codes_code_canonical check (code ~ '^[A-Z0-9]{6,16}$'),
  constraint invite_codes_max_uses_positive check (max_uses is null or max_uses > 0),
  constraint invite_codes_used_count_non_negative check (used_count >= 0),
  -- Owner is granted by hand, never by a code that could be forwarded.
  constraint invite_codes_role_not_owner check (role <> 'owner')
);

create index invite_codes_community_idx on public.invite_codes (community_id, created_at desc);
create index invite_codes_unit_idx on public.invite_codes (unit_id) where unit_id is not null;

create trigger invite_codes_touch_updated_at
  before update on public.invite_codes
  for each row execute function app.touch_updated_at();

-- memberships.invited_via points back here (declared in 0200 without the FK so
-- the tables could be created in either order).
alter table public.memberships
  add constraint memberships_invited_via_fkey
  foreign key (invited_via) references public.invite_codes (id) on delete set null;

create table public.invite_code_redemptions (
  id             uuid primary key default extensions.gen_random_uuid(),
  invite_code_id uuid not null references public.invite_codes (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  membership_id  uuid references public.memberships (id) on delete set null,
  channel        public.origin_channel not null default 'web',
  redeemed_at    timestamptz not null default now(),
  constraint invite_code_redemptions_code_user_key unique (invite_code_id, user_id)
);

create index invite_code_redemptions_code_idx
  on public.invite_code_redemptions (invite_code_id, redeemed_at desc);

-- Failed guesses are recorded so brute force can be throttled. Rows are
-- written even for rejected attempts, which is why the redeem function
-- returns a status instead of raising: an exception would roll the log back.
create table public.invite_code_attempts (
  id           uuid primary key default extensions.gen_random_uuid(),
  user_id      uuid references public.profiles (id) on delete cascade,
  code_tried   text not null,
  succeeded    boolean not null default false,
  channel      public.origin_channel not null default 'web',
  attempted_at timestamptz not null default now()
);

create index invite_code_attempts_user_time_idx
  on public.invite_code_attempts (user_id, attempted_at desc);

-- ---------------------------------------------------------------------------
-- Code generation
-- ---------------------------------------------------------------------------

-- Alphabet excludes 0/O, 1/I/L and U/V confusions, so a code read off a notice
-- board or over the phone survives the trip.
create or replace function app.random_invite_code(p_len integer default 8)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  n constant integer := 30;
  result text := '';
  bytes bytea;
  i integer;
begin
  bytes := extensions.gen_random_bytes(p_len);
  for i in 0 .. p_len - 1 loop
    -- 256 % 30 leaves a negligible modulo bias; brute force is bounded by the
    -- attempt throttle below, not by per-character uniformity.
    result := result || substr(alphabet, (get_byte(bytes, i) % n) + 1, 1);
  end loop;
  return result;
end;
$$;

-- Strip whatever shape the human typed ("k7mq-3xpb", "K7MQ 3XPB") down to the
-- canonical stored form.
create or replace function public.normalize_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

grant execute on function public.normalize_invite_code(text) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Admin: mint a code
-- ---------------------------------------------------------------------------
create or replace function public.create_invite_code(
  p_community_id uuid,
  p_role         public.member_role default 'resident',
  p_unit_id      uuid default null,
  p_relation     public.occupant_relation default 'owner',
  p_max_uses     integer default 1,
  p_expires_at   timestamptz default null,
  p_label        text default null
)
returns public.invite_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_row public.invite_codes;
  v_attempt integer := 0;
begin
  if not app.is_admin(p_community_id) then
    raise exception 'Only a community admin can create invite codes'
      using errcode = '42501';
  end if;

  if p_role = 'owner' then
    raise exception 'Owner access cannot be granted by invite code'
      using errcode = '42501';
  end if;

  if p_unit_id is not null and not exists (
    select 1 from public.units u
     where u.id = p_unit_id and u.community_id = p_community_id
  ) then
    raise exception 'That unit does not belong to this community'
      using errcode = '23503';
  end if;

  -- Retry on the astronomically unlikely collision rather than failing the
  -- admin's request.
  loop
    v_attempt := v_attempt + 1;
    v_code := app.random_invite_code(8);
    begin
      insert into public.invite_codes (
        community_id, code, label, role, unit_id, relation,
        max_uses, expires_at, created_by
      )
      values (
        p_community_id, v_code, p_label, p_role, p_unit_id, p_relation,
        p_max_uses, p_expires_at, (select auth.uid())
      )
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      if v_attempt >= 8 then
        raise exception 'Could not allocate a unique invite code';
      end if;
    end;
  end loop;
end;
$$;

grant execute on function public.create_invite_code(
  uuid, public.member_role, uuid, public.occupant_relation, integer, timestamptz, text
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Resident: look before you leap
-- ---------------------------------------------------------------------------
-- Shows just enough to confirm "yes, this is my society" without leaking the
-- member list. Throttled on the same counter as redemption so it cannot be
-- used to enumerate valid codes.
create or replace function public.preview_invite_code(p_code text)
returns table (
  status         text,
  community_name text,
  community_slug text,
  role           public.member_role,
  unit_label     text,
  expires_at     timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public.normalize_invite_code(p_code);
  v_uid uuid := (select auth.uid());
  v_recent integer;
  v_row public.invite_codes;
begin
  select count(*) into v_recent
    from public.invite_code_attempts a
   where a.user_id = v_uid
     and a.succeeded = false
     and a.attempted_at > now() - interval '15 minutes';

  if v_recent >= 10 then
    return query select 'rate_limited'::text, null::text, null::text,
                        null::public.member_role, null::text, null::timestamptz;
    return;
  end if;

  select * into v_row from public.invite_codes ic where ic.code = v_code;

  if v_row.id is null then
    insert into public.invite_code_attempts (user_id, code_tried, succeeded)
    values (v_uid, v_code, false);
    return query select 'not_found'::text, null::text, null::text,
                        null::public.member_role, null::text, null::timestamptz;
    return;
  end if;

  return query
    select
      case
        when v_row.revoked_at is not null then 'revoked'
        when v_row.expires_at is not null and v_row.expires_at <= now() then 'expired'
        when v_row.max_uses is not null and v_row.used_count >= v_row.max_uses then 'exhausted'
        else 'ok'
      end::text,
      c.name,
      c.slug,
      v_row.role,
      case when u.id is null then null
           else trim(both ' ' from coalesce(u.block || ' ', '') || u.number)
      end,
      v_row.expires_at
    from public.communities c
    left join public.units u on u.id = v_row.unit_id
    where c.id = v_row.community_id;
end;
$$;

grant execute on function public.preview_invite_code(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Resident: redeem
-- ---------------------------------------------------------------------------
-- Returns a status rather than raising, for two reasons: the attempt log has
-- to survive a rejected attempt, and the caller wants to show a specific
-- message ("that code has expired") instead of a generic database error.
create or replace function public.redeem_invite_code(
  p_code    text,
  p_channel public.origin_channel default 'web'
)
returns table (
  status         text,
  membership_id  uuid,
  community_id   uuid,
  community_name text,
  community_slug text,
  role           public.member_role,
  unit_id        uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public.normalize_invite_code(p_code);
  v_uid uuid := (select auth.uid());
  v_recent integer;
  v_row public.invite_codes;
  v_membership public.memberships;
  v_existing public.memberships;
  v_community public.communities;
begin
  if v_uid is null then
    return query select 'unauthenticated'::text, null::uuid, null::uuid,
                        null::text, null::text, null::public.member_role, null::uuid;
    return;
  end if;

  select count(*) into v_recent
    from public.invite_code_attempts a
   where a.user_id = v_uid
     and a.succeeded = false
     and a.attempted_at > now() - interval '15 minutes';

  if v_recent >= 10 then
    return query select 'rate_limited'::text, null::uuid, null::uuid,
                        null::text, null::text, null::public.member_role, null::uuid;
    return;
  end if;

  -- Lock the code row: two people redeeming the last use of the same code at
  -- the same instant must not both get in.
  select * into v_row
    from public.invite_codes ic
   where ic.code = v_code
   for update;

  if v_row.id is null then
    insert into public.invite_code_attempts (user_id, code_tried, succeeded, channel)
    values (v_uid, v_code, false, p_channel);
    return query select 'not_found'::text, null::uuid, null::uuid,
                        null::text, null::text, null::public.member_role, null::uuid;
    return;
  end if;

  if v_row.revoked_at is not null then
    insert into public.invite_code_attempts (user_id, code_tried, succeeded, channel)
    values (v_uid, v_code, false, p_channel);
    return query select 'revoked'::text, null::uuid, null::uuid,
                        null::text, null::text, null::public.member_role, null::uuid;
    return;
  end if;

  if v_row.expires_at is not null and v_row.expires_at <= now() then
    insert into public.invite_code_attempts (user_id, code_tried, succeeded, channel)
    values (v_uid, v_code, false, p_channel);
    return query select 'expired'::text, null::uuid, null::uuid,
                        null::text, null::text, null::public.member_role, null::uuid;
    return;
  end if;

  select * into v_existing
    from public.memberships m
   where m.community_id = v_row.community_id
     and m.user_id = v_uid;

  -- Idempotent: re-entering a code you already used just returns your seat.
  if v_existing.id is not null then
    insert into public.invite_code_attempts (user_id, code_tried, succeeded, channel)
    values (v_uid, v_code, true, p_channel);
    select * into v_community from public.communities c where c.id = v_row.community_id;
    return query select 'already_member'::text, v_existing.id, v_community.id,
                        v_community.name, v_community.slug, v_existing.role, v_row.unit_id;
    return;
  end if;

  if v_row.max_uses is not null and v_row.used_count >= v_row.max_uses then
    insert into public.invite_code_attempts (user_id, code_tried, succeeded, channel)
    values (v_uid, v_code, false, p_channel);
    return query select 'exhausted'::text, null::uuid, null::uuid,
                        null::text, null::text, null::public.member_role, null::uuid;
    return;
  end if;

  insert into public.memberships (community_id, user_id, role, status, invited_via)
  values (v_row.community_id, v_uid, v_row.role, 'active', v_row.id)
  returning * into v_membership;

  -- A unit-bound code also seats the resident in that flat.
  if v_row.unit_id is not null then
    insert into public.unit_occupants (unit_id, membership_id, relation, is_primary, moved_in_on)
    values (
      v_row.unit_id,
      v_membership.id,
      v_row.relation,
      not exists (
        select 1 from public.unit_occupants o
         where o.unit_id = v_row.unit_id and o.is_primary and o.moved_out_on is null
      ),
      current_date
    )
    on conflict on constraint unit_occupants_unit_membership_key do nothing;
  end if;

  update public.invite_codes
     set used_count = used_count + 1
   where id = v_row.id;

  insert into public.invite_code_redemptions (invite_code_id, user_id, membership_id, channel)
  values (v_row.id, v_uid, v_membership.id, p_channel)
  on conflict on constraint invite_code_redemptions_code_user_key do nothing;

  insert into public.invite_code_attempts (user_id, code_tried, succeeded, channel)
  values (v_uid, v_code, true, p_channel);

  select * into v_community from public.communities c where c.id = v_row.community_id;

  return query select 'ok'::text, v_membership.id, v_community.id,
                      v_community.name, v_community.slug, v_membership.role, v_row.unit_id;
end;
$$;

grant execute on function public.redeem_invite_code(text, public.origin_channel)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.invite_codes            enable row level security;
alter table public.invite_code_redemptions enable row level security;
alter table public.invite_code_attempts    enable row level security;

-- Only admins ever see raw codes. Residents interact with them exclusively
-- through the two SECURITY DEFINER functions above.
create policy invite_codes_admin_all
  on public.invite_codes for all to authenticated
  using (app.is_admin(community_id))
  with check (app.is_admin(community_id));

create policy invite_code_redemptions_admin_read
  on public.invite_code_redemptions for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.invite_codes ic
       where ic.id = invite_code_redemptions.invite_code_id
         and app.is_admin(ic.community_id)
    )
  );

create policy invite_code_attempts_self_read
  on public.invite_code_attempts for select to authenticated
  using (user_id = (select auth.uid()));
