-- ============================================================================
-- Samudaya · 0450 · Audit log
-- ----------------------------------------------------------------------------
-- Created early because governance writes to it: an approved fund reallocation
-- records itself here in the same transaction as the vote that carried it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- audit_logs — who did what, from which surface.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id             uuid primary key default extensions.gen_random_uuid(),
  community_id   uuid references public.communities (id) on delete cascade,
  actor_user_id  uuid references public.profiles (id) on delete set null,
  -- FK added in 0900, once api_keys exists.
  actor_api_key  uuid,
  action         text not null,
  entity_type    text,
  entity_id      uuid,
  channel        public.origin_channel not null default 'web',
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index audit_logs_community_idx on public.audit_logs (community_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

-- Residents see the outcome of a vote through the proposal itself; the raw
-- log is an admin tool.
create policy audit_logs_admin_read
  on public.audit_logs for select to authenticated
  using (community_id is not null and app.is_admin(community_id));
