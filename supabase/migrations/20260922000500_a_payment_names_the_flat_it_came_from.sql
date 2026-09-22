-- ============================================================================
-- Samudaya · 0922.0500 · A reported payment names the flat it came from
-- ----------------------------------------------------------------------------
-- The Money page shows the flat beside the payer's name wherever it knows one,
-- and for some rows it never will:
--
--   Pranav Aditya      Upi · 21 Sept 2026 · Diwali    -- no flat, anywhere
--
-- Not the view's fault and not the screen's. The resident who made that
-- payment has no flat on record, so `contributions.unit_id` was null, the
-- occupancy fallback found nothing to borrow, and even the UPI note went out
-- without the `#FLAT` token the bank matcher reads. A member who joined
-- before anybody listed them at a door pays, and every payment they will ever
-- make is anonymous as to which flat it came from.
--
-- The screens now ask, on the Contribute form, when the society has no flat
-- for the payer — and the answer lands on the payment. Which means a value a
-- resident chose is written to `unit_id` for the first time, so the policy has
-- to say what a resident may choose: a flat in their own society, or none.
--
-- Not "a flat they live in". They are paying precisely because nobody has
-- listed them at one yet, and a payment is a claim staff confirm against the
-- bank before it counts — the same trust the amount has always had. The
-- boundary that matters is the society: one society's ledger must never be
-- able to credit another society's door.
-- ============================================================================

drop policy if exists contributions_insert_own on public.contributions;
create policy contributions_insert_own
  on public.contributions for insert to authenticated
  with check (
    app.can_participate(community_id)
    and membership_id = app.my_membership_id(community_id)
    and status = 'pending'
    and verified_by is null
    and exists (
      select 1 from public.events e
       where e.id = contributions.event_id
         and e.status = 'published'
    )
    -- The flat the payer names must be a door in this society, or none at all.
    and (
      contributions.unit_id is null
      or exists (
        select 1 from public.units u
         where u.id = contributions.unit_id
           and u.community_id = contributions.community_id
      )
    )
  );

comment on column public.contributions.unit_id is
  'The flat the money came from. Set by staff when they record a payment, and '
  'by the payer themselves when the society has no flat on record for them. '
  'Confirmed against the bank like everything else on the row.';
