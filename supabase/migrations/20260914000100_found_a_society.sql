-- ============================================================================
-- Samudaya · 0914.0100 · Founding a society from the app
-- ============================================================================
-- Until now a society could only be created by the platform team running
-- scripts/create-society.ts against the service role: migration 0913.0300
-- dropped the INSERT policy on public.communities and left nothing in its
-- place. That made every pilot a manual, scheduled step.
--
-- Societies are now founded from the app, but still not by a bare INSERT.
-- Clients go through public.create_society(), which owns the parts a client
-- cannot be trusted with — who the founder is, a free web address, a cap on
-- how many societies one account may open — and leaves public.communities
-- with no INSERT policy at all, so the function stays the only way in.

-- ---------------------------------------------------------------------------
-- The society's web address, derived from its name
-- ---------------------------------------------------------------------------
-- Mirrors societySlug() in @samudaya/core, so a slug previewed in the app is
-- the slug the database settles on. communities_slug_format needs 3–50
-- characters starting and ending with a letter or digit, which is why a short
-- or punctuation-only name falls back to "…-society" rather than failing.
create or replace function app.society_slug(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when base = ''            then 'society'
    when length(base) >= 3    then base
    else base || '-society'
  end
  from (
    select regexp_replace(
             left(
               btrim(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'), '-'),
               40
             ),
             '-+$', ''
           ) as base
  ) s;
$$;

grant execute on function app.society_slug(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Found a society
-- ---------------------------------------------------------------------------
-- Returns a status rather than raising, the way request_to_join() does, so the
-- app can tell "your name is too short" apart from "something broke".
--
--   ok            the society exists; slug and join_code come back with it
--   unauthenticated
--   invalid_name  under 2 or over 120 characters once trimmed
--   too_many      this account has already opened SOCIETY_LIMIT societies
--   no_slug_free  50 web addresses from this name were all taken
create or replace function public.create_society(
  p_name    text,
  p_city    text default null,
  p_address text default null,
  p_pincode text default null
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

      return query select 'ok'::text, v_row.id, v_row.slug, v_row.join_code;
      return;
    exception when unique_violation then
      v_slug := left(v_base, 43) || '-' || lower(app.random_code(4));
    end;
  end loop;

  return query select 'no_slug_free'::text, null::uuid, null::text, null::text;
end;
$$;

grant execute on function public.create_society(text, text, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Deleting a society
-- ---------------------------------------------------------------------------
-- communities_delete_owner was written against the four-role model, where
-- 'owner' outranked 'admin'. Renaming the enum values in 0913.0300 carried the
-- policy along with them, so it has been reading "any committee member may
-- delete this society" ever since — a cascading delete of every event, bill
-- and contribution, available to anyone the committee promotes.
--
-- Founding a society from the app needs an undo for the one someone opened by
-- mistake, not that. Deletion is now the founder's alone, and the guard below
-- stops it the moment the society is real.
drop policy if exists communities_delete_owner on public.communities;

create policy communities_delete_founder
  on public.communities for delete to authenticated
  using (created_by = (select auth.uid()) and app.is_committee(id));

create or replace function app.guard_community_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_others   integer;
  v_events   integer;
  v_requests integer;
begin
  -- Deleting the community cascades to its memberships, and the founder's is
  -- the last committee seat. app.guard_membership_changes() would refuse to
  -- give it up, so tell it which community is on its way out. set_config's
  -- local flag lasts exactly as long as this transaction.
  perform set_config('app.deleting_community', old.id::text, true);

  if current_setting('role', true) = 'service_role' or app.is_platform_admin() then
    return old;
  end if;

  select count(*) into v_others
    from public.memberships m
   where m.community_id = old.id
     and m.user_id is distinct from old.created_by;
  if v_others > 0 then
    raise exception 'A society with other members cannot be deleted'
      using errcode = '42501';
  end if;

  select count(*) into v_requests
    from public.join_requests r
   where r.community_id = old.id and r.status = 'pending';
  if v_requests > 0 then
    raise exception 'Someone has asked to join this society; it cannot be deleted'
      using errcode = '42501';
  end if;

  select count(*) into v_events
    from public.events e
   where e.community_id = old.id;
  if v_events > 0 then
    raise exception 'A society with events cannot be deleted'
      using errcode = '42501';
  end if;

  return old;
end;
$$;

drop trigger if exists communities_guard_delete on public.communities;
create trigger communities_guard_delete
  before delete on public.communities
  for each row execute function app.guard_community_delete();

-- The "keep at least one committee member" rule protects a society that is
-- staying. When the society itself is being deleted the rule has nothing left
-- to protect, and refusing would make the founder's undo impossible. Unchanged
-- from 0913.0300 apart from that exemption.
create or replace function app.guard_membership_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_committee_count integer;
begin
  if current_setting('role', true) = 'service_role' or app.is_platform_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' then
    if old.user_id = v_actor
       and new.role is distinct from old.role
       and app.role_rank(new.role) > app.role_rank(old.role) then
      raise exception 'You cannot raise your own role'
        using errcode = '42501';
    end if;

    if new.role is distinct from old.role
       and not app.is_committee(new.community_id) then
      raise exception 'Only the committee can change roles'
        using errcode = '42501';
    end if;
  end if;

  if ((tg_op = 'DELETE' and old.role = 'committee')
      or (tg_op = 'UPDATE' and old.role = 'committee'
          and (new.role <> 'committee' or new.status <> 'active')))
     and coalesce(current_setting('app.deleting_community', true), '') is distinct from
         old.community_id::text then
    select count(*) into v_committee_count
      from public.memberships
     where community_id = old.community_id
       and role = 'committee'
       and status = 'active';
    if v_committee_count <= 1 then
      raise exception 'A community must keep at least one committee member'
        using errcode = '23514';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
