-- ============================================================================
-- Samudaya · 0921.0400 · The vote that was never built, and the names that lie
-- ----------------------------------------------------------------------------
-- Two pieces of housekeeping, neither of which changes what anybody can do.
--
-- 1. Fund reallocation voting goes. It was built in 0870 as the answer to
--    "money residents gave for one purpose cannot be moved to another on an
--    admin's say-so" — a proposal, a threshold, a vote, an audit row. Every
--    part of it exists and none of it is reachable: nothing in either app has
--    ever inserted a proposal, and the card that would collect the votes
--    (ReallocationCard, wired to a working server action) is exported and
--    never rendered.
--
--    0921.0300 then settled the same question a different way — the committee
--    decides a closed event's surplus at closure, and the decision is a
--    fund_movements row every member can read — so the voting path is not
--    merely unreachable now but superseded.
--
--    Leaving it would be worse than either. A transparency mechanism the spec
--    describes, the schema carries and nobody can reach is a claim the product
--    cannot honour; the next person to read governance.sql would reasonably
--    believe moving money takes a vote.
--
--    There is nothing to preserve: production holds zero proposals and zero
--    votes, checked before writing this.
--
-- 2. Twenty-four policies are renamed, and nothing else about them changes.
--    0913.0300 renamed the role helpers in place — the old app.is_committee
--    (coordinators) became app.is_staff, and the old app.is_admin became
--    app.is_committee. Policies bind to a function by OID, so every policy
--    written before that day kept working and started meaning something other
--    than its name:
--
--      · nine *_committee policies enforce app.is_staff — staff or above
--      · fourteen *_admin policies enforce app.is_committee, and `admin` is a
--        retired role that memberships_role_not_retired forbids outright
--
--    Nobody has been let in or shut out by this, and nobody is by fixing it:
--    `alter policy ... rename to` touches the name and not the expression. The
--    suite gains a sweep so a name that lies fails the day it lands, rather
--    than thirteen months later when somebody greps for "who can approve a
--    bill" and believes the answer.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · The vote nobody could cast
-- ---------------------------------------------------------------------------

-- Order matters only for the function: the tables take their own policies,
-- indexes, triggers and the votes' foreign key with them.
drop function if exists public.vote_on_reallocation(uuid, boolean, public.origin_channel);
drop view if exists public.reallocation_results;
drop table if exists public.reallocation_votes;
drop table if exists public.fund_reallocations;

-- public.proposal_status stays: polls use it too, and they are reachable.

-- ---------------------------------------------------------------------------
-- 2 · Names that say what they enforce
-- ---------------------------------------------------------------------------

-- Nine that say committee and mean staff-or-above.
alter policy activity_suggestions_update_committee on public.activity_suggestions
  rename to activity_suggestions_update_staff;
alter policy announcements_write_committee on public.announcements
  rename to announcements_write_staff;
alter policy event_activities_write_committee on public.event_activities
  rename to event_activities_write_staff;
alter policy event_tasks_write_committee on public.event_tasks
  rename to event_tasks_write_staff;
alter policy events_write_committee on public.events
  rename to events_write_staff;
alter policy expenses_insert_committee on public.expenses
  rename to expenses_insert_staff;
alter policy poll_options_write_committee on public.poll_options
  rename to poll_options_write_staff;
alter policy polls_write_committee on public.polls
  rename to polls_write_staff;
alter policy volunteer_roles_write_committee on public.volunteer_roles
  rename to volunteer_roles_write_staff;

-- Fourteen that say admin — a role no membership may hold — and mean committee.
alter policy api_keys_admin_all on public.api_keys
  rename to api_keys_committee_all;
alter policy audit_logs_admin_read on public.audit_logs
  rename to audit_logs_committee_read;
alter policy communities_update_admin on public.communities
  rename to communities_update_committee;
alter policy contributions_delete_admin on public.contributions
  rename to contributions_delete_committee;
alter policy contributions_write_admin on public.contributions
  rename to contributions_write_committee;
alter policy expenses_delete_admin on public.expenses
  rename to expenses_delete_committee;
alter policy invite_codes_admin_all on public.invite_codes
  rename to invite_codes_committee_all;
alter policy memberships_delete_admin on public.memberships
  rename to memberships_delete_committee;
alter policy memberships_insert_admin on public.memberships
  rename to memberships_insert_committee;
alter policy memberships_update_admin on public.memberships
  rename to memberships_update_committee;
alter policy unit_occupants_write_admin on public.unit_occupants
  rename to unit_occupants_write_committee;
alter policy units_write_admin on public.units
  rename to units_write_committee;
-- Two that are "your own row, or the committee's business". Named for both,
-- because "admin_read" said neither.
alter policy invite_code_redemptions_admin_read on public.invite_code_redemptions
  rename to invite_code_redemptions_read_own_or_committee;
alter policy whatsapp_messages_admin_read on public.whatsapp_messages
  rename to whatsapp_messages_read_own_or_committee;

-- And the one that was half right: USING is committee-or-your-own-pending-row,
-- WITH CHECK is staff. `admin` was the only wrong word in it.
alter policy expenses_update_own_pending_or_admin on public.expenses
  rename to expenses_update_own_pending_or_committee;

comment on table public.polls is
  'The reachable half of 0870. Fund reallocation voting, its neighbour in that '
  'migration, was dropped in 0921.0400: nothing ever created a proposal, and '
  '0921.0300 settled where a surplus goes a different way.';
