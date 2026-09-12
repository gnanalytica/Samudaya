-- ============================================================================
-- Samudaya · 0100 · Extensions, enums, and shared helpers
-- ----------------------------------------------------------------------------
-- Everything in the `app` schema is internal: it is deliberately NOT exposed
-- through PostgREST, so RLS helpers cannot be called directly by clients.
-- ============================================================================

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext" with schema extensions;

create schema if not exists app;

revoke all on schema app from public;
grant usage on schema app to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Ordered least → most privileged. `owner` is the billing/account owner of a
-- community; `admin` runs day-to-day operations; `committee` is an elected
-- resident with extra read access; `security` is gate staff; `resident` is a
-- regular member.
create type public.member_role as enum (
  'resident',
  'security',
  'committee',
  'admin',
  'owner'
);

create type public.membership_status as enum ('pending', 'active', 'suspended');

create type public.occupant_relation as enum ('owner', 'tenant', 'family', 'other');

create type public.announcement_audience as enum (
  'all',
  'residents',
  'owners',
  'committee',
  'staff'
);

create type public.request_category as enum (
  'plumbing',
  'electrical',
  'housekeeping',
  'security',
  'common_area',
  'parking',
  'billing',
  'other'
);

create type public.request_status as enum (
  'open',
  'acknowledged',
  'in_progress',
  'resolved',
  'closed',
  'rejected'
);

create type public.request_priority as enum ('low', 'normal', 'high', 'urgent');

create type public.visitor_kind as enum ('guest', 'delivery', 'cab', 'service', 'staff');

create type public.visitor_status as enum (
  'expected',
  'arrived',
  'departed',
  'denied',
  'expired',
  'cancelled'
);

create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'rejected');

create type public.invoice_status as enum (
  'draft',
  'issued',
  'partly_paid',
  'paid',
  'overdue',
  'void'
);

create type public.payment_method as enum (
  'upi',
  'card',
  'netbanking',
  'bank_transfer',
  'cash',
  'cheque',
  'other'
);

create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

-- Where an action came from. Lets the audit log and WhatsApp bot share a
-- vocabulary with the web and mobile clients.
create type public.origin_channel as enum ('web', 'mobile', 'whatsapp', 'api', 'system');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest
-- ---------------------------------------------------------------------------

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Role ranking
-- ---------------------------------------------------------------------------

create or replace function app.role_rank(p_role public.member_role)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'resident'  then 10
    when 'security'  then 20
    when 'committee' then 30
    when 'admin'     then 40
    when 'owner'     then 50
  end;
$$;

grant execute on function app.role_rank(public.member_role) to authenticated, anon, service_role;
