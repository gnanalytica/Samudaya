-- ============================================================================
-- Samudaya · 0918.0200 · A vote nobody can watch you cast, and one that ends
-- ----------------------------------------------------------------------------
-- Two things were missing from suggestion voting, and the codebase already had
-- the right answer to both — for polls.
--
--   1. "Results are public; who voted for what is not" is the rule written
--      above public.poll_results. Suggestions never followed it:
--      suggestion_votes_select_member let any member read every row, so
--      `GET /rest/v1/suggestion_votes` said who was for and who was against.
--      The screens only ever showed totals; the API did not.
--
--      In a society of 200 flats, a resident voting against the committee's
--      idea is entitled to do so without it being a matter of record.
--
--   2. Nothing ever ended. There is no closes_at and no threshold, and
--      'accepted' means "open for voting" — so a suggestion that won 40 to 3
--      stayed "Voting" for ever and nothing wrote down that the society had
--      said yes. fund_reallocations, next door, has threshold_pct, closes_at
--      and resolved_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · The tally is public. The ballot is not.
-- ---------------------------------------------------------------------------
-- Counting moves into the view that already holds a suggestion's numbers, so
-- the totals survive without anybody reading the rows they are made of.
create or replace view public.suggestion_stats
with (security_invoker = false) as
select s.id as suggestion_id,
       s.community_id,
       count(distinct i.membership_id)::integer as interested,
       count(*) filter (where v.support)::integer     as votes_for,
       count(*) filter (where not v.support)::integer as votes_against
  from public.activity_suggestions s
  left join public.suggestion_interests i on i.suggestion_id = s.id
  left join public.suggestion_votes v on v.suggestion_id = s.id
 where app.is_member(s.community_id)
 group by s.id, s.community_id;

grant select on public.suggestion_stats to authenticated, service_role;

-- You may read your own ballot, so a screen can show which way you went and
-- offer to change it. Everyone else's is none of your business.
drop policy if exists suggestion_votes_select_member on public.suggestion_votes;

create policy suggestion_votes_select_own
  on public.suggestion_votes for select to authenticated
  using (
    exists (
      select 1 from public.activity_suggestions s
       where s.id = suggestion_votes.suggestion_id
         and suggestion_votes.membership_id = app.my_membership_id(s.community_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2 · Closing the vote
-- ---------------------------------------------------------------------------
alter table public.activity_suggestions
  add column if not exists resolved_at timestamptz;

-- 'accepted' is the open state. These two are where it goes.
alter type public.suggestion_status add value if not exists 'adopted';
alter type public.suggestion_status add value if not exists 'not_adopted';

-- Voting stops the moment the status moves, because every suggestion_votes
-- policy is keyed on status = 'accepted'. Nothing else has to remember.
create or replace function public.close_suggestion_vote(
  p_suggestion_id uuid,
  -- Left null, the count decides. Passed explicitly, the committee does — a
  -- society may have agreed something in the room that the tally missed.
  p_adopt boolean default null
)
returns public.activity_suggestions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.activity_suggestions;
  v_for integer;
  v_against integer;
begin
  select * into v_row
    from public.activity_suggestions s
   where s.id = p_suggestion_id
   for update;

  if v_row.id is null then
    raise exception 'No such suggestion' using errcode = 'P0002';
  end if;

  if not app.is_committee(v_row.community_id) then
    raise exception 'Only the committee can close a vote' using errcode = '42501';
  end if;

  if v_row.status <> 'accepted' then
    return v_row;  -- already closed, or never opened; a repeat click is a no-op
  end if;

  select count(*) filter (where support), count(*) filter (where not support)
    into v_for, v_against
    from public.suggestion_votes
   where suggestion_id = p_suggestion_id;

  update public.activity_suggestions
     set status = case
           when coalesce(p_adopt, v_for > v_against) then 'adopted'
           else 'not_adopted'
         end::public.suggestion_status,
         resolved_at = now()
   where id = p_suggestion_id
   returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.close_suggestion_vote(uuid, boolean)
  to authenticated, service_role;
