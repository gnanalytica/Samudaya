-- ============================================================================
-- Samudaya · 0920.0900 · Invite codes were never switched off
-- ----------------------------------------------------------------------------
-- 0913.0300 says, above three revokes:
--
--   -- Per-flat invite codes are switched off; everyone joins with the society code.
--
-- That was wrong when it was written, and everything since has been reasoning
-- from it. docs/product-spec.md has said the opposite all along — "invite codes
-- remain as a second path: a code that is already approved, so the resident
-- skips the waiting step" — and the admin invites page has been creating them
-- the whole time. The spec was right; the comment was not.
--
-- The revokes did nothing anyway. They removed `authenticated`'s own grant
-- while PUBLIC's remained, so all three functions stayed callable for five days
-- until 0920.0600 and 0920.0700 removed PUBLIC. At that point create_invite_code
-- was granted back to authenticated deliberately, with a note that deciding
-- between the page and the comment was a product call rather than a security
-- one. That call has now been made: the codes stay, and the comment goes.
--
-- Nothing here changes what any role can do today. It is the record being
-- corrected, in the place the next person will look — beside the function
-- rather than in a migration from a fortnight ago.
-- ============================================================================

-- Not a change in access: create_invite_code already holds this from 0920.0700.
-- Restated so this file stands on its own, and so a reader who greps for the
-- grant finds the decision next to it rather than the revoke that contradicts it.
grant execute on function
  public.create_invite_code(
    uuid, public.member_role, uuid, public.occupant_relation, integer, timestamptz, text
  ) to authenticated;

comment on function public.create_invite_code(
  uuid, public.member_role, uuid, public.occupant_relation, integer, timestamptz, text
) is
  'Mints a per-flat invite code: a code that is already approved, so the '
  'resident skips the join request. In use by the admin invites page. '
  '0913.0300 called this feature switched off and 0920.0900 corrected that; '
  'the society code and request_to_join() are the other, busier path.';

-- ---------------------------------------------------------------------------
-- The half that does not exist yet
-- ---------------------------------------------------------------------------
-- preview_invite_code and redeem_invite_code stay ungranted, and that is not
-- the feature being switched off again. Nothing calls them: not the web app,
-- not mobile, not the v1 API, not the WhatsApp bot, and nothing has ever
-- written invite_code_redemptions. A code can be created and cannot yet be
-- redeemed, which makes the admin page a generator of codes with nowhere to go.
--
-- Granting EXECUTE on a function no caller exists for would widen the API
-- surface and fix nothing. The change that builds the redemption flow is the
-- change that should grant them, in the same commit as the screen that calls
-- them, so the grant and its reason arrive together.
comment on function public.redeem_invite_code(text, public.origin_channel) is
  'Redeems a per-flat invite code. No caller yet — the flow that would use it '
  'is unbuilt, so it is granted to service_role only. Grant it to '
  'authenticated in the change that adds the screen, not before.';

comment on function public.preview_invite_code(text) is
  'Shows what a per-flat invite code is for before it is redeemed. No caller '
  'yet; see redeem_invite_code().';
