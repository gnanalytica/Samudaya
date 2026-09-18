-- ============================================================================
-- Samudaya · 0920.1100 · A way out is a store requirement
-- ----------------------------------------------------------------------------
-- Google Play has required, since May 2024, that any app which lets people
-- create an account also lets them delete it: an in-app path, and a web page
-- for the people who have already uninstalled. Apple asks the same in
-- guideline 5.1.1(v). Neither existed here, so neither store would have taken
-- this app however good the rest of it was.
--
-- The Privacy Policy has described what deletion does since it was written:
--
--   "your profile, community memberships, flat assignments, join requests,
--    votes, sign-ups, WhatsApp link, notification tokens and notifications are
--    deleted; contributions, expenses and audit entries you were part of are
--    kept but no longer linked to your account, because a community's ledger
--    has to keep adding up."
--
-- That is not a new promise being invented here — it is the one already made,
-- and it is exactly what the foreign keys already say. Every table that holds
-- something personal references profiles or memberships `on delete cascade`;
-- every table that holds money references them `on delete set null`. So the
-- whole of the behaviour above is one `delete from auth.users`, and this
-- function is mostly the guard around it.
--
-- The guard: a society whose only committee member walks out is a society
-- nobody can run — no one left to approve a bill, admit a resident or close an
-- event, and no way to appoint anyone, because appointing is a committee act.
-- Fourteen households would find that out one at a time. So the deletion is
-- refused while that is true, and the answer names the societies, because
-- "you cannot delete your account" without saying why is the kind of dead end
-- people mail support about.
--
-- A society where you are the only member at all is not that case: nobody else
-- is left to strand, so leaving is allowed — and the society goes with you.
-- That last part is deliberate. A society with no members is not dormant, it
-- is unreachable: every read is gated on membership, joining needs a committee
-- member to admit you or to mint a code, and there is no longer one. Leaving
-- the row behind would keep a society's events, bills and contributions on
-- disk for ever, readable by nobody and deletable by nobody, which is the
-- opposite of what somebody asking to be deleted is asking for.
-- ============================================================================

create or replace function public.delete_my_account()
returns table (status text, detail text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_blocked text;
  v_deleted integer;
  v_doomed  uuid;
begin
  if v_uid is null then
    return query select 'unauthenticated'::text, null::text;
    return;
  end if;

  select string_agg(c.name, ', ' order by c.name)
    into v_blocked
    from public.memberships m
    join public.communities c on c.id = m.community_id
   where m.user_id = v_uid
     and m.role = 'committee'
     and m.status = 'active'
     -- Nobody else on the committee to hand it to ...
     and not exists (
       select 1
         from public.memberships peer
        where peer.community_id = m.community_id
          and peer.user_id <> v_uid
          and peer.role = 'committee'
          and peer.status = 'active'
     )
     -- ... and somebody left behind who would need one.
     and exists (
       select 1
         from public.memberships peer
        where peer.community_id = m.community_id
          and peer.user_id <> v_uid
          and peer.status = 'active'
     );

  if v_blocked is not null then
    return query select 'last_committee'::text, v_blocked;
    return;
  end if;

  -- Whatever is left of the check above: societies where this is the last
  -- active committee member and, per that check, nobody active to strand. The
  -- society goes, before its last member does.
  --
  -- It has to go in this order, and it has to say so. 0914.0100 put a trigger
  -- on memberships that refuses to delete a society's only committee member,
  -- and it would fire on the cascade from auth.users and take the whole
  -- deletion down with it. That trigger has always had one exemption — the
  -- community is being deleted, named by app.deleting_community — and this is
  -- exactly the case it was written for.
  for v_doomed in
    select m.community_id
      from public.memberships m
     where m.user_id = v_uid
       and m.role = 'committee'
       and m.status = 'active'
       and not exists (
         select 1
           from public.memberships peer
          where peer.community_id = m.community_id
            and peer.user_id <> v_uid
            and peer.role = 'committee'
            and peer.status = 'active'
       )
  loop
    perform set_config('app.deleting_community', v_doomed::text, true);
    delete from public.communities c where c.id = v_doomed;
  end loop;
  -- Narrow again straight away: the exemption should cover the deletes above
  -- and nothing else, least of all the cascade that follows.
  perform set_config('app.deleting_community', '', true);

  -- One statement, and the foreign keys do the rest. Deleting the auth user
  -- rather than the profile matters: a profile deleted on its own leaves an
  -- account that can still sign in, which is not a deletion, it is a reset.
  delete from auth.users u where u.id = v_uid;
  get diagnostics v_deleted = row_count;

  -- Zero rows would mean telling somebody their account is gone while it is
  -- still there and still signed in. That is the one outcome worse than an
  -- error, so it is an error.
  if v_deleted = 0 then
    raise exception 'account not deleted' using errcode = 'P0001';
  end if;

  return query select 'deleted'::text, null::text;
end;
$$;

-- PostgreSQL grants EXECUTE to PUBLIC by default and Supabase adds `anon` on
-- top; both have to go before the one grant that is wanted means anything.
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Deletes the signed-in account and everything personal attached to it, '
  'leaving the society ledger intact but unlinked, exactly as the Privacy '
  'Policy describes. Refuses while the caller is the last committee member of '
  'a society that still has other members, and names those societies. Called '
  'by Delete account on the web and on the phone.';
