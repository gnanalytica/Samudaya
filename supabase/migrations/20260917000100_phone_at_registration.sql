-- ============================================================================
-- Samudaya · 0917.0100 · A phone number that survives registration
-- ----------------------------------------------------------------------------
-- Two holes, found by counting: not one profile on production had a phone
-- number, on either society.
--
--   1. Founding a society never asked for one. The form takes a name, a city
--      and an address, and the founder — who is the committee, and the person
--      everyone else needs to reach — ends up the only member with no way to
--      be contacted.
--
--   2. Joining did ask, and then dropped the answer. request_to_join files it
--      as join_requests.claimed_phone, staff read it once while admitting the
--      person, and nothing ever copies it onto the profile. So the contact
--      column staff see in the people directory was empty for everybody.
--
-- Both are fixed here, and the phones already sitting on approved requests are
-- carried across.
--
-- Deliberately NOT required at this level. The forms require it; the database
-- accepts null, so a phone that is already deployed and calling the old
-- four-argument create_society keeps working rather than failing the moment
-- this lands. Shipping the app and the schema separately is what broke society
-- creation on 14 September, and a required argument is exactly that trap.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- One place that decides what a phone number looks like
-- ---------------------------------------------------------------------------
-- profiles.phone is E.164 (`profiles_phone_e164`), while people type a plain
-- ten-digit Indian mobile. The web form already normalises before sending;
-- this is the same rule where the data lands, so a client that forgets cannot
-- write something the check constraint would refuse.
--
-- Returns null for anything it cannot turn into E.164, which callers treat as
-- "no phone given" rather than as an error.
create or replace function app.e164(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  with cleaned as (
    select regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g') as digits
  )
  select case
    -- A bare Indian mobile: 10 digits starting 6-9.
    when digits ~ '^[6-9][0-9]{9}$'      then '+91' || digits
    -- Already international, with or without the plus.
    when digits ~ '^\+[1-9][0-9]{7,14}$' then digits
    when digits ~ '^[1-9][0-9]{7,14}$'   then '+' || digits
    else null
  end
  from cleaned;
$$;

grant execute on function app.e164(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The phone someone types when joining becomes their phone
-- ---------------------------------------------------------------------------
-- A trigger rather than a change to request_to_join: the same thing has to
-- happen whichever client files the request, and copying a 120-line function
-- to add three lines to it is how the two drift apart.
--
-- Only fills an empty profile. Someone who has set their own number keeps it,
-- however many societies they later apply to.
create or replace function app.adopt_claimed_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := app.e164(new.claimed_phone);
begin
  if v_phone is not null and new.user_id is not null then
    update public.profiles
       set phone = v_phone
     where id = new.user_id
       and phone is null;
  end if;
  return null;
end;
$$;

drop trigger if exists join_requests_adopt_phone on public.join_requests;
create trigger join_requests_adopt_phone
  after insert or update of claimed_phone on public.join_requests
  for each row execute function app.adopt_claimed_phone();

-- The requests already filed, including the ones long since approved.
update public.profiles p
   set phone = app.e164(r.claimed_phone)
  from public.join_requests r
 where r.user_id = p.id
   and p.phone is null
   and app.e164(r.claimed_phone) is not null;

-- ---------------------------------------------------------------------------
-- Founding a society asks for one too
-- ---------------------------------------------------------------------------
-- The argument list changes, so this is a drop rather than a replace. The
-- new parameter has a default: a client still calling the four-argument form
-- resolves to this function and simply records no phone.
drop function if exists public.create_society(text, text, text, text);

create or replace function public.create_society(
  p_name    text,
  p_city    text default null,
  p_address text default null,
  p_pincode text default null,
  p_phone   text default null
)
returns table (
  status       text,
  community_id uuid,
  slug         text,
  join_code    text
)
language plpgsql
security definer
set search_path = ''
as $$
-- `status`, `slug` and `join_code` are also column names on communities.
#variable_conflict use_column
declare
  -- One person opening a fourth society is either testing or abusing; both are
  -- better handled by the platform team than by an open-ended loop.
  c_limit  constant integer := 3;
  c_tries  constant integer := 50;
  v_uid    uuid    := (select auth.uid());
  v_name   text    := btrim(coalesce(p_name, ''));
  v_city   text    := nullif(btrim(coalesce(p_city, '')), '');
  v_addr   text    := nullif(btrim(coalesce(p_address, '')), '');
  v_pin    text    := nullif(btrim(coalesce(p_pincode, '')), '');
  v_phone  text    := app.e164(p_phone);
  v_base   text;
  v_slug   text;
  v_founded integer;
  v_row    public.communities;
  v_try    integer;
begin
  if v_uid is null then
    return query select 'unauthenticated'::text, null::uuid, null::text, null::text;
    return;
  end if;

  if length(v_name) < 2 or length(v_name) > 120 then
    return query select 'invalid_name'::text, null::uuid, null::text, null::text;
    return;
  end if;

  -- Given but unusable is a mistake worth naming. Not given is fine: an older
  -- client has no field to give it from.
  if nullif(btrim(coalesce(p_phone, '')), '') is not null and v_phone is null then
    return query select 'invalid_phone'::text, null::uuid, null::text, null::text;
    return;
  end if;

  select count(*) into v_founded
    from public.communities c
   where c.created_by = v_uid;

  if v_founded >= c_limit then
    return query select 'too_many'::text, null::uuid, null::text, null::text;
    return;
  end if;

  v_base := app.society_slug(v_name);
  v_slug := v_base;

  -- Two people naming their society the same thing, or two societies drawing
  -- the same join_code, both surface as a unique violation. Catching it around
  -- the INSERT settles the race without a lock: the subtransaction rolls the
  -- attempt back and the next candidate carries a random suffix. 43 + '-' + 4
  -- keeps the slug inside its 50-character constraint.
  for v_try in 1 .. c_tries loop
    begin
      insert into public.communities (name, slug, city, address, pincode, created_by)
      values (v_name, v_slug, v_city, v_addr, v_pin, v_uid)
      returning * into v_row;

      -- The founder's own number, on their own profile, and only when they
      -- have not already set one.
      if v_phone is not null then
        update public.profiles set phone = v_phone where id = v_uid and phone is null;
      end if;

      return query select 'ok'::text, v_row.id, v_row.slug, v_row.join_code;
      return;
    exception when unique_violation then
      v_slug := left(v_base, 43) || '-' || lower(app.random_code(4));
    end;
  end loop;

  return query select 'no_slug_free'::text, null::uuid, null::text, null::text;
end;
$$;

grant execute on function public.create_society(text, text, text, text, text)
  to authenticated, service_role;
