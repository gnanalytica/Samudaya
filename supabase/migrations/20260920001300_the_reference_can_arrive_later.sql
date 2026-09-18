-- ============================================================================
-- Samudaya · 0920.1300 · The reference can arrive later
-- ----------------------------------------------------------------------------
-- Reporting a payment has required a 12-digit UTR since the day it was built,
-- and on an iPhone or the website that means: leave Samudaya, open GPay or
-- PhonePe, find the payment, open it, find the line called "UPI transaction
-- ID", memorise or copy twelve digits, come back, type them. Every resident who
-- gives up at that step has still paid — so the money lands in the society's
-- account with nothing pointing at who sent it, and turns up on the Reconcile
-- screen as a line nobody can explain.
--
-- Android residents never see this: the UPI app is opened for a result and
-- hands the reference back, and the report files itself.
--
-- So the reference stops being the price of reporting. A screenshot is enough,
-- and people take one anyway.
--
-- That is not the reference being abandoned, because it is what reconciliation
-- runs on: bank_line_candidates matches on the UTR first, and falls back to
-- amount-within-a-fortnight — which is no help at all when sixty flats each
-- pay ₹2,100 in the same week and every candidate looks identical.
--
-- The resolution is that the screenshot *contains* the reference. Every UPI
-- app prints it on the success screen. So the resident uploads the picture,
-- and whoever confirms the payment — who has the bank statement open anyway —
-- reads the reference off it and records it here.
--
-- The app decides the reference can be missing. The ledger does not: staff
-- recording a cash payment for a flat have never supplied one, so there is no
-- constraint to add, only a rule about what the contribute form will accept.
-- ============================================================================

-- Adding a defaulted parameter makes a new signature rather than replacing the
-- old one, and two overloads differing only by a trailing default is how a
-- caller gets "could not choose a best candidate function". Drop, then create.
drop function if exists public.review_contribution(uuid, boolean, text);

create or replace function public.review_contribution(
  p_contribution_id uuid,
  p_confirm         boolean,
  p_note            text default null,
  p_reference       text default null
)
returns public.contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contributions;
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
begin
  select * into v_row from public.contributions c where c.id = p_contribution_id for update;
  if v_row.id is null then
    raise exception 'No such payment' using errcode = 'P0002';
  end if;

  if not app.is_staff(v_row.community_id) then
    raise exception 'Only staff or the committee can confirm payments'
      using errcode = '42501';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'This payment has already been reviewed'
      using errcode = '22023';
  end if;

  if not p_confirm and coalesce(btrim(p_note), '') = '' then
    raise exception 'Say why the payment could not be confirmed'
      using errcode = '22023';
  end if;

  update public.contributions
     set status = case when p_confirm then 'succeeded' else 'failed' end::public.contribution_status,
         -- The reference staff read off the screenshot, or off the statement.
         -- It overwrites what the resident typed rather than deferring to it:
         -- the person confirming is looking at the evidence and at the bank,
         -- and a mistyped digit that can never be corrected is worse than a
         -- correction the audit trail records. Leaving it out changes nothing,
         -- so confirming without one is still a one-tap act.
         reference = coalesce(v_ref, v_row.reference),
         verified_by = app.my_membership_id(v_row.community_id),
         verified_at = now(),
         review_note = p_note
   where id = p_contribution_id
   returning * into v_row;

  return v_row;
end;
$$;

-- Dropping the function threw its ACL away with it, and a newly created one
-- starts with EXECUTE granted to PUBLIC — plus `anon` on top, from Supabase's
-- own bootstrap. That is the whole of what 0920.0600 through 0920.0800 were
-- about, and re-creating a function is the one move that quietly undoes them.
-- The suite noticed within a minute; these two lines are why it stays noticed.
revoke all on function public.review_contribution(uuid, boolean, text, text) from public;
revoke all on function public.review_contribution(uuid, boolean, text, text) from anon;

grant execute on function public.review_contribution(uuid, boolean, text, text)
  to authenticated, service_role;

comment on function public.review_contribution(uuid, boolean, text, text) is
  'Staff confirm or turn down a reported payment, optionally recording the UPI '
  'reference read off the resident''s screenshot. Confirming is what makes a '
  'payment count towards the fund.';
