-- ============================================================================
-- Samudaya · 0800 · Maintenance dues: invoices and payments
-- ============================================================================

create sequence public.invoice_number_seq;

create table public.invoices (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  unit_id       uuid not null references public.units (id) on delete cascade,
  number        bigint not null default nextval('public.invoice_number_seq'),
  title         text not null default 'Maintenance charges',
  period_start  date,
  period_end    date,
  issue_date    date not null default current_date,
  due_date      date not null default (current_date + 15),
  status        public.invoice_status not null default 'draft',
  currency      char(3) not null default 'INR',
  subtotal      numeric(12, 2) not null default 0,
  tax           numeric(12, 2) not null default 0,
  -- Money is stored as numeric, never float: 0.1 + 0.2 must be 0.3 here.
  total         numeric(12, 2) not null default 0,
  amount_paid   numeric(12, 2) not null default 0,
  balance_due   numeric(12, 2) generated always as (total - amount_paid) stored,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint invoices_amounts_non_negative
    check (subtotal >= 0 and tax >= 0 and total >= 0 and amount_paid >= 0),
  constraint invoices_period check (period_end is null or period_start is null or period_end >= period_start)
);

create unique index invoices_number_key on public.invoices (number);
create index invoices_community_status_idx on public.invoices (community_id, status, due_date);
create index invoices_unit_idx on public.invoices (unit_id, issue_date desc);

create trigger invoices_touch_updated_at
  before update on public.invoices
  for each row execute function app.touch_updated_at();

create table public.invoice_items (
  id          uuid primary key default extensions.gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity    numeric(10, 2) not null default 1,
  unit_price  numeric(12, 2) not null default 0,
  amount      numeric(12, 2) generated always as (quantity * unit_price) stored,
  created_at  timestamptz not null default now(),
  constraint invoice_items_quantity_positive check (quantity > 0)
);

create index invoice_items_invoice_idx on public.invoice_items (invoice_id);

create table public.payments (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  invoice_id    uuid references public.invoices (id) on delete set null,
  unit_id       uuid references public.units (id) on delete set null,
  paid_by       uuid references public.memberships (id) on delete set null,
  amount        numeric(12, 2) not null,
  currency      char(3) not null default 'INR',
  method        public.payment_method not null default 'upi',
  status        public.payment_status not null default 'succeeded',
  reference     text,
  -- Raw gateway response, kept for reconciliation and dispute handling.
  gateway_payload jsonb not null default '{}'::jsonb,
  paid_at       timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint payments_amount_positive check (amount > 0)
);

create index payments_community_idx on public.payments (community_id, paid_at desc);
create index payments_invoice_idx on public.payments (invoice_id) where invoice_id is not null;

create trigger payments_touch_updated_at
  before update on public.payments
  for each row execute function app.touch_updated_at();

-- Roll successful payments up onto the invoice so `balance_due` stays true
-- without the application having to remember to recalculate it.
create or replace function app.recalc_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
  v_paid numeric(12, 2);
  v_total numeric(12, 2);
begin
  if v_invoice is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(p.amount), 0) into v_paid
    from public.payments p
   where p.invoice_id = v_invoice
     and p.status = 'succeeded';

  select i.total into v_total from public.invoices i where i.id = v_invoice;

  update public.invoices
     set amount_paid = v_paid,
         status = case
           when status = 'void' then 'void'
           when v_paid >= v_total and v_total > 0 then 'paid'
           when v_paid > 0 then 'partly_paid'
           when due_date < current_date then 'overdue'
           when status = 'draft' then 'draft'
           else 'issued'
         -- The arms are unknown literals, which unify to text; without this
         -- cast the assignment to an enum column fails.
         end::public.invoice_status
   where id = v_invoice;

  return coalesce(new, old);
end;
$$;

create trigger payments_recalc_invoice
  after insert or update or delete on public.payments
  for each row execute function app.recalc_invoice_paid();

-- Keep the invoice header in step with its line items.
create or replace function app.recalc_invoice_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
  v_subtotal numeric(12, 2);
begin
  select coalesce(sum(ii.amount), 0) into v_subtotal
    from public.invoice_items ii
   where ii.invoice_id = v_invoice;

  update public.invoices
     set subtotal = v_subtotal,
         total = v_subtotal + tax
   where id = v_invoice;

  return coalesce(new, old);
end;
$$;

create trigger invoice_items_recalc_total
  after insert or update or delete on public.invoice_items
  for each row execute function app.recalc_invoice_total();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments      enable row level security;

-- A resident sees the bills for the flat they live in. Nothing else.
create policy invoices_select_own_unit_or_admin
  on public.invoices for select to authenticated
  using (
    app.is_admin(community_id)
    or (unit_id in (select app.my_unit_ids(community_id)) and status <> 'draft')
  );

create policy invoices_write_admin
  on public.invoices for all to authenticated
  using (app.is_admin(community_id))
  with check (app.is_admin(community_id));

create policy invoice_items_select
  on public.invoice_items for select to authenticated
  using (
    exists (
      select 1 from public.invoices i
       where i.id = invoice_items.invoice_id
         and (
           app.is_admin(i.community_id)
           or (i.unit_id in (select app.my_unit_ids(i.community_id)) and i.status <> 'draft')
         )
    )
  );

create policy invoice_items_write_admin
  on public.invoice_items for all to authenticated
  using (
    exists (
      select 1 from public.invoices i
       where i.id = invoice_items.invoice_id and app.is_admin(i.community_id)
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
       where i.id = invoice_items.invoice_id and app.is_admin(i.community_id)
    )
  );

create policy payments_select_own_or_admin
  on public.payments for select to authenticated
  using (
    app.is_admin(community_id)
    or paid_by = app.my_membership_id(community_id)
    or (unit_id is not null and unit_id in (select app.my_unit_ids(community_id)))
  );

-- Residents may record their own payment (e.g. a UPI reference); only admins
-- may edit one afterwards, so a resident cannot mark a bill paid twice.
create policy payments_insert_member
  on public.payments for insert to authenticated
  with check (
    app.is_admin(community_id)
    or (app.is_member(community_id) and paid_by = app.my_membership_id(community_id))
  );

create policy payments_write_admin
  on public.payments for update to authenticated
  using (app.is_admin(community_id))
  with check (app.is_admin(community_id));

create policy payments_delete_admin
  on public.payments for delete to authenticated
  using (app.is_admin(community_id));
