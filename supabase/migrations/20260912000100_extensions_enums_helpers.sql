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
-- People
-- ---------------------------------------------------------------------------

-- Ordered least → most privileged. `owner` is the account owner of a
-- community; `admin` publishes events and approves spending; `committee`
-- coordinates activities and works the checklist; `resident` takes part.
create type public.member_role as enum (
  'resident',
  'committee',
  'admin',
  'owner'
);

create type public.membership_status as enum ('pending', 'active', 'suspended');

create type public.occupant_relation as enum ('owner', 'tenant', 'family', 'other');

create type public.join_request_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

-- `draft` is admin-only. Publishing is what makes an event visible to
-- residents, and is also when its fund opens for contributions.
create type public.event_status as enum (
  'draft',
  'published',
  'completed',
  'cancelled'
);

create type public.task_status as enum ('todo', 'in_progress', 'done', 'blocked');

-- What happens to money left over once an event closes. Chosen when the event
-- is created — before anybody has contributed — so nobody is deciding the fate
-- of a surplus after seeing how big it is.
create type public.fund_rule as enum (
  'carry_next_edition',
  'carry_related',
  'general_fund',
  'refund',
  'donate'
);

create type public.contribution_status as enum ('pending', 'succeeded', 'failed', 'refunded');

create type public.payment_method as enum (
  'upi',
  'card',
  'netbanking',
  'bank_transfer',
  'cash',
  'cheque',
  'other'
);

-- An expense only reaches the resident-facing ledger once it is `approved`.
create type public.expense_status as enum (
  'pending',
  'approved',
  'rejected',
  'changes_requested'
);

-- ---------------------------------------------------------------------------
-- Community voice
-- ---------------------------------------------------------------------------

create type public.announcement_audience as enum (
  'all',
  'residents',
  'committee'
);

create type public.proposal_status as enum ('voting', 'approved', 'rejected', 'withdrawn');

create type public.suggestion_status as enum ('new', 'reviewing', 'accepted', 'declined');

-- Where an action came from. Lets the audit log and the WhatsApp bot share a
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
    when 'committee' then 20
    when 'admin'     then 30
    when 'owner'     then 40
  end;
$$;

grant execute on function app.role_rank(public.member_role) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Short, unambiguous code generation
-- ---------------------------------------------------------------------------
-- Shared by invite codes, society join codes and WhatsApp link codes. The
-- alphabet excludes 0/O, 1/I/L and U/V lookalikes so a code read off a notice
-- board or over the phone survives the trip.
create or replace function app.random_code(p_len integer default 8)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  n constant integer := 30;
  result text := '';
  bytes bytea;
  i integer;
begin
  bytes := extensions.gen_random_bytes(p_len);
  for i in 0 .. p_len - 1 loop
    -- 256 % 30 leaves a negligible modulo bias; brute force is bounded by the
    -- attempt throttle on redemption, not by per-character uniformity.
    result := result || substr(alphabet, (get_byte(bytes, i) % n) + 1, 1);
  end loop;
  return result;
end;
$$;
