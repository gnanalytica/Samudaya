-- ============================================================================
-- Samudaya · 0916.0100 · One people list, two levels of detail
-- ============================================================================
-- Residents asked to see who else is in the society. Staff and the committee
-- already had that list, but theirs carries email and phone so they can check a
-- join request against the person at the gate.
--
-- Rather than trusting every screen to remember to drop those two columns for a
-- resident, the list comes from one function that cannot return them: email and
-- phone are null unless the caller is staff or committee in that society. A
-- resident who calls this directly gets the same lean rows the page shows them.

create or replace function public.society_people(p_community_id uuid)
returns table (
  membership_id uuid,
  user_id       uuid,
  full_name     text,
  role          public.member_role,
  flat          text,
  relation      public.occupant_relation,
  joined_at     timestamptz,
  email         text,
  phone         text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id,
         m.user_id,
         coalesce(nullif(btrim(p.full_name), ''), 'Unnamed'),
         m.role,
         app.flat_label(o.unit_id),
         o.relation,
         m.joined_at,
         case when app.is_staff(p_community_id) then p.email::text end,
         case when app.is_staff(p_community_id) then p.phone end
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    left join public.unit_occupants o
           on o.membership_id = m.id and o.moved_out_on is null
   where m.community_id = p_community_id
     and m.status = 'active'
     and app.is_member(p_community_id)
   order by m.joined_at desc
   limit 2000;
$$;

grant execute on function public.society_people(uuid) to authenticated, service_role;
