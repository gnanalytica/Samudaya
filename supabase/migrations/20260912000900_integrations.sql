-- ============================================================================
-- Samudaya · 0900 · API keys, WhatsApp, push, notifications, audit
-- ============================================================================

-- ---------------------------------------------------------------------------
-- api_keys — how AI agents and server-to-server integrations authenticate.
-- ---------------------------------------------------------------------------
-- The plaintext key is shown exactly once, at creation, and never stored. What
-- is stored is a SHA-256 hash plus a short prefix used to find the row.
--
-- The hash lives in a SEPARATE table rather than a column here, because a
-- column-level REVOKE is powerless against the table-level GRANT that
-- `authenticated` already holds on everything in `public`. Giving the secret
-- its own table with RLS and no policies at all makes it deny-by-default: no
-- client role can read a row, and only the service role (which bypasses RLS)
-- ever sees it.
create table public.api_keys (
  id           uuid primary key default extensions.gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  name         text not null,
  key_prefix   text not null unique,
  -- e.g. {announcements:read, requests:write}. Enforced in the API layer.
  scopes       text[] not null default '{}',
  -- Calls made with this key act as this member, so RLS-equivalent limits and
  -- the audit trail both stay meaningful.
  acts_as      uuid references public.memberships (id) on delete set null,
  created_by   uuid references public.profiles (id) on delete set null,
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint api_keys_name_not_blank check (length(btrim(name)) > 0)
);

create index api_keys_community_idx on public.api_keys (community_id, created_at desc);

create trigger api_keys_touch_updated_at
  before update on public.api_keys
  for each row execute function app.touch_updated_at();

-- Deferred from 0450: audit rows can name an API key as the actor, but
-- api_keys is only created here.
alter table public.audit_logs
  add constraint audit_logs_actor_api_key_fkey
  foreign key (actor_api_key) references public.api_keys (id) on delete set null;

create table public.api_key_secrets (
  api_key_id uuid primary key references public.api_keys (id) on delete cascade,
  key_hash   text not null
);

-- ---------------------------------------------------------------------------
-- Key verification
-- ---------------------------------------------------------------------------
-- The caller hashes the presented key and passes the digest; the stored hash
-- never travels. Comparison is constant-time so a timing signal cannot be used
-- to recover a valid digest byte by byte.
create or replace function app.constant_time_eq(a text, b text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_diff integer := 0;
  i integer;
begin
  if a is null or b is null then
    return false;
  end if;
  if length(a) <> length(b) then
    return false;
  end if;
  for i in 1 .. length(a) loop
    v_diff := v_diff | (ascii(substr(a, i, 1)) # ascii(substr(b, i, 1)));
  end loop;
  return v_diff = 0;
end;
$$;

create or replace function public.verify_api_key(p_prefix text, p_hash text)
returns table (
  api_key_id   uuid,
  community_id uuid,
  scopes       text[],
  acts_as      uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys;
  v_hash text;
begin
  select * into v_key from public.api_keys k where k.key_prefix = p_prefix;
  if v_key.id is null then
    return;
  end if;
  if v_key.revoked_at is not null
     or (v_key.expires_at is not null and v_key.expires_at <= now()) then
    return;
  end if;

  select s.key_hash into v_hash
    from public.api_key_secrets s where s.api_key_id = v_key.id;
  if v_hash is null then
    return;
  end if;

  -- `=` on text short-circuits on the first differing byte. Comparing digests
  -- of equal length via a fold keeps the work independent of where they differ.
  if not app.constant_time_eq(v_hash, p_hash) then
    return;
  end if;

  update public.api_keys set last_used_at = now() where id = v_key.id;

  return query select v_key.id, v_key.community_id, v_key.scopes, v_key.acts_as;
end;
$$;


-- Only the server may verify keys; residents have no business calling this.
revoke execute on function public.verify_api_key(text, text) from public, anon, authenticated;
grant execute on function public.verify_api_key(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- WhatsApp
-- ---------------------------------------------------------------------------

-- One phone number maps to one person. A resident proves ownership by sending
-- the short code they generated in the app.
create table public.whatsapp_links (
  id                   uuid primary key default extensions.gen_random_uuid(),
  phone                text not null unique,
  user_id              uuid not null references public.profiles (id) on delete cascade,
  -- Which community this number talks to by default, for people who belong to
  -- more than one.
  default_community_id uuid references public.communities (id) on delete set null,
  verified_at          timestamptz,
  opted_out_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint whatsapp_links_phone_e164 check (phone ~ '^\+[1-9][0-9]{7,14}$')
);

create index whatsapp_links_user_idx on public.whatsapp_links (user_id);

create trigger whatsapp_links_touch_updated_at
  before update on public.whatsapp_links
  for each row execute function app.touch_updated_at();

create table public.whatsapp_link_codes (
  id           uuid primary key default extensions.gen_random_uuid(),
  code         text not null unique,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  community_id uuid references public.communities (id) on delete cascade,
  expires_at   timestamptz not null default (now() + interval '15 minutes'),
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index whatsapp_link_codes_user_idx on public.whatsapp_link_codes (user_id, created_at desc);

-- Every inbound and outbound message. `wa_message_id` is unique so Meta's
-- at-least-once webhook retries cannot double-process a message.
create table public.whatsapp_messages (
  id            uuid primary key default extensions.gen_random_uuid(),
  wa_message_id text unique,
  direction     text not null check (direction in ('inbound', 'outbound')),
  phone         text not null,
  community_id  uuid references public.communities (id) on delete set null,
  user_id       uuid references public.profiles (id) on delete set null,
  body          text,
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'received',
  error         text,
  created_at    timestamptz not null default now()
);

create index whatsapp_messages_phone_idx on public.whatsapp_messages (phone, created_at desc);
create index whatsapp_messages_community_idx
  on public.whatsapp_messages (community_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Push notifications (Expo) and the in-app inbox
-- ---------------------------------------------------------------------------
create table public.device_push_tokens (
  id           uuid primary key default extensions.gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  token        text not null unique,
  platform     text not null check (platform in ('ios', 'android', 'web')),
  app_version  text,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index device_push_tokens_user_idx on public.device_push_tokens (user_id);

create table public.notifications (
  id           uuid primary key default extensions.gen_random_uuid(),
  community_id uuid references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         text not null,
  title        text not null,
  body         text,
  data         jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (user_id) where read_at is null;


-- ---------------------------------------------------------------------------
-- WhatsApp link code generation (called from the app by a signed-in resident)
-- ---------------------------------------------------------------------------
create or replace function public.create_whatsapp_link_code(p_community_id uuid default null)
returns public.whatsapp_link_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.whatsapp_link_codes;
  v_try integer := 0;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;

  if p_community_id is not null and not app.is_member(p_community_id) then
    raise exception 'You are not a member of that community' using errcode = '42501';
  end if;

  -- Retire any code still outstanding so only the newest one works.
  update public.whatsapp_link_codes
     set consumed_at = now()
   where user_id = v_uid and consumed_at is null and expires_at > now();

  loop
    v_try := v_try + 1;
    begin
      insert into public.whatsapp_link_codes (code, user_id, community_id)
      values (app.random_code(6), v_uid, p_community_id)
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      if v_try >= 8 then
        raise exception 'Could not allocate a link code';
      end if;
    end;
  end loop;
end;
$$;

grant execute on function public.create_whatsapp_link_code(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.api_keys            enable row level security;
alter table public.whatsapp_links       enable row level security;
alter table public.whatsapp_link_codes  enable row level security;
alter table public.whatsapp_messages    enable row level security;
alter table public.device_push_tokens   enable row level security;
alter table public.notifications        enable row level security;

-- Admins manage keys for their own community. The hash column is withheld at
-- the column level as well, so even an admin's SELECT * cannot return it.
create policy api_keys_admin_all
  on public.api_keys for all to authenticated
  using (app.is_admin(community_id))
  with check (app.is_admin(community_id));

-- No policy is declared for api_key_secrets on purpose. With RLS enabled and
-- zero policies the table denies every read and write from `anon` and
-- `authenticated`; only the service role gets through.
alter table public.api_key_secrets enable row level security;
revoke all on public.api_key_secrets from anon, authenticated;

create policy whatsapp_links_self
  on public.whatsapp_links for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy whatsapp_link_codes_self
  on public.whatsapp_link_codes for select to authenticated
  using (user_id = (select auth.uid()));

-- Inbound/outbound logs are operational data: admins only, and only for their
-- own community. The webhook itself writes with the service role.
create policy whatsapp_messages_admin_read
  on public.whatsapp_messages for select to authenticated
  using (
    user_id = (select auth.uid())
    or (community_id is not null and app.is_admin(community_id))
  );

create policy device_push_tokens_self
  on public.device_push_tokens for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_self
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update_self
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

