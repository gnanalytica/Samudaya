-- ============================================================================
-- Samudaya · 0922.0300 · The founder lives somewhere too
-- ----------------------------------------------------------------------------
-- Every resident is asked which flat they live in: the join form requires it,
-- and a unit-bound invite code carries it. The one person never asked is the
-- founder, who is created by create_society() and seated by
-- app.seed_community_owner() as a member of a society and a resident of
-- nowhere.
--
-- That is why the committee member reading the Money page saw their own
-- payments with no flat beside them. It was not the ledger failing to look;
-- there was nothing to find.
--
-- Worse, nothing could put it right afterwards. The Flats page counts
-- occupants without being able to add one, Settings edits a name and a phone,
-- and the two paths that do seat somebody — request_to_join() and redeeming a
-- unit-bound code — are both one-time, at the moment of joining. A member who
-- joined without a flat, or moved between flats, had no way back.
--
-- So two things:
--
--   · create_society() takes the founder's flat, creates that one unit and
--     seats them in it. The society's first flat is the founder's own.
--   · set_member_unit() lets the committee seat any member afterwards, which
--     is the door that was missing entirely.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- "A 703" → block A, number 703
-- ---------------------------------------------------------------------------
-- The founder types one label; units store a block and a number. Splitting it
-- here rather than asking for two fields keeps "start your society" to the
-- questions somebody will actually answer on a phone.
--
-- The shape has to match generateFlats() in @samudaya/core, which writes an
-- uppercase block and a bare number. If it did not, a founder's "A 703" and
-- the generator's later A/703 would be two different flats, and the resident
-- who picked the wrong one would be invisible to the other. Mirrors splitFlat
-- in @samudaya/core; a test holds the two together.
create or replace function app.split_flat(p_label text)
returns table (block text, number text)
language sql
immutable
set search_path = ''
as $$
  select
    nullif(upper(coalesce(parts[1], '')), ''),
    btrim(coalesce(parts[2], label))
  from (
    select
      label,
      coalesce(
        -- A tower held apart from the flat. The flat may itself start with a
        -- letter — "B G01" is flat G01 of tower B, and that G is the ground
        -- floor, not the tower.
        regexp_match(label, '^([A-Za-z]+)[\s._/-]+(.+)$'),
        -- Or the two run together, as they usually do when typed in a hurry.
        regexp_match(label, '^([A-Za-z]{1,3})([0-9].*)$')
      ) as parts
    from (select btrim(regexp_replace(coalesce(p_label, ''), '\s+', ' ', 'g')) as label) s
  ) t;
$$;

grant execute on function app.split_flat(text) to authenticated, service_role;

comment on function app.split_flat(text) is
  'Splits a typed flat label into the block and number that units stores, the '
  'same way generateFlats() does, so a hand-typed flat and a generated one are '
  'the same row. A label with no leading letters is all number. One token that '
  'is a letter then digits is read as tower-and-flat ("G01" becomes G/01), '
  'which a space settles either way.';

-- ---------------------------------------------------------------------------
-- Founding a society, with the founder in it
-- ---------------------------------------------------------------------------
-- p_flat is optional: an older client has no field to send it from, and a
-- founder who manages the society without living in it is a real case. A flat
-- that cannot be read as one is worth naming rather than silently dropping,
-- because the founder typed something and expects it to mean something.
create or replace function public.create_society(
  p_name    text,
  p_city    text default null,
  p_address text default null,
  p_pincode text default null,
  p_phone   text default null,
  p_flat    text default null
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
  v_flat   text    := nullif(btrim(coalesce(p_flat, '')), '');
  v_block  text;
  v_number text;
  v_unit   uuid;
  v_member uuid;
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

  if v_flat is not null then
    select f.block, f.number into v_block, v_number from app.split_flat(v_flat) f;
    if coalesce(v_number, '') !~ '[0-9]' or length(v_flat) > 24 then
      return query select 'invalid_flat'::text, null::uuid, null::text, null::text;
      return;
    end if;
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

      -- The society's first flat is the founder's own. communities_seed_owner
      -- has already run by now, so there is a membership to seat.
      if v_number is not null then
        insert into public.units (community_id, block, number)
        values (v_row.id, v_block, v_number)
        returning id into v_unit;

        select m.id into v_member
          from public.memberships m
         where m.community_id = v_row.id and m.user_id = v_uid;

        if v_member is not null then
          insert into public.unit_occupants
            (unit_id, membership_id, relation, is_primary, moved_in_on)
          values (v_unit, v_member, 'owner', true, current_date);
        end if;
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

-- The five-argument form is gone: leaving it behind would mean two functions
-- with the same name, and a client sending five arguments would keep silently
-- founding flatless societies.
drop function if exists public.create_society(text, text, text, text, text);

revoke all on function public.create_society(text, text, text, text, text, text) from public;
revoke all on function public.create_society(text, text, text, text, text, text) from anon;
grant execute on function public.create_society(text, text, text, text, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Seating a member afterwards
-- ---------------------------------------------------------------------------
/**
 * Puts a member in a flat, or takes them out of one.
 *
 * The committee's job, not staff's: which flat somebody lives in decides who
 * the ledger names against their payments and who the directory lists at that
 * door, and both are the committee's to answer for.
 *
 * Moving is the normal case, not a special one — a tenant leaves, an owner
 * moves in, somebody picked the wrong flat when they joined. So this closes
 * whatever they had rather than stacking a second flat on top, and re-opens a
 * tenancy they had left instead of colliding with it.
 *
 *   ok | not_committee | no_member | no_unit | wrong_community
 */
create or replace function public.set_member_unit(
  p_membership_id uuid,
  p_unit_id       uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_community uuid;
  v_primary   boolean;
begin
  select m.community_id into v_community
    from public.memberships m where m.id = p_membership_id;
  if v_community is null then return 'no_member'; end if;

  if not app.is_committee(v_community) then return 'not_committee'; end if;

  if p_unit_id is not null then
    if not exists (select 1 from public.units u where u.id = p_unit_id) then
      return 'no_unit';
    end if;
    -- A flat from another society would put a stranger in the directory and
    -- leak nothing but would make the ledger nonsense.
    if not exists (
      select 1 from public.units u
       where u.id = p_unit_id and u.community_id = v_community
    ) then
      return 'wrong_community';
    end if;
  end if;

  -- Out of wherever they were. Left as history rather than deleted: a payment
  -- from back then still wants the flat they were in at the time.
  update public.unit_occupants o
     set moved_out_on = current_date
   where o.membership_id = p_membership_id
     and o.moved_out_on is null
     and (p_unit_id is null or o.unit_id <> p_unit_id);

  if p_unit_id is null then return 'ok'; end if;

  -- Primary only when the flat has nobody holding that seat, so the unique
  -- index on (unit_id) where is_primary stays satisfied.
  v_primary := not exists (
    select 1 from public.unit_occupants o
     where o.unit_id = p_unit_id
       and o.is_primary
       and o.moved_out_on is null
       and o.membership_id <> p_membership_id
  );

  insert into public.unit_occupants
    (unit_id, membership_id, relation, is_primary, moved_in_on)
  values (p_unit_id, p_membership_id, 'owner', v_primary, current_date)
  on conflict (unit_id, membership_id) do update
     set moved_out_on = null,
         is_primary   = excluded.is_primary,
         -- Coming back to a flat they never really left keeps the earlier
         -- date, so their older payments stay inside the occupancy.
         moved_in_on  = least(
           coalesce(public.unit_occupants.moved_in_on, excluded.moved_in_on),
           excluded.moved_in_on
         );

  return 'ok';
end;
$$;

revoke all on function public.set_member_unit(uuid, uuid) from public;
revoke all on function public.set_member_unit(uuid, uuid) from anon;
grant execute on function public.set_member_unit(uuid, uuid) to authenticated, service_role;

comment on function public.set_member_unit(uuid, uuid) is
  'Committee-only: seats a member in a flat, moving them out of any other. '
  'Null clears their flat. Past occupancies are closed, never deleted, so a '
  'payment keeps the flat its payer was in at the time.';
