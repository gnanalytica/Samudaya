-- ============================================================================
-- Samudaya · 0920.0300 · Who voted for it
-- ----------------------------------------------------------------------------
-- 0918.0200 made every ballot secret, on the reasoning that a resident voting
-- against the committee's idea should not have it on the record. The society
-- wants something narrower, and it is a defensible line:
--
--   · a vote in favour is public to every member — a suggestion with fourteen
--     named supporters reads as a petition, and people who sign one generally
--     want their name on it
--   · a vote against is visible to the committee only
--   · who has not voted is visible to nobody, because there is no row to see —
--     abstention stays private without anyone deciding that it should
--
-- The risk this accepts, stated plainly because it is the committee that will
-- live with it: the people who can see a "no" are usually the people the "no"
-- was about. A resident who suspects that will vote yes or not at all, and the
-- tally quietly stops meaning what it says. Totals come from suggestion_stats
-- either way, so nothing downstream depends on this choice.
-- ============================================================================

drop policy if exists suggestion_votes_select_own on public.suggestion_votes;

create policy suggestion_votes_select_visible
  on public.suggestion_votes for select to authenticated
  using (
    exists (
      select 1
        from public.activity_suggestions s
       where s.id = suggestion_votes.suggestion_id
         and app.is_member(s.community_id)
         and (
           -- Your own ballot, always — a screen has to be able to show you
           -- which way you went, and offer to change it.
           suggestion_votes.membership_id = app.my_membership_id(s.community_id)
           -- Support is public to the society.
           or suggestion_votes.support
           -- Opposition is not.
           or app.is_committee(s.community_id)
         )
    )
  );

comment on table public.suggestion_votes is
  'One ballot per member per suggestion. Votes in favour are readable by every '
  'member; votes against by the committee and the voter alone. Totals come '
  'from suggestion_stats, which counts without exposing rows.';
