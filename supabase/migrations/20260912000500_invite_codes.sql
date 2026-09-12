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
-- Code normalisation
-- ---------------------------------------------------------------------------

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
    v_code := app.random_code(8);
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

-- ============================================================================
-- Join requests
-- ----------------------------------------------------------------------------
-- The other way in. A resident who knows the Society ID picks their flat and
-- asks; an admin approves. Knowing the code alone gets nobody in, which is why
-- the code can safely be printed on a notice board.
-- ============================================================================

create table public.join_requests (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  unit_id       uuid references public.units (id) on delete set null,
  -- Captured as typed, so an admin can tell "Rahul, A-101, 98765 43210" apart
  -- from a chancer even before the profile is filled in.
  claimed_name  text not null,
  claimed_phone text,
  relation      public.occupant_relation not null default 'owner',
  status        public.join_request_status not null default 'pending',
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  decline_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint join_requests_name_not_blank check (length(btrim(claimed_name)) > 0),
  constraint join_requests_phone_e164
    check (claimed_phone is null or claimed_phone ~ '^\+?[0-9]{7,15}$')
);

-- One outstanding request per person per community: re-asking should update
-- the existing row, not queue a second one for the admin to wade through.
create unique index join_requests_one_pending
  on public.join_requests (community_id, user_id)
  where status = 'pending';

create index join_requests_community_idx
  on public.join_requests (community_id, status, created_at desc);

create trigger join_requests_touch_updated_at
  before update on public.join_requests
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Ask to join, by Society ID
-- ---------------------------------------------------------------------------
create or replace function public.request_to_join(
  p_join_code text,
  p_unit_id   uuid default null,
  p_name      text default null,
  p_phone     text default null,
  p_relation  public.occupant_relation default 'owner'
)
returns table (
  status       text,
  request_id   uuid,
  community_id uuid,
  community_name text
)
language plpgsql
security definer
set search_path = ''
as $$
-- This function returns columns named `status` and `community_id`, which would
-- otherwise shadow the real columns in the ON CONFLICT clause below.
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_community public.communities;
  v_existing public.memberships;
  v_row public.join_requests;
  v_recent integer;
begin
  if v_uid is null then
    return query select 'unauthenticated'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  -- Reuses the invite-code throttle: guessing a Society ID and guessing an
  -- invite code are the same attack, and share one budget.
  select count(*) into v_recent
    from public.invite_code_attempts a
   where a.user_id = v_uid
     and a.succeeded = false
     and a.attempted_at > now() - interval '15 minutes';

  if v_recent >= 10 then
    return query select 'rate_limited'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  select * into v_community
    from public.communities c
   where c.join_code = upper(regexp_replace(coalesce(p_join_code, ''), '[^A-Za-z0-9-]', '', 'g'));

  if v_community.id is null then
    insert into public.invite_code_attempts (user_id, code_tried, succeeded)
    values (v_uid, upper(coalesce(p_join_code, '')), false);
    return query select 'not_found'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  select * into v_existing
    from public.memberships m
   where m.community_id = v_community.id and m.user_id = v_uid;

  if v_existing.id is not null then
    return query select 'already_member'::text, null::uuid, v_community.id, v_community.name;
    return;
  end if;

  if p_unit_id is not null and not exists (
    select 1 from public.units u where u.id = p_unit_id and u.community_id = v_community.id
  ) then
    return query select 'bad_unit'::text, null::uuid, v_community.id, v_community.name;
    return;
  end if;

  -- Asking twice just refreshes the pending request.
  insert into public.join_requests
    (community_id, user_id, unit_id, claimed_name, claimed_phone, relation)
  values (
    v_community.id, v_uid, p_unit_id,
    coalesce(nullif(btrim(p_name), ''), 'Resident'),
    nullif(btrim(p_phone), ''),
    p_relation
  )
  on conflict (community_id, user_id) where status = 'pending'
  do update set unit_id = excluded.unit_id,
                claimed_name = excluded.claimed_name,
                claimed_phone = excluded.claimed_phone,
                relation = excluded.relation,
                updated_at = now()
  returning * into v_row;

  insert into public.invite_code_attempts (user_id, code_tried, succeeded)
  values (v_uid, v_community.join_code, true);

  return query select 'pending'::text, v_row.id, v_community.id, v_community.name;
end;
$$;

grant execute on function public.request_to_join(
  text, uuid, text, text, public.occupant_relation
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admit (or refuse) a request
-- ---------------------------------------------------------------------------
create or replace function public.review_join_request(
  p_request_id uuid,
  p_approve    boolean,
  p_role       public.member_role default 'resident',
  p_reason     text default null
)
returns public.join_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.join_requests;
  v_membership public.memberships;
begin
  select * into v_row from public.join_requests r where r.id = p_request_id for update;
  if v_row.id is null then
    raise exception 'No such request' using errcode = 'P0002';
  end if;

  if not app.is_admin(v_row.community_id) then
    raise exception 'Only a community admin can review join requests'
      using errcode = '42501';
  end if;

  if v_row.status <> 'pending' then
    return v_row;  -- already decided; treat a repeat click as a no-op
  end if;

  if p_role = 'owner' then
    raise exception 'Owner access cannot be granted from a join request'
      using errcode = '42501';
  end if;

  if p_approve then
    insert into public.memberships (community_id, user_id, role, status)
    values (v_row.community_id, v_row.user_id, p_role, 'active')
    on conflict (community_id, user_id) do update set status = 'active'
    returning * into v_membership;

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
  end if;

  update public.join_requests
     -- The arms are unknown literals, which unify to text; without the cast
     -- the assignment to an enum column fails.
     set status = (case when p_approve then 'approved' else 'rejected' end)::public.join_request_status,
         reviewed_by = (select auth.uid()),
         reviewed_at = now(),
         decline_reason = case when p_approve then null else p_reason end
   where id = p_request_id
   returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.review_join_request(uuid, boolean, public.member_role, text)
  to authenticated, service_role;

alter table public.join_requests enable row level security;

-- You can see your own request, wherever it is in the queue; admins see the
-- queue for their community.
create policy join_requests_select_self_or_admin
  on public.join_requests for select to authenticated
  using (user_id = (select auth.uid()) or app.is_admin(community_id));

-- Rows are written through request_to_join, which checks the Society ID.
-- Reviewing goes through review_join_request. Neither is done by direct DML.
create policy join_requests_withdraw_own
  on public.join_requests for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');
