-- ============================================================================
-- Samudaya · 0918.0100 · A phone number is not a neighbour's business
-- ----------------------------------------------------------------------------
-- society_people() was written so a resident could never be handed a
-- neighbour's email or phone: the function returns them as null to anyone
-- below staff, and no screen can forget to drop them.
--
-- The table underneath never agreed. profiles_select_self_or_neighbour is a
-- *row* policy — it decides which rows you may read, not which columns — so
-- `GET /rest/v1/profiles?select=full_name,phone` handed any member the phone
-- number of everybody they share a society with, straight past the function.
--
-- That was a hole in the design from the day society_people() shipped, and it
-- cost nothing while it was theoretical: not one profile had a phone number.
-- 0917.0100 started collecting them, so it is theoretical no longer.
--
-- Row policies cannot express "these two columns are different". Column
-- privileges can, so that is what this uses: `authenticated` simply loses the
-- right to read profiles.email and profiles.phone, and the two callers that
-- legitimately need them go through functions that check who is asking.
--
-- A column added to profiles later is not granted by this, so it is unreadable
-- until someone says otherwise. That is the right way round.
-- ============================================================================

revoke select on public.profiles from anon, authenticated;

grant select (
  id, full_name, avatar_url, locale, is_platform_admin, created_at, updated_at
) on public.profiles to anon, authenticated;

-- Writing is unchanged in spirit: profiles_update_self still confines it to
-- your own row, and app.guard_profile_columns() still refuses is_platform_admin.
-- Naming the columns here is what lets somebody set their own phone number
-- without being able to read anyone else's.
revoke update on public.profiles from anon, authenticated;

grant update (full_name, phone, avatar_url, locale) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Your own contact details
-- ---------------------------------------------------------------------------
-- The settings page has to show you the number it is about to change, and you
-- can no longer select it. One row, always your own — auth.uid() is the only
-- thing it will answer for.
create or replace function public.my_contact()
returns table (email text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.email::text, p.phone
    from public.profiles p
   where p.id = (select auth.uid());
$$;

grant execute on function public.my_contact() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Staff looking at somebody who has asked to join
-- ---------------------------------------------------------------------------
-- The join-requests page shows the applicant's account email beside the name
-- and phone they typed, which is how staff match somebody who signed in with
-- Google. An applicant is not a member yet, so society_people() does not cover
-- them; this does, and only for staff of the society they actually applied to.
--
-- Scoped to the community rather than to one request, so the page that lists a
-- hundred of them asks once.
create or replace function public.join_request_contacts(p_community_id uuid)
returns table (request_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.email::text
    from public.join_requests r
    join public.profiles p on p.id = r.user_id
   where r.community_id = p_community_id
     and app.is_staff(p_community_id)
   limit 500;
$$;

grant execute on function public.join_request_contacts(uuid) to authenticated, service_role;
