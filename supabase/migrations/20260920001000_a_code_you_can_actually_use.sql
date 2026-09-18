-- ============================================================================
-- Samudaya · 0920.1000 · A code you can actually use
-- ----------------------------------------------------------------------------
-- 0920.0900 recorded that per-flat invite codes are a live feature and said
-- what was missing:
--
--   "A code can be created and cannot be redeemed. Nothing calls
--    preview_invite_code or redeem_invite_code ... the change that builds the
--    redemption flow is the change that should grant them, in the same commit
--    as the screen that calls them, so the grant and its reason arrive
--    together."
--
-- This is that change. The screens land with it: /onboarding?mode=invite and
-- /invite/CODE on the web, and the Invite screen on the phone.
--
-- Nothing about the functions themselves changes. They were written whole in
-- 0912.0500 and have been waiting ever since — the row is locked before the
-- use count is read, so two people racing for the last use of a code cannot
-- both get in; re-entering a code you already used returns your existing seat
-- instead of a second membership; ten wrong codes in fifteen minutes stops you;
-- and a unit-bound code seats the resident in that flat, as primary occupant if
-- the flat has none. What was missing was a caller and a grant.
--
-- preview_invite_code is granted as well as redeem. Showing somebody which
-- society, which role and which flat a code is for before they commit to it is
-- the difference between joining and guessing, and it costs nothing: it reads
-- the same rate limiter and returns no more than the redeem call would.
-- ============================================================================

grant execute on function public.preview_invite_code(text) to authenticated;
grant execute on function
  public.redeem_invite_code(text, public.origin_channel) to authenticated;

comment on function public.redeem_invite_code(text, public.origin_channel) is
  'Redeems a per-flat invite code: seats the member, seats them in the flat if '
  'the code names one, counts the use and records the redemption. Idempotent — '
  'a code you already used returns the seat you already have. Called by the '
  'invite screens on web and mobile.';

comment on function public.preview_invite_code(text) is
  'Shows which society, role and flat an invite code is for, before it is '
  'redeemed, so nobody joins a society by guessing. Shares redeem''s rate '
  'limiter and reveals nothing redeeming would not.';

-- ---------------------------------------------------------------------------
-- And the half that has never worked at all
-- ---------------------------------------------------------------------------
-- Wiring a screen to create_invite_code found something neither 0920.0700 nor
-- 0920.0900 did, because both were reading grants rather than calling it:
--
--   ERROR: invalid input value for enum public.member_role: "owner"
--   CONTEXT: PL/pgSQL function public.create_invite_code(...) line 12 at IF
--
-- The function opens with `if p_role = 'owner'`, guarding a role that stopped
-- existing when 0913.0300 cut the model down to resident/staff/committee.
-- member_role has no 'owner', so the comparison cannot be evaluated and every
-- call raises before it reaches the insert — whatever arguments it is given.
--
-- So create_invite_code has never once succeeded. Production agrees: zero rows
-- in invite_codes, ever. The admin invites page has been erroring for every
-- committee member who has opened it since the day it shipped, and the debate
-- in 0913.0300 and 0920.0900 about whether the feature was "switched off" was
-- being had about a function that could not run either way.
--
-- The guard's intent survives, pointed at the role that actually needs
-- stopping. 'admin' is retired and memberships_role_not_retired rejects it, so
-- a code carrying it would fail at redemption — for the resident, in front of
-- them, long after the mistake was made. Failing at mint time puts the error
-- where the choice is.
create or replace function public.create_invite_code(
  p_community_id uuid,
  p_role         public.member_role default 'resident',
  p_unit_id      uuid default null,
  p_relation     public.occupant_relation default 'owner',
  p_max_uses     integer default 1,
  p_expires_at   timestamptz default null,
  p_label        text default null
)
returns public.invite_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_row public.invite_codes;
  v_attempt integer := 0;
begin
  if not app.is_admin(p_community_id) then
    raise exception 'Only a community admin can create invite codes'
      using errcode = '42501';
  end if;

  -- 0913.0300 reduced the roles to resident/staff/committee and retired
  -- 'admin'; 'owner' stopped existing. This guard was left comparing p_role
  -- against it, so every call raised "invalid input value for enum
  -- public.member_role" before reaching the insert. The retired role is what
  -- actually needs stopping: memberships_role_not_retired rejects it, so a code
  -- carrying 'admin' would fail at redemption, for the resident, long after the
  -- committee member who minted it had gone.
  if p_role = 'admin' then
    raise exception 'That role is retired; invite as resident, staff or committee'
      using errcode = '22P02';
  end if;

  if p_unit_id is not null and not exists (
    select 1 from public.units u
     where u.id = p_unit_id and u.community_id = p_community_id
  ) then
    raise exception 'That unit does not belong to this community'
      using errcode = '23503';
  end if;

  -- Retry on the astronomically unlikely collision rather than failing the
  -- admin's request.
  loop
    v_attempt := v_attempt + 1;
    v_code := app.random_code(8);
    begin
      insert into public.invite_codes (
        community_id, code, label, role, unit_id, relation,
        max_uses, expires_at, created_by
      )
      values (
        p_community_id, v_code, p_label, p_role, p_unit_id, p_relation,
        p_max_uses, p_expires_at, (select auth.uid())
      )
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      if v_attempt >= 8 then
        raise exception 'Could not allocate a unique invite code';
      end if;
    end;
  end loop;
end;
$$;
