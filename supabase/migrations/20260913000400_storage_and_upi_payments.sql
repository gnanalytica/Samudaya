-- ============================================================================
-- Samudaya · 20260913000400 · File storage and UPI payments
-- ----------------------------------------------------------------------------
-- Two private buckets:
--
--   bills           {community_id}/{event_id}/{file}
--                   Staff and committee upload and replace. Residents can read
--                   a bill only once its expense is approved, which is the same
--                   promise the expenses table makes.
--
--   payment-proofs  {community_id}/{membership_id}/{file}
--                   A resident's UPI screenshot. Only they and staff or the
--                   committee can read it.
--
-- Payments go straight from a resident's UPI app to the society's own UPI ID,
-- so there is no gateway, no KYC and nothing to be approved. A resident's
-- report ("I paid, here is the UPI reference") is saved as pending and only
-- counts once staff confirm it against the bank statement. Staff recording
-- cash or UPI they collected themselves can mark it confirmed directly.
-- ============================================================================

-- Folder names come from the client; cast them without raising on garbage.
create or replace function app.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function app.try_uuid(text) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('bills', 'bills', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('payment-proofs', 'payment-proofs', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- bills
-- ---------------------------------------------------------------------------

create policy bills_upload_staff
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bills'
    and app.is_staff(app.try_uuid((storage.foldername(name))[1]))
  );

create policy bills_read_staff_or_approved
  on storage.objects for select to authenticated
  using (
    bucket_id = 'bills'
    and (
      app.is_staff(app.try_uuid((storage.foldername(name))[1]))
      or (
        app.is_member(app.try_uuid((storage.foldername(name))[1]))
        and exists (
          select 1 from public.expenses e
           where e.bill_url = storage.objects.name
             and e.status = 'approved'
        )
      )
    )
  );

-- Re-uploading a correction replaces a file; an approved bill is a published
-- record and stays as it is.
create policy bills_replace_staff
  on storage.objects for update to authenticated
  using (
    bucket_id = 'bills'
    and app.is_staff(app.try_uuid((storage.foldername(name))[1]))
    and not exists (
      select 1 from public.expenses e
       where e.bill_url = storage.objects.name and e.status = 'approved'
    )
  )
  with check (
    bucket_id = 'bills'
    and app.is_staff(app.try_uuid((storage.foldername(name))[1]))
  );

create policy bills_delete_staff
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'bills'
    and app.is_staff(app.try_uuid((storage.foldername(name))[1]))
    and not exists (
      select 1 from public.expenses e
       where e.bill_url = storage.objects.name and e.status = 'approved'
    )
  );

-- ---------------------------------------------------------------------------
-- payment-proofs
-- ---------------------------------------------------------------------------

create policy payment_proofs_upload_own_or_staff
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (
      (
        app.can_participate(app.try_uuid((storage.foldername(name))[1]))
        and (storage.foldername(name))[2]
            = app.my_membership_id(app.try_uuid((storage.foldername(name))[1]))::text
      )
      or app.is_staff(app.try_uuid((storage.foldername(name))[1]))
    )
  );

create policy payment_proofs_read_own_or_staff
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[2]
        = app.my_membership_id(app.try_uuid((storage.foldername(name))[1]))::text
      or app.is_staff(app.try_uuid((storage.foldername(name))[1]))
    )
  );


-- ---------------------------------------------------------------------------
-- The society's UPI ID
-- ---------------------------------------------------------------------------

alter table public.communities
  add column upi_vpa text,
  add column upi_payee_name text,
  add constraint communities_upi_vpa_format
    check (upi_vpa is null or upi_vpa ~ '^[A-Za-z0-9._-]{2,255}@[A-Za-z][A-Za-z0-9.-]{1,64}$'),
  add constraint communities_upi_payee_length
    check (upi_payee_name is null or length(btrim(upi_payee_name)) between 1 and 80);

-- ---------------------------------------------------------------------------
-- Contributions: reported, then confirmed
-- ---------------------------------------------------------------------------

-- Anything that does not say otherwise is a report waiting for staff; staff
-- recording money they collected pass status 'succeeded' explicitly.
alter table public.contributions
  alter column status set default 'pending',
  add column proof_path text,
  add column verified_by uuid references public.memberships (id) on delete set null,
  add column verified_at timestamptz,
  add column review_note text;

-- A UPI reference (UTR) identifies one bank transfer. The same one cannot pay
-- twice in the same society.
create unique index contributions_upi_reference_unique
  on public.contributions (community_id, upper(btrim(reference)))
  where reference is not null and method = 'upi' and status <> 'failed';

-- A resident reports a payment; it waits for staff.
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
  );

-- Staff confirm or turn down a reported payment. Direct updates stay committee
-- only; this is the narrow path staff use.
create or replace function public.review_contribution(
  p_contribution_id uuid,
  p_confirm         boolean,
  p_note            text default null
)
returns public.contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contributions;
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
         verified_by = app.my_membership_id(v_row.community_id),
         verified_at = now(),
         review_note = p_note
   where id = p_contribution_id
   returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.review_contribution(uuid, boolean, text)
  to authenticated, service_role;

-- Declared last: it checks contributions.proof_path, added above.
create policy payment_proofs_delete_own_unconfirmed
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[2]
        = app.my_membership_id(app.try_uuid((storage.foldername(name))[1]))::text
    and not exists (
      select 1 from public.contributions c
       where c.proof_path = storage.objects.name and c.status = 'succeeded'
    )
  );
