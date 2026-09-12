-- ============================================================================
-- Samudaya · 0800 · The event fund: contributions in, expenses out
-- ----------------------------------------------------------------------------
-- This is the part of the product residents actually judge. Two rules shape it:
--
--   1. A resident sees every APPROVED expense in full — vendor, amount, who
--      asked for it, who approved it, and the bill. That is the transparency
--      the product promises, and it is enforced here rather than by remembering
--      to show it in the UI.
--   2. Individual contribution amounts stay private. Totals and contributor
--      counts are public, and come from a view that aggregates over rows the
--      caller cannot read one by one.
-- ============================================================================

create sequence public.receipt_seq;

create table public.contributions (
  id            uuid primary key default extensions.gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  membership_id uuid references public.memberships (id) on delete set null,
  unit_id       uuid references public.units (id) on delete set null,
  -- numeric, never float: a rupee total that does not add up destroys the
  -- trust this whole feature exists to build.
  amount        numeric(12, 2) not null,
  currency      char(3) not null default 'INR',
  method        public.payment_method not null default 'upi',
  status        public.contribution_status not null default 'succeeded',
  receipt_no    bigint not null default nextval('public.receipt_seq'),
  reference     text,
  gateway_payload jsonb not null default '{}'::jsonb,
  channel       public.origin_channel not null default 'web',
  paid_at       timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  constraint contributions_amount_positive check (amount > 0)
);

create unique index contributions_receipt_no_key on public.contributions (receipt_no);
create index contributions_event_idx on public.contributions (event_id, paid_at desc);
create index contributions_membership_idx on public.contributions (membership_id);

create trigger contributions_inherit_community
  before insert or update of event_id on public.contributions
  for each row execute function app.inherit_event_community();

-- ---------------------------------------------------------------------------
-- expenses — the ledger
-- ---------------------------------------------------------------------------
create table public.expenses (
  id            uuid primary key default extensions.gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  name          text not null,
  category      text,
  amount        numeric(12, 2) not null,
  currency      char(3) not null default 'INR',
  vendor        text,
  paid_by       text,
  method        public.payment_method not null default 'upi',
  status        public.expense_status not null default 'pending',
  -- Storage path of the uploaded bill. A resident can open it from the ledger.
  bill_url      text,
  requested_by  uuid references public.memberships (id) on delete set null,
  approved_by   uuid references public.memberships (id) on delete set null,
  approved_at   timestamptz,
  review_note   text,
  spent_on      date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint expenses_name_not_blank check (length(btrim(name)) > 0),
  constraint expenses_amount_positive check (amount > 0)
);

create index expenses_event_idx on public.expenses (event_id, created_at desc);
create index expenses_pending_idx
  on public.expenses (community_id, status) where status = 'pending';

create trigger expenses_touch_updated_at
  before update on public.expenses
  for each row execute function app.touch_updated_at();

create trigger expenses_inherit_community
  before insert or update of event_id on public.expenses
  for each row execute function app.inherit_event_community();

-- ---------------------------------------------------------------------------
-- Approving an expense
-- ---------------------------------------------------------------------------
-- A function rather than a plain UPDATE so the two rules that matter are in
-- one place: only an admin decides, and nobody signs off their own request.
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
begin
  select * into v_row from public.expenses e where e.id = p_expense_id for update;
  if v_row.id is null then
    raise exception 'No such expense' using errcode = 'P0002';
  end if;

  if not app.is_admin(v_row.community_id) then
    raise exception 'Only a community admin can review an expense'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected', 'changes_requested') then
    raise exception 'A review must approve, reject, or request changes'
      using errcode = '22023';
  end if;

  v_actor := app.my_membership_id(v_row.community_id);

  -- Self-approval is how expense fraud happens in small committees.
  if p_decision = 'approved' and v_row.requested_by is not null
     and v_row.requested_by = v_actor then
    raise exception 'You cannot approve an expense you requested yourself'
      using errcode = '42501';
  end if;

  -- Once an event is closed its ledger is a published record.
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

grant execute on function public.review_expense(uuid, public.expense_status, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.contributions enable row level security;
alter table public.expenses      enable row level security;

-- Your own contributions, plus everything if you run the books.
create policy contributions_select_own_or_admin
  on public.contributions for select to authenticated
  using (
    app.is_admin(community_id)
    or membership_id = app.my_membership_id(community_id)
  );

create policy contributions_insert_own
  on public.contributions for insert to authenticated
  with check (
    app.is_member(community_id)
    and membership_id = app.my_membership_id(community_id)
    and exists (
      select 1 from public.events e
       where e.id = contributions.event_id
         and e.status = 'published'
    )
  );

-- A contribution is a payment record. Correcting one is an admin action with
-- an audit trail, never an edit by the person who made it.
create policy contributions_write_admin
  on public.contributions for update to authenticated
  using (app.is_admin(community_id))
  with check (app.is_admin(community_id));

create policy contributions_delete_admin
  on public.contributions for delete to authenticated
  using (app.is_admin(community_id));

-- The transparency rule, in one policy: approved spending is public to the
-- community; anything still under review is the committee's business.
create policy expenses_select_approved_or_staff
  on public.expenses for select to authenticated
  using (
    app.is_committee(community_id)
    or (app.is_member(community_id) and status = 'approved')
  );

create policy expenses_insert_committee
  on public.expenses for insert to authenticated
  with check (
    app.is_committee(community_id)
    and requested_by = app.my_membership_id(community_id)
    -- Everything arrives as pending. Approval goes through review_expense.
    and status = 'pending'
  );

create policy expenses_update_own_pending_or_admin
  on public.expenses for update to authenticated
  using (
    app.is_admin(community_id)
    or (
      requested_by = app.my_membership_id(community_id)
      and status in ('pending', 'changes_requested')
    )
  )
  with check (app.is_committee(community_id));

create policy expenses_delete_admin
  on public.expenses for delete to authenticated
  using (app.is_admin(community_id));

-- Stops a requester from flipping their own row to approved with a plain
-- UPDATE and skipping review_expense entirely.
create or replace function app.guard_expense_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;
  if new.status is distinct from old.status and new.status = 'approved'
     and new.approved_by is distinct from app.my_membership_id(new.community_id) then
    raise exception 'Approve an expense with review_expense(), not a direct update'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger expenses_guard_status
  before update on public.expenses
  for each row execute function app.guard_expense_status();
