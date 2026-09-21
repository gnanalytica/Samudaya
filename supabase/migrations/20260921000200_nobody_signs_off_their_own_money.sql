-- ============================================================================
-- Samudaya · 0921.0200 · Nobody signs off their own money
-- ----------------------------------------------------------------------------
-- Three holes in the same rule, and one thing the rule was stopping.
--
-- The rule: the person who put money into the ledger is not the person who
-- says it is true. It was written once, for bills, and only half applies:
--
--   · review_expense() refuses to approve a bill you uploaded yourself. Good,
--     except in a society with one committee member, where it refuses the only
--     person who could ever approve it and the bill sits pending forever. A
--     founder running a small society hits this on their first bill.
--
--   · review_contribution() never had the rule at all. A committee member can
--     report their own ₹5,000 payment and confirm it in the next tap, and the
--     fund bar moves on nobody's word but theirs.
--
--   · A bill that has been approved can be edited. The committee update policy
--     is `app.is_admin()`, which committee outranks, so a correction to an
--     approved bill's amount or its attached copy changes what residents see
--     with nothing sent back for approval. The row keeps its old approved_by:
--     it says a person signed off a number they never saw.
--
-- The thing the rule was stopping: a resident reports ₹1,000 and ₹10 actually
-- arrived — a typo, or a screenshot from the wrong payment. Today the only
-- answer is to turn the whole payment down and ask them to report it again,
-- which is a bad trade for a digit. The committee should be able to write down
-- what the bank actually shows, with the resident's own figure kept beside it
-- and the resident told what changed.
--
-- The escape hatch, everywhere: a society with exactly one active committee
-- member. There is nobody else, and a rule that cannot be satisfied is not a
-- control — it is a dead end with a moral. The audit log records who did it
-- either way, which is the part that survives.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Who is on their own
-- ---------------------------------------------------------------------------

/**
 * True when the caller is an active committee member of this society and the
 * only one. Definer, like every other helper here, because it reads
 * memberships from inside policies and definer functions.
 *
 * Deliberately not `count(*) <= 1`: a caller who is not on the committee of a
 * society with no committee at all should not inherit the hatch. (The
 * memberships trigger keeps that from happening, but a rule that only holds
 * because another rule holds is one refactor from being wrong.)
 */
create or replace function app.sole_committee_member(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.memberships m
       where m.community_id = p_community
         and m.user_id = (select auth.uid())
         and m.status = 'active'
         and m.role = 'committee'
    )
    and (
      select count(*) from public.memberships m
       where m.community_id = p_community
         and m.status = 'active'
         and m.role = 'committee'
    ) = 1;
$$;

comment on function app.sole_committee_member(uuid) is
  'True when the caller is the only active committee member of a society. The '
  'escape hatch for every separation-of-duties rule: there is nobody else.';

-- ---------------------------------------------------------------------------
-- What the resident said, when it stops being what the books say
-- ---------------------------------------------------------------------------

-- Null on every row that was never corrected, which is almost all of them.
-- `amount` stays the one number every total reads, so event_stats, the fund
-- bar, the reconcile screen and a resident's own history all follow a
-- correction without knowing it happened.
alter table public.contributions
  add column if not exists reported_amount numeric(12, 2)
    constraint contributions_reported_amount_positive
    check (reported_amount is null or reported_amount > 0);

comment on column public.contributions.reported_amount is
  'What the payer originally said they paid, kept only when the committee '
  'corrected it against the bank statement. Null means amount is still the '
  'figure the payer typed.';

-- ---------------------------------------------------------------------------
-- Who wrote the version being approved
-- ---------------------------------------------------------------------------

alter table public.expenses
  add column if not exists revised_by uuid references public.memberships (id) on delete set null,
  add column if not exists revised_at timestamptz;

comment on column public.expenses.revised_by is
  'Who last changed this bill after it had been decided. The author of the '
  'version now awaiting approval, which is who may not approve it.';

/**
 * A bill whose substance changed is not an approved bill.
 *
 * Fires when the amount, the attached copy, or any of the details a committee
 * member reads before approving moves on a row that is no longer pending. The
 * row goes back to pending, loses its approval, and records who revised it.
 *
 * Forced here rather than asked of the client, because the client is not the
 * only way in: PostgREST takes an update straight from the app, and a
 * committee member outranks the update policy on every expense in their
 * society. The invariant has to hold whatever sent the request.
 *
 * Exempts the service role the way app.guard_expense_status() does, so seeds
 * and imports write history rather than have it rewritten under them.
 */
create or replace function app.guard_expense_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if old.status <> 'pending'
     and (new.amount   is distinct from old.amount
       or new.bill_url is distinct from old.bill_url
       or new.name     is distinct from old.name
       or new.vendor   is distinct from old.vendor
       or new.category is distinct from old.category
       or new.method   is distinct from old.method
       or new.paid_by  is distinct from old.paid_by
       or new.spent_on is distinct from old.spent_on) then

    if exists (
      select 1 from public.events e
       where e.id = new.event_id and e.status = 'completed'
    ) then
      raise exception 'This event is closed; its ledger cannot be changed'
        using errcode = '42501';
    end if;

    new.status      := 'pending';
    new.approved_by := null;
    new.approved_at := null;
    -- The old note was about the old version.
    new.review_note := null;
    new.revised_by  := app.my_membership_id(new.community_id);
    new.revised_at  := now();
  end if;

  return new;
end;
$$;

drop trigger if exists expenses_guard_revision on public.expenses;
create trigger expenses_guard_revision
  before update on public.expenses
  for each row execute function app.guard_expense_revision();

-- ---------------------------------------------------------------------------
-- Approving a bill
-- ---------------------------------------------------------------------------

create or replace function public.review_expense(
  p_expense_id uuid,
  p_decision   public.expense_status,
  p_note       text default null
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.expenses;
  v_actor uuid;
  v_author uuid;
begin
  select * into v_row from public.expenses e where e.id = p_expense_id for update;
  if v_row.id is null then
    raise exception 'No such expense' using errcode = 'P0002';
  end if;

  if not app.is_committee(v_row.community_id) then
    raise exception 'Only the committee can approve or reject a bill'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected', 'changes_requested') then
    raise exception 'A review must approve, reject, or request changes'
      using errcode = '22023';
  end if;

  v_actor := app.my_membership_id(v_row.community_id);

  -- Whoever wrote the version on the table. Once a bill has been revised that
  -- is the reviser, not the original uploader: the uploader reading somebody
  -- else's correction is a second pair of eyes, and holding them to the
  -- original authorship would leave a two-person committee unable to approve
  -- anything either of them had touched.
  v_author := coalesce(v_row.revised_by, v_row.requested_by);

  if p_decision = 'approved' and v_actor is not null and v_author = v_actor
     and not app.sole_committee_member(v_row.community_id) then
    raise exception 'You cannot approve a bill you uploaded or revised yourself'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.events e where e.id = v_row.event_id and e.status = 'completed') then
    raise exception 'This event is closed; its ledger cannot be changed'
      using errcode = '42501';
  end if;

  update public.expenses
     set status = p_decision,
         approved_by = case when p_decision = 'approved' then v_actor else null end,
         approved_at = case when p_decision = 'approved' then now() else null end,
         review_note = p_note
   where id = p_expense_id
   returning * into v_row;

  return v_row;
end;
$$;

-- `create or replace` keeps the existing ACL, so this is belt and braces
-- rather than the repair the recreated function below needs. It costs one
-- statement and closes the case where somebody later turns this into a drop.
revoke all on function public.review_expense(uuid, public.expense_status, text) from public;
revoke all on function public.review_expense(uuid, public.expense_status, text) from anon;
grant execute on function public.review_expense(uuid, public.expense_status, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Confirming a payment, and correcting what it was for
-- ---------------------------------------------------------------------------

-- A defaulted parameter makes a new signature rather than replacing the old
-- one, and two overloads differing by a trailing default is how a caller gets
-- "could not choose a best candidate function". Drop, then create.
drop function if exists public.review_contribution(uuid, boolean, text, text);

create or replace function public.review_contribution(
  p_contribution_id uuid,
  p_confirm         boolean,
  p_note            text default null,
  p_reference       text default null,
  p_amount          numeric default null
)
returns public.contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contributions;
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_actor uuid;
  v_amount numeric(12, 2);
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

  v_actor := app.my_membership_id(v_row.community_id);

  -- The hole this closes: reporting your own payment and confirming it in the
  -- next tap. A staff member's own payment is somebody else's to confirm too —
  -- the hatch is about there being nobody else, not about rank.
  if v_row.membership_id is not null and v_row.membership_id = v_actor
     and not app.sole_committee_member(v_row.community_id) then
    raise exception 'You cannot confirm your own payment; another committee member must'
      using errcode = '42501';
  end if;

  v_amount := v_row.amount;

  if p_confirm and p_amount is not null and p_amount <> v_row.amount then
    -- Staff confirm what the statement shows; rewriting what it shows is a
    -- ledger correction, which is the committee's to make. Staff who find a
    -- mismatch turn the payment down with a note, as before.
    if not app.is_committee(v_row.community_id) then
      raise exception 'Only the committee can correct the amount of a payment'
        using errcode = '42501';
    end if;
    if p_amount <= 0 then
      raise exception 'A corrected amount must be more than zero'
        using errcode = '22023';
    end if;
    v_amount := p_amount;
  end if;

  update public.contributions
     set status = case when p_confirm then 'succeeded' else 'failed' end::public.contribution_status,
         amount = v_amount,
         -- Kept the moment the payer's figure stops being the society's. A
         -- second correction keeps the payer's original, not the first
         -- correction: what a resident wants to see is what they typed.
         reported_amount = case
           when v_amount <> v_row.amount then coalesce(v_row.reported_amount, v_row.amount)
           else v_row.reported_amount
         end,
         -- The reference staff read off the screenshot, or off the statement.
         -- It overwrites what the resident typed rather than deferring to it:
         -- the person confirming is looking at the evidence and at the bank,
         -- and a mistyped digit that can never be corrected is worse than a
         -- correction the audit trail records. Leaving it out changes nothing,
         -- so confirming without one is still a one-tap act.
         reference = coalesce(v_ref, v_row.reference),
         verified_by = v_actor,
         verified_at = now(),
         review_note = p_note
   where id = p_contribution_id
   returning * into v_row;

  return v_row;
end;
$$;

-- Dropping the function threw its ACL away with it, and a newly created one
-- starts with EXECUTE granted to PUBLIC — plus `anon` on top, from Supabase's
-- own bootstrap. Re-creating a function is the one move that quietly undoes
-- 0920.0600 through 0920.0800, and the suite has caught it twice.
revoke all on function public.review_contribution(uuid, boolean, text, text, numeric) from public;
revoke all on function public.review_contribution(uuid, boolean, text, text, numeric) from anon;

grant execute on function public.review_contribution(uuid, boolean, text, text, numeric)
  to authenticated, service_role;

comment on function public.review_contribution(uuid, boolean, text, text, numeric) is
  'Staff confirm or turn down a reported payment, optionally recording the UPI '
  'reference read off the resident''s screenshot. The committee can also '
  'correct the amount to what the bank actually shows; the payer''s figure is '
  'kept in reported_amount. Confirming is what makes a payment count.';

-- ---------------------------------------------------------------------------
-- Telling the resident what changed
-- ---------------------------------------------------------------------------

/**
 * Unchanged except for one sentence: a confirmation that quietly moved the
 * number is worse than no confirmation at all, so it says both figures.
 */
create or replace function app.notify_contribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_payer uuid;
  v_corrected boolean := new.reported_amount is not null
                         and new.reported_amount is distinct from new.amount;
begin
  select * into v_event from public.events e where e.id = new.event_id;
  select m.user_id into v_payer from public.memberships m where m.id = new.membership_id;

  if tg_op = 'INSERT' and new.status = 'pending' and new.membership_id is not null then
    perform app.notify(
      new.community_id,
      array(select app.member_user_ids(new.community_id, array['staff', 'committee']::public.member_role[])),
      'payment_reported',
      'Payment to confirm: ' || app.money(new.amount),
      coalesce('Flat ' || app.flat_label(new.unit_id) || ' · ', '') || v_event.name,
      jsonb_build_object('screen', 'payments', 'event_slug', v_event.slug, 'contribution_id', new.id)
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('succeeded', 'failed') then
    perform app.notify(
      new.community_id,
      array[v_payer],
      case when new.status = 'succeeded' then 'payment_confirmed' else 'payment_declined' end,
      case
        when new.status <> 'succeeded' then 'Payment not confirmed: ' || app.money(new.amount)
        when v_corrected then 'Payment confirmed as ' || app.money(new.amount)
        else 'Payment confirmed: ' || app.money(new.amount)
      end,
      case
        when new.status <> 'succeeded'
          then coalesce(new.review_note, 'Staff could not match it with the bank statement.')
        when v_corrected
          then 'You reported ' || app.money(new.reported_amount) || '; the committee recorded '
               || app.money(new.amount) || ' against the bank statement. '
               || coalesce(new.review_note, 'Your records now show the corrected figure.')
        else 'Thank you for supporting ' || v_event.name || '.'
      end,
      jsonb_build_object('screen', 'event', 'event_slug', v_event.slug)
    );
  end if;
  return null;
end;
$$;

/**
 * Unchanged except for who is left out: the author of the version now waiting,
 * so the original uploader is told when somebody else revises their bill
 * rather than being the one person kept in the dark about it.
 */
create or replace function app.notify_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_requester uuid;
  v_author uuid;
begin
  select * into v_event from public.events e where e.id = new.event_id;
  select m.user_id into v_requester from public.memberships m where m.id = new.requested_by;
  select m.user_id into v_author
    from public.memberships m where m.id = coalesce(new.revised_by, new.requested_by);

  if new.status = 'pending'
     and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    perform app.notify(
      new.community_id,
      array(
        select u from app.member_user_ids(new.community_id, array['committee']::public.member_role[]) u
         where u is distinct from v_author
      ),
      'bill_pending',
      case when new.revised_by is null then 'Bill to approve: ' else 'Revised bill to approve: ' end
        || app.money(new.amount),
      new.name || coalesce(' · ' || new.vendor, '') || ' · ' || v_event.name,
      jsonb_build_object('screen', 'bills', 'event_slug', v_event.slug, 'expense_id', new.id)
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending'
        and new.status in ('approved', 'rejected', 'changes_requested') then
    perform app.notify(
      new.community_id,
      array[v_requester],
      'bill_' || new.status::text,
      case new.status
        when 'approved' then 'Bill approved: '
        when 'rejected' then 'Bill rejected: '
        else 'Bill sent back: ' end || new.name,
      coalesce(new.review_note, app.money(new.amount) || ' · ' || v_event.name),
      jsonb_build_object('screen', 'bills', 'event_slug', v_event.slug, 'expense_id', new.id)
    );
  end if;
  return null;
end;
$$;

-- `update of status` fires when status is named in the SET list, not when its
-- value moves — so an update that changes only the amount would be silently
-- turned back into a pending bill with nobody told to look at it, because the
-- BEFORE trigger above sets status in NEW rather than in the statement. The
-- body is guarded on the values, so watching every update costs a no-op.
drop trigger if exists expenses_notify on public.expenses;
create trigger expenses_notify
  after insert or update on public.expenses
  for each row execute function app.notify_expense();

-- contributions_notify keeps its column list: review_contribution() is the
-- only way a payment leaves pending, and it always names status.

-- ---------------------------------------------------------------------------
-- The queue has to agree with the rules
-- ---------------------------------------------------------------------------
-- todo_items() already hid a bill from the person who raised it, which was the
-- rule as it stood. Two things move underneath it:
--
--   · the sole committee member may now approve their own bill, and the queue
--     was the one place they would go looking for it. Hiding it there would
--     make the hatch unreachable from the screen built for exactly this.
--   · a bill can be revised, and it is the reviser who may not approve it.
--
-- Payments join it for the first time: a committee member's own reported
-- payment is no longer theirs to confirm, so offering it in their queue is
-- offering a button the database refuses.

create or replace function public.todo_items(p_community_id uuid)
returns table (
  kind        text,
  id          uuid,
  title       text,
  subtitle    text,
  amount      numeric,
  event_slug  text,
  event_name  text,
  created_at  timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select app.is_staff(p_community_id) as staff,
           app.is_committee(p_community_id) as committee,
           app.my_membership_id(p_community_id) as membership,
           app.sole_committee_member(p_community_id) as alone
  )
  select * from (
    -- Join requests
    select 'join_request'::text, r.id, r.claimed_name,
           coalesce('Flat ' || app.flat_label(r.unit_id), 'Works for the society'),
           null::numeric, null::text, null::text, r.created_at
      from public.join_requests r, me
     where me.staff and r.community_id = p_community_id and r.status = 'pending'

    union all
    -- UPI payments residents reported (not the confirmer's own)
    select 'payment_to_confirm', c.id,
           coalesce(p.full_name, 'Flat ' || app.flat_label(c.unit_id), 'A resident'),
           concat_ws(' · ', 'Flat ' || app.flat_label(c.unit_id), 'Ref ' || c.reference),
           c.amount, e.slug, e.name, c.created_at
      from public.contributions c
      join public.events e on e.id = c.event_id
      left join public.memberships m on m.id = c.membership_id
      left join public.profiles p on p.id = m.user_id
      cross join me
     where me.staff and c.community_id = p_community_id and c.status = 'pending'
       and (me.alone or c.membership_id is distinct from me.membership)

    union all
    -- Bills waiting for the committee (not the ones the approver wrote)
    select 'bill_to_approve', x.id, x.name,
           concat_ws(' · ', x.category, x.vendor),
           x.amount, e.slug, e.name, x.created_at
      from public.expenses x
      join public.events e on e.id = x.event_id
      cross join me
     where me.committee and x.community_id = p_community_id and x.status = 'pending'
       and (me.alone
            or coalesce(x.revised_by, x.requested_by) is distinct from me.membership)

    union all
    -- The caller's own bills that were sent back for changes
    select 'bill_sent_back', x.id, x.name,
           coalesce(x.review_note, 'Sent back for changes'),
           x.amount, e.slug, e.name, x.updated_at
      from public.expenses x
      join public.events e on e.id = x.event_id
      cross join me
     where me.staff and x.community_id = p_community_id and x.status = 'changes_requested'
       and x.requested_by = me.membership

    union all
    -- Campaigns residents proposed
    select 'campaign_to_review', e.id, e.name,
           'Target ' || app.money(e.fund_target),
           e.fund_target, e.slug, e.name, e.created_at
      from public.events e, me
     where me.committee and e.community_id = p_community_id and e.status = 'proposed'

    union all
    -- New suggestions
    select 'suggestion_to_review', s.id, s.name,
           initcap(s.kind) || coalesce(' · ' || e.name, ''),
           null::numeric, e.slug, e.name, s.created_at
      from public.activity_suggestions s
      left join public.events e on e.id = s.event_id
      cross join me
     where me.committee and s.community_id = p_community_id and s.status = 'new'
  ) items (kind, id, title, subtitle, amount, event_slug, event_name, created_at)
  order by created_at desc
  limit 200;
$$;

-- security invoker, so this is not the anon hazard the definer functions are;
-- it is re-stated anyway because a security pass reading only the grant should
-- not have to work out which kind of function this is.
revoke all on function public.todo_items(uuid) from public;
revoke all on function public.todo_items(uuid) from anon;
grant execute on function public.todo_items(uuid) to authenticated, service_role;

-- The badge counts what the queue lists, and drifting apart is how a "3" leads
-- to an empty screen. Same filters, same hatch.
create or replace function public.todo_count(p_community_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select app.is_staff(p_community_id) as staff,
           app.is_committee(p_community_id) as committee,
           app.my_membership_id(p_community_id) as membership,
           app.sole_committee_member(p_community_id) as alone
  )
  select case when not me.staff then 0 else (
      (select count(*) from public.join_requests r
        where r.community_id = p_community_id and r.status = 'pending')
    + (select count(*) from public.contributions c
        where c.community_id = p_community_id and c.status = 'pending'
          and (me.alone or c.membership_id is distinct from me.membership))
    + (select count(*) from public.expenses x
        where x.community_id = p_community_id and x.status = 'changes_requested'
          and x.requested_by = me.membership)
    + case when not me.committee then 0 else (
          (select count(*) from public.expenses x
            where x.community_id = p_community_id and x.status = 'pending'
              and (me.alone
                   or coalesce(x.revised_by, x.requested_by) is distinct from me.membership))
        + (select count(*) from public.events e
            where e.community_id = p_community_id and e.status = 'proposed')
        + (select count(*) from public.activity_suggestions s
            where s.community_id = p_community_id and s.status = 'new')
      ) end
  )::integer end
  from me;
$$;

revoke all on function public.todo_count(uuid) from public;
revoke all on function public.todo_count(uuid) from anon;
grant execute on function public.todo_count(uuid) to authenticated, service_role;
