-- ============================================================================
-- Samudaya · 0920.0100 · Who changed it, and when
-- ----------------------------------------------------------------------------
-- The app already records some of this and not the rest. created_by is on 25
-- tables, approved_by and verified_by on the money ones — but nothing records
-- who *edited* a row after it was made, and nothing keeps the previous value.
-- A committee that can say "the amount was changed from 5,000 to 500, by whom,
-- on the 14th" can settle an argument. One that cannot has only its word.
--
-- Two halves:
--
--   1. updated_by, stamped beside the updated_at that 20 tables already keep.
--      It answers "who last touched this" on the row itself, cheaply, for the
--      screens that show a record.
--
--   2. audit_log, append-only, holding the actual change. Inserts and deletes
--      keep the whole row; an update keeps only the fields that moved, each
--      with its before and after. Nobody can write to it from a client — only
--      the trigger, which is security definer — and nobody can edit it at all.
--
-- Only the tables where being wrong costs money or trust are audited. Auditing
-- everything would bury the rows that matter under noise from catalogue edits.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- contributions never had updated_at
-- ---------------------------------------------------------------------------
-- Every other table that changes has one. This is the table where a silent
-- edit would matter most, and it was the one that could not say it had changed.
alter table public.contributions
  add column if not exists updated_at timestamptz not null default now();

create trigger contributions_touch_updated_at
  before update on public.contributions
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- updated_by
-- ---------------------------------------------------------------------------
alter table public.contributions
  add column if not exists updated_by uuid references public.memberships (id) on delete set null;
alter table public.expenses
  add column if not exists updated_by uuid references public.memberships (id) on delete set null;
alter table public.activity_suggestions
  add column if not exists updated_by uuid references public.memberships (id) on delete set null;
alter table public.events
  add column if not exists updated_by uuid references public.memberships (id) on delete set null;
alter table public.memberships
  add column if not exists updated_by uuid references public.memberships (id) on delete set null;

/**
 * Stamps whoever is making the change, from their membership in the row's own
 * community. Null for anything the service role or a trigger does on its own —
 * which is the honest answer: nobody at a keyboard did it.
 */
create or replace function app.stamp_updated_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_by := app.my_membership_id(new.community_id);
  return new;
end;
$$;

create trigger contributions_stamp_updated_by
  before update on public.contributions
  for each row execute function app.stamp_updated_by();
create trigger expenses_stamp_updated_by
  before update on public.expenses
  for each row execute function app.stamp_updated_by();
create trigger activity_suggestions_stamp_updated_by
  before update on public.activity_suggestions
  for each row execute function app.stamp_updated_by();
create trigger events_stamp_updated_by
  before update on public.events
  for each row execute function app.stamp_updated_by();
create trigger memberships_stamp_updated_by
  before update on public.memberships
  for each row execute function app.stamp_updated_by();

-- ---------------------------------------------------------------------------
-- The log itself
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id            bigint generated always as identity primary key,
  -- Deliberately not a foreign key. Deleting a society cascades into its
  -- memberships and events, whose delete triggers then try to file a record
  -- against a community row that is already gone — the log would block the
  -- delete it is trying to describe. A record of what happened should also
  -- survive the thing it happened to; what is left is unreadable rather than
  -- leaked, because the read policy asks app.is_staff() of a society that no
  -- longer has any staff.
  community_id  uuid not null,
  table_name    text not null,
  row_id        uuid not null,
  action        text not null check (action in ('insert', 'update', 'delete')),
  -- Who did it. Null means no signed-in member did — a webhook, a seed, the
  -- service role. actor_user_id survives the membership being deleted.
  actor_id      uuid references public.memberships (id) on delete set null,
  actor_user_id uuid,
  -- An update keeps {field: {from, to}} for the fields that moved. An insert or
  -- a delete keeps the whole row, because that is the change.
  changed       jsonb not null default '{}'::jsonb,
  at            timestamptz not null default now()
);

create index audit_log_row_idx on public.audit_log (table_name, row_id, at desc);
create index audit_log_community_idx on public.audit_log (community_id, at desc);

/**
 * Writes the change. After the fact, so a failure here cannot roll back the
 * thing being recorded; security definer, so the log is writable when the
 * client's own policies would not let it write anything.
 *
 * updated_at and updated_by are skipped in the diff: they change on every
 * update by definition, and a log that says "updated_at changed" on every row
 * is a log nobody reads.
 */
create or replace function app.write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_community uuid;
  v_row_id uuid;
  v_changed jsonb := '{}'::jsonb;
  v_key text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_community := (v_old ->> 'community_id')::uuid;
    v_row_id := (v_old ->> 'id')::uuid;
    v_changed := v_old;
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_community := (v_new ->> 'community_id')::uuid;
    v_row_id := (v_new ->> 'id')::uuid;
    v_changed := v_new;
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_community := (v_new ->> 'community_id')::uuid;
    v_row_id := (v_new ->> 'id')::uuid;
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key not in ('updated_at', 'updated_by')
         and (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_changed := v_changed || jsonb_build_object(
          v_key, jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key)
        );
      end if;
    end loop;
    -- Nothing of substance moved; do not file a row saying so.
    if v_changed = '{}'::jsonb then
      return null;
    end if;
  end if;

  if v_community is null or v_row_id is null then
    return null;
  end if;

  insert into public.audit_log (
    community_id, table_name, row_id, action, actor_id, actor_user_id, changed
  ) values (
    v_community,
    tg_table_name,
    v_row_id,
    lower(tg_op),
    app.my_membership_id(v_community),
    (select auth.uid()),
    v_changed
  );
  return null;
end;
$$;

create trigger contributions_audit
  after insert or update or delete on public.contributions
  for each row execute function app.write_audit();
create trigger expenses_audit
  after insert or update or delete on public.expenses
  for each row execute function app.write_audit();
create trigger activity_suggestions_audit
  after insert or update or delete on public.activity_suggestions
  for each row execute function app.write_audit();
create trigger events_audit
  after insert or update or delete on public.events
  for each row execute function app.write_audit();
create trigger memberships_audit
  after insert or update or delete on public.memberships
  for each row execute function app.write_audit();

-- ---------------------------------------------------------------------------
-- Who may read it
-- ---------------------------------------------------------------------------
-- Staff and the committee, because the log holds every field of every change —
-- including a neighbour's contribution amount, which society_people() spends
-- its life keeping from residents. What a resident is owed is on the record
-- itself: who approved this bill, and when. That is already there and public.
--
-- Nobody writes it but the trigger, and nobody edits or deletes it at all: an
-- audit log a committee member can quietly correct is not an audit log.
alter table public.audit_log enable row level security;

create policy audit_log_select_staff
  on public.audit_log for select to authenticated
  using (app.is_staff(community_id));

revoke insert, update, delete on public.audit_log from anon, authenticated;

comment on table public.audit_log is
  'Append-only record of changes to money and decision tables. Written only by '
  'app.write_audit(); no client may insert, edit or delete a row.';
