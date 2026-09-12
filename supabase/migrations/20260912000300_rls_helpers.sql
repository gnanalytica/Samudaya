-- ============================================================================
-- Samudaya · 0300 · RLS helper functions
-- ----------------------------------------------------------------------------
-- Every one of these is SECURITY DEFINER on purpose. RLS policies on
-- `memberships` need to ask "is this user a member?", and asking that with a
-- plain query would re-enter the same policy and recurse forever. Running the
-- lookup as the definer bypasses RLS and breaks the cycle.
--
-- They are STABLE so Postgres evaluates them once per statement rather than
-- once per row, which matters a lot inside a policy.
-- ============================================================================

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- The caller's role in a community, or NULL if they are not an active member.
create or replace function app.member_role_in(p_community uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
    from public.memberships m
   where m.community_id = p_community
     and m.user_id = (select auth.uid())
     and m.status = 'active'
   limit 1;
$$;

create or replace function app.is_member(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.member_role_in(p_community) is not null or app.is_platform_admin();
$$;

-- True when the caller's role ranks at or above p_min. Platform admins always
-- pass, which is what makes support access work without per-community rows.
create or replace function app.has_role_at_least(p_community uuid, p_min public.member_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_platform_admin()
      or coalesce(
           app.role_rank(app.member_role_in(p_community)) >= app.role_rank(p_min),
           false
         );
$$;

-- Coordinates events: works the checklist, runs activities, posts notices.
create or replace function app.is_committee(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_role_at_least(p_community, 'committee');
$$;

-- Can publish events, approve spending, admit residents.
create or replace function app.is_admin(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_role_at_least(p_community, 'admin');
$$;

-- The caller's membership row id for a community (used to own domain rows).
create or replace function app.my_membership_id(p_community uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
    from public.memberships m
   where m.community_id = p_community
     and m.user_id = (select auth.uid())
     and m.status = 'active'
   limit 1;
$$;

-- Every community the caller actively belongs to.
create or replace function app.my_community_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.community_id
    from public.memberships m
   where m.user_id = (select auth.uid())
     and m.status = 'active';
$$;

-- True when the caller shares at least one community with p_user. Drives
-- profile visibility: you can see the name of someone in your society, and
-- nobody else's.
create or replace function app.shares_community_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships mine
      join public.memberships theirs on theirs.community_id = mine.community_id
     where mine.user_id = (select auth.uid())
       and mine.status = 'active'
       and theirs.user_id = p_user
       and theirs.status = 'active'
  ) or app.is_platform_admin();
$$;

-- Units the caller currently occupies in a community.
create or replace function app.my_unit_ids(p_community uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.unit_id
    from public.unit_occupants o
    join public.memberships m on m.id = o.membership_id
   where m.user_id = (select auth.uid())
     and m.status = 'active'
     and m.community_id = p_community
     and o.moved_out_on is null;
$$;

grant execute on function
  app.is_platform_admin(),
  app.member_role_in(uuid),
  app.is_member(uuid),
  app.has_role_at_least(uuid, public.member_role),
  app.is_admin(uuid),
  app.is_committee(uuid),
  app.my_membership_id(uuid),
  app.my_community_ids(),
  app.shares_community_with(uuid),
  app.my_unit_ids(uuid)
to authenticated, service_role;
