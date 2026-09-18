-- ============================================================================
-- Samudaya · 0920.0400 · The bank's version of events
-- ----------------------------------------------------------------------------
-- Until now the society's books were a list of things people said happened. A
-- resident types a UTR, staff squint at a banking app in another tab, and tick
-- it off. Nothing in the database has ever seen the bank.
--
-- This is the other side: the account's own lines, kept as rows, and matched
-- against what the app believes. It is the shape Odoo uses, for the same
-- reason — a statement line is a fact, a contribution is a claim, and
-- reconciliation is the act of pairing them and admitting what is left over:
--
--   · money the app knows about that the bank has not seen  → not yet arrived
--   · money the bank saw that the app cannot explain        → unattributed
--   · pairs that agree                                      → confirmed
--
-- On "sync": a real feed needs an account aggregator, and India's AA framework
-- wants an RBI-licensed entity in the middle. That is a licensing question, not
-- a schema one. So the schema is the part built now, with one door in —
-- app.record_bank_lines() — that an upload calls today and a feed job can call
-- tomorrow under the service role, with nothing else changing. `source` says
-- which it was, and external_id makes both idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The account
-- ---------------------------------------------------------------------------
-- A society usually has one, sometimes two (a current account and the sinking
-- fund). The number is deliberately not stored in full: the last four digits
-- are enough to tell two accounts apart on screen, and a full account number
-- in a table read by every staff member is a liability nobody asked for.
create table public.bank_accounts (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  label         text not null,
  bank_name     text,
  last4         text,
  currency      char(3) not null default 'INR',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.memberships (id) on delete set null,
  constraint bank_accounts_label_not_blank check (length(btrim(label)) > 0),
  constraint bank_accounts_last4_digits check (last4 is null or last4 ~ '^[0-9]{4}$')
);

create index bank_accounts_community_idx on public.bank_accounts (community_id);

create trigger bank_accounts_touch_updated_at
  before update on public.bank_accounts
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- The lines
-- ---------------------------------------------------------------------------
create type public.bank_line_source as enum ('import', 'feed', 'manual');

create table public.bank_transactions (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  account_id    uuid not null references public.bank_accounts (id) on delete cascade,
  posted_on     date not null,
  -- Signed, the way a statement reads it: money in is positive, money out is
  -- negative. One column rather than debit/credit, because every query here
  -- wants the direction and the size together, and two columns where one is
  -- always null is a standing invitation to add them up wrongly.
  amount        numeric(12, 2) not null,
  -- What the bank calls it. Narration is the free text ("UPI/612345678901/
  -- RIA MENON/HDFC"), reference is the UTR if the statement gave one cleanly.
  narration     text,
  reference     text,
  counterparty  text,
  balance_after numeric(14, 2),
  source        public.bank_line_source not null default 'import',
  -- The bank's own identifier for the line where there is one, otherwise a
  -- digest of the line's contents. Either way it is what stops the same
  -- statement, imported twice, becoming twice the money.
  external_id   text not null,
  -- What this line turned out to be. Exactly one at most: a line is a
  -- contribution or an expense, never both, and often neither yet.
  contribution_id uuid references public.contributions (id) on delete set null,
  expense_id      uuid references public.expenses (id) on delete set null,
  matched_by    uuid references public.memberships (id) on delete set null,
  matched_at    timestamptz,
  -- Set when staff decide a line will never be matched — a bank charge, a
  -- transfer between the society's own accounts, interest. Written down so it
  -- stops appearing in the unexplained list without being deleted, because
  -- deleting the bank's own record of itself is not reconciliation.
  ignored_reason text,
  imported_at   timestamptz not null default now(),
  imported_by   uuid references public.memberships (id) on delete set null,
  constraint bank_transactions_amount_nonzero check (amount <> 0),
  constraint bank_transactions_one_subject check (num_nonnulls(contribution_id, expense_id) <= 1),
  -- A matched line names who matched it. An unmatched one cannot.
  constraint bank_transactions_match_is_attributed check (
    (num_nonnulls(contribution_id, expense_id) = 0 and matched_at is null)
    or (num_nonnulls(contribution_id, expense_id) = 1 and matched_at is not null)
  ),
  constraint bank_transactions_ignored_or_matched check (
    ignored_reason is null or num_nonnulls(contribution_id, expense_id) = 0
  )
);

create unique index bank_transactions_external_key
  on public.bank_transactions (account_id, external_id);
create index bank_transactions_community_idx
  on public.bank_transactions (community_id, posted_on desc);
-- The index the unexplained list reads: open lines, newest first.
create index bank_transactions_open_idx
  on public.bank_transactions (community_id, posted_on desc)
  where contribution_id is null and expense_id is null and ignored_reason is null;
create index bank_transactions_reference_idx
  on public.bank_transactions (community_id, upper(btrim(reference)))
  where reference is not null;
-- One statement line can only be one contribution, and the other way round.
create unique index bank_transactions_contribution_key
  on public.bank_transactions (contribution_id) where contribution_id is not null;
create unique index bank_transactions_expense_key
  on public.bank_transactions (expense_id) where expense_id is not null;

alter table public.bank_transactions enable row level security;
alter table public.bank_accounts enable row level security;

-- ---------------------------------------------------------------------------
-- Who may see the bank
-- ---------------------------------------------------------------------------
-- Staff, and nobody else. A statement line carries the name of whoever sent
-- the money and, half the time, their bank — a resident browsing the raw feed
-- would learn more about their neighbours than the People page has ever been
-- willing to tell them. What residents are owed is the conclusion, not the
-- feed, and 0920.0500 gives them that.
create policy bank_accounts_select_staff
  on public.bank_accounts for select to authenticated
  using (app.is_staff(community_id));
create policy bank_accounts_write_committee
  on public.bank_accounts for all to authenticated
  using (app.is_committee(community_id))
  with check (app.is_committee(community_id));

create policy bank_transactions_select_staff
  on public.bank_transactions for select to authenticated
  using (app.is_staff(community_id));

-- No direct writes at all. Lines arrive through app.record_bank_lines() and
-- are matched through public.reconcile_bank_line(); both check the caller.
-- A statement you can edit by hand is not evidence of anything.
revoke insert, update, delete on public.bank_transactions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The door in
-- ---------------------------------------------------------------------------
/**
 * Records statement lines, ignoring any the account already has.
 *
 * Takes the lines as a json array rather than a row type so that the same
 * function serves an upload parsed in the browser, a CSV parsed on the server,
 * and a feed job posting whatever its provider sends. Each element:
 *
 *   {posted_on, amount, narration?, reference?, counterparty?, balance_after?,
 *    external_id?}
 *
 * external_id is optional because half of India's banks do not give the line
 * one. When it is missing, the digest below stands in: same date, same amount,
 * same narration, same reference means the same line, which is the best any
 * importer can do and is what makes re-importing an overlapping statement
 * safe. It is imperfect on purpose — two identical ₹500 cash deposits on one
 * day collapse into one, and a society that hits that should be giving its
 * lines real identifiers.
 *
 * Returns how many were new.
 */
create or replace function app.record_bank_lines(
  p_account_id uuid,
  p_lines      jsonb,
  p_source     public.bank_line_source default 'import'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_community uuid;
  v_actor uuid;
  v_added integer;
begin
  select community_id into v_community
    from public.bank_accounts where id = p_account_id;
  if v_community is null then
    raise exception 'That account does not exist' using errcode = 'no_data_found';
  end if;

  v_actor := app.my_membership_id(v_community);
  -- A feed job runs as the service role, which has no membership and no
  -- business being refused. A person must be staff.
  --
  -- "No auth.uid()" standing in for "service role" is safe because of the
  -- grants below: only `authenticated` and `service_role` may execute this, and
  -- PostgREST always sets a JWT for `authenticated`. `anon` has no grant and
  -- cannot reach the check at all.
  if v_actor is null and (select auth.uid()) is not null then
    raise exception 'Only staff can import a statement' using errcode = 'insufficient_privilege';
  end if;
  if v_actor is not null and not app.is_staff(v_community) then
    raise exception 'Only staff can import a statement' using errcode = 'insufficient_privilege';
  end if;

  with incoming as (
    select
      (line ->> 'posted_on')::date as posted_on,
      round((line ->> 'amount')::numeric, 2) as amount,
      nullif(btrim(line ->> 'narration'), '') as narration,
      nullif(btrim(line ->> 'reference'), '') as reference,
      nullif(btrim(line ->> 'counterparty'), '') as counterparty,
      nullif(line ->> 'balance_after', '')::numeric as balance_after,
      coalesce(
        nullif(btrim(line ->> 'external_id'), ''),
        encode(
          extensions.digest(
            concat_ws(
              '|',
              line ->> 'posted_on',
              round((line ->> 'amount')::numeric, 2)::text,
              upper(coalesce(btrim(line ->> 'narration'), '')),
              upper(coalesce(btrim(line ->> 'reference'), ''))
            ),
            'sha256'
          ),
          'hex'
        )
      ) as external_id
      from jsonb_array_elements(p_lines) as line
  ),
  inserted as (
    insert into public.bank_transactions (
      community_id, account_id, posted_on, amount, narration, reference,
      counterparty, balance_after, source, external_id, imported_by
    )
    select
      v_community, p_account_id, i.posted_on, i.amount, i.narration, i.reference,
      i.counterparty, i.balance_after, p_source, i.external_id, v_actor
      from incoming i
     where i.amount <> 0
    on conflict (account_id, external_id) do nothing
    returning 1
  )
  select count(*)::integer into v_added from inserted;

  return v_added;
end;
$$;

grant execute on function app.record_bank_lines(uuid, jsonb, public.bank_line_source)
  to authenticated, service_role;

/**
 * The same door, reachable from a client. PostgREST only publishes `public`,
 * so an upload parsed in the browser needs this; a feed job holding the service
 * role can call either.
 */
create or replace function public.import_bank_lines(p_account_id uuid, p_lines jsonb)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select app.record_bank_lines(p_account_id, p_lines, 'import');
$$;

grant execute on function public.import_bank_lines(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- What the app thinks happened, next to what the bank saw
-- ---------------------------------------------------------------------------
/**
 * Candidate pairings for one unmatched statement line, best first.
 *
 * Three signals, in the order a person would use them:
 *
 *   1. the UTR. A UPI reference is unique to one transfer, so a match on it is
 *      as close to certain as this gets. The resident typed it, which is why
 *      it is checked against the bank rather than trusted on its own.
 *   2. the amount, exactly, within a fortnight either side. A resident who
 *      mistyped one digit of a twelve-digit reference still paid ₹2,001.
 *   3. the amount, within the same window, off by up to a rupee — the rounding
 *      some banks apply, and the gap between ₹2,000 and ₹2,001 that people
 *      genuinely make.
 *
 * Only pending contributions are offered: one already confirmed has a line
 * against it or was cash, and offering it again would double the money.
 */
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
    select t.* from public.bank_transactions t
     where t.id = p_transaction_id
       and app.is_staff(t.community_id)
       and t.contribution_id is null
       and t.expense_id is null
  )
  select
    c.id,
    coalesce(p.full_name, 'A resident'),
    c.amount,
    c.paid_at,
    c.reference,
    case
      when c.reference is not null and l.reference is not null
       and upper(btrim(c.reference)) = upper(btrim(l.reference)) then 'reference'
      when c.amount = l.amount then 'amount'
      else 'close'
    end
    from line l
    join public.contributions c
      on c.community_id = l.community_id
     and c.status = 'pending'
    left join public.memberships m on m.id = c.membership_id
    left join public.profiles p on p.id = m.user_id
   where l.amount > 0
     and (
       (c.reference is not null and l.reference is not null
        and upper(btrim(c.reference)) = upper(btrim(l.reference)))
       or (abs(c.amount - l.amount) <= 1
           and c.paid_at between l.posted_on - interval '14 days'
                            and l.posted_on + interval '14 days')
     )
   order by
     case
       when c.reference is not null and l.reference is not null
        and upper(btrim(c.reference)) = upper(btrim(l.reference)) then 0
       when c.amount = l.amount then 1
       else 2
     end,
     abs(extract(epoch from c.paid_at - l.posted_on::timestamptz))
   limit 20;
$$;

grant execute on function public.bank_line_candidates(uuid) to authenticated;

/**
 * Pairs a statement line with a contribution and confirms the money.
 *
 * `p_take_bank_amount` is the question reconciliation exists to ask. The
 * resident's figure is what they say they paid and it is what the app has been
 * counting; the line is what the account actually received. When they differ,
 * somebody has to choose, and it should be a person:
 *
 *   false — keep the reported figure. The gap was a fee, a partial transfer
 *           the resident will top up, or a typo worth chasing them about.
 *   true  — take the bank's. The resident guessed, and the account is right.
 *
 * Either way the pair is recorded, so the next reader can see both numbers and
 * which one was chosen.
 */
create or replace function public.reconcile_bank_line(
  p_transaction_id   uuid,
  p_contribution_id  uuid,
  p_take_bank_amount boolean default false
)
returns public.contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.bank_transactions;
  v_row public.contributions;
  v_actor uuid;
begin
  select * into v_line from public.bank_transactions where id = p_transaction_id;
  if v_line.id is null then
    raise exception 'That statement line no longer exists' using errcode = 'no_data_found';
  end if;
  if not app.is_staff(v_line.community_id) then
    raise exception 'Only staff can reconcile' using errcode = 'insufficient_privilege';
  end if;
  if v_line.contribution_id is not null or v_line.expense_id is not null then
    raise exception 'That line is already matched' using errcode = 'unique_violation';
  end if;
  if v_line.amount <= 0 then
    raise exception 'Money going out cannot pay a contribution'
      using errcode = 'check_violation';
  end if;

  select * into v_row from public.contributions
   where id = p_contribution_id and community_id = v_line.community_id;
  if v_row.id is null then
    raise exception 'That payment no longer exists' using errcode = 'no_data_found';
  end if;
  if v_row.status = 'succeeded' then
    raise exception 'That payment is already confirmed' using errcode = 'unique_violation';
  end if;

  v_actor := app.my_membership_id(v_line.community_id);

  update public.contributions
     set status = 'succeeded',
         amount = case when p_take_bank_amount then v_line.amount else amount end,
         verified_by = v_actor,
         verified_at = now(),
         review_note = case
           when v_line.amount <> v_row.amount and not p_take_bank_amount
             then concat('Bank shows ', app.money(v_line.amount),
                         '; reported amount kept.')
           else review_note
         end
   where id = p_contribution_id
   returning * into v_row;

  update public.bank_transactions
     set contribution_id = p_contribution_id,
         matched_by = v_actor,
         matched_at = now()
   where id = p_transaction_id;

  return v_row;
end;
$$;

grant execute on function public.reconcile_bank_line(uuid, uuid, boolean) to authenticated;

/**
 * Undoes a match. The contribution goes back to pending, because a confirmation
 * that rested on the wrong line was not a confirmation.
 *
 * Committee only. Staff pair lines up all day; unpicking one is the sort of
 * thing that should need the person whose name is on the accounts.
 */
create or replace function public.unreconcile_bank_line(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.bank_transactions;
begin
  select * into v_line from public.bank_transactions where id = p_transaction_id;
  if v_line.id is null then
    raise exception 'That statement line no longer exists' using errcode = 'no_data_found';
  end if;
  if not app.is_committee(v_line.community_id) then
    raise exception 'Only the committee can undo a reconciliation'
      using errcode = 'insufficient_privilege';
  end if;

  if v_line.contribution_id is not null then
    update public.contributions
       set status = 'pending', verified_by = null, verified_at = null
     where id = v_line.contribution_id;
  end if;

  update public.bank_transactions
     set contribution_id = null, expense_id = null,
         matched_by = null, matched_at = null
   where id = p_transaction_id;
end;
$$;

grant execute on function public.unreconcile_bank_line(uuid) to authenticated;

/**
 * Marks a line as never going to match: a bank charge, interest, a transfer
 * between the society's own accounts. It stays in the table — the bank said it
 * happened — but stops asking to be explained.
 */
create or replace function public.ignore_bank_line(p_transaction_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.bank_transactions;
begin
  select * into v_line from public.bank_transactions where id = p_transaction_id;
  if v_line.id is null then
    raise exception 'That statement line no longer exists' using errcode = 'no_data_found';
  end if;
  if not app.is_staff(v_line.community_id) then
    raise exception 'Only staff can set a line aside' using errcode = 'insufficient_privilege';
  end if;
  if v_line.contribution_id is not null or v_line.expense_id is not null then
    raise exception 'That line is matched; undo the match first'
      using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Say why it is being set aside' using errcode = 'check_violation';
  end if;

  update public.bank_transactions
     set ignored_reason = btrim(p_reason)
   where id = p_transaction_id;
end;
$$;

grant execute on function public.ignore_bank_line(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Where the two versions disagree
-- ---------------------------------------------------------------------------
-- One row per society: what is still open on each side. This is the number the
-- committee actually wants — not "how many lines are there" but "how much
-- money is unaccounted for, in both directions".
create view public.reconciliation_summary
with (security_invoker = true) as
select
  c.id as community_id,
  count(*) filter (
    where t.id is not null and t.contribution_id is null and t.expense_id is null
      and t.ignored_reason is null
  ) as unexplained_lines,
  coalesce(sum(t.amount) filter (
    where t.contribution_id is null and t.expense_id is null
      and t.ignored_reason is null and t.amount > 0
  ), 0) as unexplained_in,
  coalesce(sum(-t.amount) filter (
    where t.contribution_id is null and t.expense_id is null
      and t.ignored_reason is null and t.amount < 0
  ), 0) as unexplained_out,
  max(t.posted_on) as last_line_on
  from public.communities c
  left join public.bank_transactions t on t.community_id = c.id
 group by c.id;

grant select on public.reconciliation_summary to authenticated, service_role;

comment on view public.reconciliation_summary is
  'Per society: statement lines nobody has explained yet, and what they add up '
  'to in each direction. Reads through the caller''s own policies, so a '
  'resident sees zeros.';

comment on table public.bank_transactions is
  'The bank''s own record, one row per statement line. Never written directly: '
  'lines arrive through app.record_bank_lines() and are paired with a '
  'contribution by public.reconcile_bank_line().';

-- The reconciliation decisions are exactly what an audit asks about, so they
-- go in the log 0920.0100 built.
create trigger bank_transactions_audit
  after insert or update or delete on public.bank_transactions
  for each row execute function app.write_audit();
