-- ============================================================================
-- Samudaya · 0400 · RLS on the core tables + privilege-escalation guards
-- ============================================================================

alter table public.profiles       enable row level security;
alter table public.communities    enable row level security;
alter table public.units          enable row level security;
alter table public.memberships    enable row level security;
alter table public.unit_occupants enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_self_or_neighbour
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or app.shares_community_with(id));

create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Rows are created by the auth trigger, never by clients: no INSERT policy.

-- A WITH CHECK clause cannot see the old row, so the escalation guard has to
-- be a trigger. Without it any user could PATCH is_platform_admin = true.
create or replace function app.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;
  if new.is_platform_admin is distinct from old.is_platform_admin then
    raise exception 'is_platform_admin cannot be changed through the API'
      using errcode = '42501';
  end if;
  -- id is the auth.users FK; changing it would hand the row to someone else.
  new.id := old.id;
  return new;
end;
$$;

create trigger profiles_guard_columns
  before update on public.profiles
  for each row execute function app.guard_profile_columns();

-- ---------------------------------------------------------------------------
-- communities
-- ---------------------------------------------------------------------------

create policy communities_select_member
  on public.communities for select to authenticated
  using (app.is_member(id));

-- Anyone signed in may found a community; the trigger below makes them owner.
create policy communities_insert_authenticated
  on public.communities for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy communities_update_admin
  on public.communities for update to authenticated
  using (app.is_admin(id))
  with check (app.is_admin(id));

create policy communities_delete_owner
  on public.communities for delete to authenticated
  using (app.has_role_at_least(id, 'owner'));

-- The founder must become the owner in the same transaction, otherwise they
-- would immediately lose access to the community they just created.
create or replace function app.seed_community_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.memberships (community_id, user_id, role, status)
    values (new.id, new.created_by, 'owner', 'active')
    on conflict (community_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger communities_seed_owner
  after insert on public.communities
  for each row execute function app.seed_community_owner();

-- ---------------------------------------------------------------------------
-- units
-- ---------------------------------------------------------------------------

create policy units_select_member
  on public.units for select to authenticated
  using (app.is_member(community_id));

create policy units_write_admin
  on public.units for all to authenticated
  using (app.is_admin(community_id))
  with check (app.is_admin(community_id));

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------

create policy memberships_select_own_community
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or app.is_member(community_id));

create policy memberships_insert_admin
  on public.memberships for insert to authenticated
  with check (app.is_admin(community_id));

create policy memberships_update_admin
  on public.memberships for update to authenticated
  using (app.is_admin(community_id))
  with check (app.is_admin(community_id));

create policy memberships_delete_admin
  on public.memberships for delete to authenticated
  using (app.is_admin(community_id));

-- Guards that RLS alone cannot express:
--   1. an admin must not quietly promote themselves to owner;
--   2. the last owner must not be demoted or removed, which would orphan the
--      community with nobody able to administer it.
create or replace function app.guard_membership_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role public.member_role;
  v_owner_count integer;
begin
  if current_setting('role', true) = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_actor_role := app.member_role_in(coalesce(new.community_id, old.community_id));

  if tg_op = 'UPDATE' then
    -- No self-promotion, at any rank.
    if old.user_id = v_actor
       and new.role is distinct from old.role
       and app.role_rank(new.role) > app.role_rank(old.role)
       and not app.is_platform_admin() then
      raise exception 'You cannot raise your own role'
        using errcode = '42501';
    end if;

    -- Only an owner may mint another owner or unseat one.
    if (new.role = 'owner' or old.role = 'owner')
       and new.role is distinct from old.role
       and coalesce(v_actor_role, 'resident') <> 'owner'
       and not app.is_platform_admin() then
      raise exception 'Only a community owner can change owner roles'
        using errcode = '42501';
    end if;
  end if;

  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    select count(*) into v_owner_count
      from public.memberships
     where community_id = old.community_id
       and role = 'owner'
       and status = 'active';
    if v_owner_count <= 1 then
      raise exception 'A community must keep at least one owner'
        using errcode = '23514';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger memberships_guard_changes
  before update or delete on public.memberships
  for each row execute function app.guard_membership_changes();

-- ---------------------------------------------------------------------------
-- unit_occupants
-- ---------------------------------------------------------------------------

create policy unit_occupants_select_member
  on public.unit_occupants for select to authenticated
  using (
    exists (
      select 1 from public.units u
       where u.id = unit_occupants.unit_id
         and app.is_member(u.community_id)
    )
  );

create policy unit_occupants_write_admin
  on public.unit_occupants for all to authenticated
  using (
    exists (
      select 1 from public.units u
       where u.id = unit_occupants.unit_id
         and app.is_admin(u.community_id)
    )
  )
  with check (
    exists (
      select 1 from public.units u
       where u.id = unit_occupants.unit_id
         and app.is_admin(u.community_id)
    )
  );
