-- ============================================================================
-- Samudaya · 0921.0100 · The note says whose money it is
-- ----------------------------------------------------------------------------
-- Every payment Samudaya starts already carries a note — "A-1104 GANESH" — and
-- that note rides to the society's bank statement. Nothing has ever read it
-- back, so a credit from a resident who never got round to reporting arrives
-- as a line nobody can explain, sitting next to fifty-nine other lines for the
-- same ₹2,100.
--
-- The note is now written as one contiguous token first — SMDA1104 — because a
-- narration preserves a run of letters and digits and mangles everything else,
-- and because banks truncate from the right, so the part that matters goes on
-- the left. See upiNote in @samudaya/core; these two functions are its other
-- half.
--
-- What changes for the person reconciling: a line that names a flat now offers
-- that flat's payment first, and offers it *at all* in the case that mattered
-- most and was missing.
--
-- bank_line_candidates has only ever offered a pairing when the amounts were
-- within a rupee. But the reported amount is the payer's own figure — the
-- product spec has said since the reconciliation engine landed that "where the
-- bank and the payer disagree on the amount, a person chooses which figure the
-- books keep". A resident who reported ₹2,100 and actually sent ₹2,000 was
-- exactly that case, and the candidate list stayed empty: the one disagreement
-- the design anticipated was the one it could not show you.
--
-- With the flat named on the line, it can. A tag match inside the same
-- fortnight is offered whatever the amounts say, and ranked below only an
-- exact UTR — because the flat is a claim about *whose* money it is, which is
-- the question that was actually being asked.
-- ============================================================================

-- `A-1104`, `a 1104` and `A1104` are one flat. A narration keeps none of those
-- shapes, so both sides of any comparison are flattened to the last one.
create or replace function app.normalize_flat(p_label text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_label, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Searched rather than parsed: by the time the token reaches a statement it is
-- wrapped in the bank's own punctuation, and which punctuation depends on the
-- bank. Mirrors flatTagIn in @samudaya/core, and a test holds them together.
create or replace function app.flat_tag_in(p_narration text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(upper(coalesce(
    (regexp_match(coalesce(p_narration, ''), 'SMD([A-Za-z0-9]{1,12})', 'i'))[1], '')), '');
$$;

comment on function app.flat_tag_in(text) is
  'The flat a bank narration names, from the SMD token upiNote() writes into '
  'the UPI note. Null when the payer did not keep the note.';

create or replace function public.bank_line_candidates(p_transaction_id uuid)
returns table (
  contribution_id uuid,
  payer           text,
  amount          numeric,
  reported_on     timestamptz,
  reference       text,
  confidence      text
)
language sql
stable
security definer
set search_path = ''
as $$
  with line as (
    select t.*, app.flat_tag_in(t.narration) as flat_tag
      from public.bank_transactions t
     where t.id = p_transaction_id
       and app.is_staff(t.community_id)
       and t.contribution_id is null
       and t.expense_id is null
  ),
  scored as (
    select
      c.id,
      coalesce(p.full_name, 'A resident') as payer,
      c.amount,
      c.paid_at,
      c.reference,
      (c.reference is not null and l.reference is not null
       and upper(btrim(c.reference)) = upper(btrim(l.reference))) as ref_match,
      (l.flat_tag is not null
       and app.normalize_flat(app.flat_label(c.unit_id)) = app.normalize_flat(l.flat_tag)
       and app.normalize_flat(app.flat_label(c.unit_id)) <> '') as flat_match,
      (c.amount = l.amount) as exact_amount,
      (abs(c.amount - l.amount) <= 1) as near_amount,
      abs(extract(epoch from c.paid_at - l.posted_on::timestamptz)) as apart,
      (c.paid_at between l.posted_on - interval '14 days'
                     and l.posted_on + interval '14 days') as in_window
      from line l
      join public.contributions c
        on c.community_id = l.community_id
       and c.status = 'pending'
      left join public.memberships m on m.id = c.membership_id
      left join public.profiles p on p.id = m.user_id
     where l.amount > 0
  )
  select
    s.id, s.payer, s.amount, s.paid_at, s.reference,
    case
      when s.ref_match then 'reference'
      -- The line names this flat. Offered whatever the amounts say, which is
      -- the whole point: a payer who reported the wrong figure is the case
      -- this list could not reach before.
      when s.flat_match then 'flat'
      when s.exact_amount then 'amount'
      else 'close'
    end
    from scored s
   where s.ref_match
      or (s.flat_match and s.in_window)
      or (s.near_amount and s.in_window)
   order by
     case when s.ref_match then 0 when s.flat_match then 1
          when s.exact_amount then 2 else 3 end,
     s.apart
   limit 20;
$$;

-- Recreating a function throws its ACL away, and a new one starts with EXECUTE
-- granted to PUBLIC plus anon from Supabase's bootstrap. 0920.1300 learned this
-- the same way; the suite catches it either way, and these lines mean it has
-- nothing to catch.
revoke all on function public.bank_line_candidates(uuid) from public;
revoke all on function public.bank_line_candidates(uuid) from anon;
grant execute on function public.bank_line_candidates(uuid) to authenticated;

comment on function public.bank_line_candidates(uuid) is
  'Candidate pairings for one unmatched statement line, best first: the UTR, '
  'then the flat the narration names, then the amount. A flat match is offered '
  'whatever the amounts say, because the payer''s own figure is the thing most '
  'likely to be wrong.';
