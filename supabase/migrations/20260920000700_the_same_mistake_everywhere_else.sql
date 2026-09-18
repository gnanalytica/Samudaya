-- ============================================================================
-- Samudaya · 0920.0700 · The same mistake, everywhere else
-- ----------------------------------------------------------------------------
-- 0920.0600 closed seven functions that anon could call. Supabase's linter was
-- listing seventeen more, all older than this batch, all with the same shape:
-- a SECURITY DEFINER function that checks the caller inside its own body, and a
-- grant nobody had looked at.
--
-- Two claims made in 0920.0600 turn out to be wrong, and both are corrected
-- here rather than left standing.
--
-- The first: "the join flow genuinely runs before you have an account". It does
-- not. /join/CODE redirects a visitor with no session to /login and only then
-- to the join form; mobile's index sends a user with no session to /sign-in.
-- Every RPC in that flow — society_units, request_to_join, create_society — is
-- called after requireUser(). What a joiner lacks is a *membership*, not an
-- auth session, and the two are easy to confuse. So nothing in this app needs
-- anon to execute anything, and the exception carved out last time was imagined.
--
-- The second: that this was a new mistake. It is not. 0913.0300 says
--
--   -- Per-flat invite codes are switched off; everyone joins with the society code.
--   revoke execute on function public.create_invite_code from authenticated;
--
-- and that revoke did remove authenticated's own grant — the ACL shows it gone.
-- The functions stayed callable anyway, by authenticated and anon alike, on
-- PUBLIC's grant, which the revoke never touched. A deliberate decision to
-- switch a feature off has been silently not in effect for five days.
--
-- ---------------------------------------------------------------------------
-- What this does, and the one thing it deliberately does not
-- ---------------------------------------------------------------------------
-- All seventeen lose PUBLIC and anon. service_role keeps the explicit grant it
-- already holds on every one of them, so the WhatsApp bot and the API are
-- untouched; authenticated keeps its own on the fourteen that have it.
--
-- create_invite_code is the awkward one. 0913.0300 meant to switch it off, and
-- apps/web/.../admin/invites still calls it — working only because of the
-- PUBLIC grant this file removes. Honouring that revoke would break a page
-- somebody is presumably using, which is a product decision and not one a
-- security fix should make on its way past. So it is granted to authenticated
-- explicitly here: today's behaviour, now stated on purpose instead of
-- surviving by accident. Deciding whether the page or the comment goes is a
-- separate change.
--
-- preview_invite_code and redeem_invite_code have no caller anywhere — not the
-- web app, not mobile, not the API, not the WhatsApp bot. 0913.0300 said to
-- retire them and only a technicality stopped it, so they lose PUBLIC and anon
-- and are not granted back to authenticated. That completes a decision already
-- taken rather than making a new one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Members and staff: everything here needs a session
-- ---------------------------------------------------------------------------
revoke execute on function public.my_contact() from public, anon;
revoke execute on function public.society_people(uuid) from public, anon;
revoke execute on function public.society_units(text) from public, anon;
revoke execute on function public.mark_welcomed(uuid) from public, anon;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
revoke execute on function
  public.request_to_join(text, uuid, text, text, public.occupant_relation) from public, anon;
revoke execute on function
  public.create_society(text, text, text, text, text) from public, anon;
revoke execute on function
  public.vote_on_reallocation(uuid, boolean, public.origin_channel) from public, anon;
revoke execute on function public.close_suggestion_vote(uuid, boolean) from public, anon;
revoke execute on function public.create_whatsapp_link_code(uuid) from public, anon;
revoke execute on function public.join_request_contacts(uuid) from public, anon;
revoke execute on function public.review_contribution(uuid, boolean, text) from public, anon;
revoke execute on function
  public.review_expense(uuid, public.expense_status, text) from public, anon;
revoke execute on function
  public.review_join_request(uuid, boolean, public.member_role, text) from public, anon;

-- ---------------------------------------------------------------------------
-- Invite codes: switched off in 0913.0300, and now actually switched off
-- ---------------------------------------------------------------------------
revoke execute on function
  public.preview_invite_code(text) from public, anon;
revoke execute on function
  public.redeem_invite_code(text, public.origin_channel) from public, anon;

revoke execute on function
  public.create_invite_code(
    uuid, public.member_role, uuid, public.occupant_relation, integer, timestamptz, text
  ) from public, anon;
-- Not a new grant: this is the access the admin invites page has been using all
-- along through PUBLIC, written down so removing PUBLIC does not take it away
-- by surprise. If the page should go, that revoke belongs in its own change.
grant execute on function
  public.create_invite_code(
    uuid, public.member_role, uuid, public.occupant_relation, integer, timestamptz, text
  ) to authenticated;
