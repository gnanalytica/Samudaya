-- ============================================================================
-- Samudaya · 0920.0200 · Nothing counts until somebody confirms it
-- ----------------------------------------------------------------------------
-- The rule already mostly holds. event_stats sums only status = 'succeeded',
-- 0913.0400 made 'pending' the column default, and a resident reporting their
-- own UPI payment is refused any other status by the insert policy.
--
-- What is missing is the name. A contribution can reach 'succeeded' without
-- anybody being recorded as having said so:
--
--   · staff recording cash they collected insert 'succeeded' directly, and
--     leave verified_by null — the money is confirmed, the confirmer is not
--   · review_contribution() does set verified_by, so the reported-then-checked
--     path is already covered
--
-- So a society auditing its own books a year later can see that a payment was
-- accepted but not who accepted it, which is precisely the question an audit
-- asks. This stamps the confirmer on the way in, from whoever is signed in.
--
-- It is a trigger rather than a check constraint on purpose. A constraint would
-- reject the rows a seed, an import or the service role writes — work with no
-- person behind it, where the honest value is null and refusing it helps
-- nobody. The trigger records a name whenever there is one to record.
-- ============================================================================

/**
 * Names whoever put a contribution into 'succeeded', if it does not already
 * name someone. Runs before insert and before update, because both can be the
 * moment money starts counting towards a fund.
 *
 * Leaves an existing verified_by alone: review_contribution() sets it from the
 * actor it has already checked, and that is the more specific answer.
 */
create or replace function app.stamp_verified_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'succeeded' and new.verified_by is null then
    new.verified_by := app.my_membership_id(new.community_id);
    new.verified_at := coalesce(new.verified_at, now());
  end if;
  return new;
end;
$$;

create trigger contributions_stamp_verified_by
  before insert or update on public.contributions
  for each row execute function app.stamp_verified_by();

comment on column public.contributions.status is
  'pending until somebody confirms the money arrived; only succeeded rows '
  'count towards a fund (see event_stats). Defaults to pending on purpose: a '
  'path that forgets to set it should under-count, never over-count.';

comment on column public.contributions.verified_by is
  'Who confirmed this money arrived — the staff member who reviewed the '
  'reported payment, or the one who recorded the cash. Stamped automatically '
  'whenever a row reaches succeeded with a signed-in member behind it.';

-- The amount a resident types when reporting is what gets stored, because it
-- is what they actually paid — the preset they tapped first is a convenience,
-- not a record. It is confirmed against the statement either way, so a
-- mistyped amount is caught at the same place a mistyped reference is.
comment on column public.contributions.amount is
  'What the payer says they paid, in rupees. Confirmed against the bank '
  'statement before the row reaches succeeded.';
