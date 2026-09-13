-- ============================================================================
-- Samudaya · 20260913000500 · Catalogue, society setup and first-run welcome
-- ----------------------------------------------------------------------------
-- Catalogue: structured choices a society picks from instead of typing the
-- same thing twenty different ways ("Decoration", "decor", "Decorations").
-- Free text stays where it belongs (names, descriptions, notes); categories,
-- venues, activity types, event types and vendors come from here. Every new
-- society starts with a sensible Indian-residential default set, which staff
-- and the committee can edit.
--
-- Setup: communities gain the details the committee confirms during setup, and
-- a timestamp when the setup checklist is finished or dismissed.
--
-- Welcome: a member sees a role-specific welcome once, the first time they get
-- in after approval.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table public.catalogue_items (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  kind          text not null,
  label         text not null,
  emoji         text,
  -- Kind-specific extras, e.g. a vendor's phone and UPI ID or a venue's capacity.
  details       jsonb not null default '{}'::jsonb,
  position      integer not null default 0,
  is_active     boolean not null default true,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint catalogue_items_kind check (
    kind in ('budget_category', 'venue', 'activity_type', 'event_type', 'vendor')
  ),
  constraint catalogue_items_label_length check (length(btrim(label)) between 1 and 80)
);

create unique index catalogue_items_unique_label
  on public.catalogue_items (community_id, kind, lower(btrim(label)));
create index catalogue_items_lookup
  on public.catalogue_items (community_id, kind, is_active, position);

create trigger catalogue_items_touch_updated_at
  before update on public.catalogue_items
  for each row execute function app.touch_updated_at();

alter table public.catalogue_items enable row level security;

create policy catalogue_items_select_member
  on public.catalogue_items for select to authenticated
  using (app.is_member(community_id));

-- Staff run events and raise bills, so they keep the lists they use current.
create policy catalogue_items_write_staff
  on public.catalogue_items for all to authenticated
  using (app.is_staff(community_id))
  with check (app.is_staff(community_id));

create or replace function app.seed_default_catalogue(p_community uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.catalogue_items (community_id, kind, label, emoji, position)
  select p_community, v.kind, v.label, v.emoji, v.position
    from (values
      ('event_type', 'Festival', '🪔', 0),
      ('event_type', 'Cultural evening', '🎭', 1),
      ('event_type', 'Sports', '🏏', 2),
      ('event_type', 'Social gathering', '🎉', 3),
      ('event_type', 'Community service', '🤝', 4),
      ('event_type', 'Workshop', '🧑‍🏫', 5),

      ('budget_category', 'Decoration', '🎈', 0),
      ('budget_category', 'Food & catering', '🍛', 1),
      ('budget_category', 'Sound & lighting', '🔊', 2),
      ('budget_category', 'Pooja & rituals', '🙏', 3),
      ('budget_category', 'Idol & mandap', '🛕', 4),
      ('budget_category', 'Prizes & gifts', '🏆', 5),
      ('budget_category', 'Printing & publicity', '🖨️', 6),
      ('budget_category', 'Stage & seating', '🪑', 7),
      ('budget_category', 'Transport', '🚚', 8),
      ('budget_category', 'Cleaning & waste', '🧹', 9),
      ('budget_category', 'Security', '🛡️', 10),
      ('budget_category', 'Photography', '📷', 11),
      ('budget_category', 'Miscellaneous', '🧾', 12),

      ('venue', 'Clubhouse', '🏠', 0),
      ('venue', 'Party hall', '🎊', 1),
      ('venue', 'Amphitheatre', '🎭', 2),
      ('venue', 'Central lawn', '🌳', 3),
      ('venue', 'Swimming pool deck', '🏊', 4),
      ('venue', 'Terrace', '🌇', 5),
      ('venue', 'Sports court', '🏸', 6),

      ('activity_type', 'Dance', '💃', 0),
      ('activity_type', 'Singing', '🎤', 1),
      ('activity_type', 'Drama / skit', '🎭', 2),
      ('activity_type', 'Kids performance', '🧒', 3),
      ('activity_type', 'Rangoli', '🎨', 4),
      ('activity_type', 'Quiz', '🧠', 5),
      ('activity_type', 'Sports', '🏅', 6),
      ('activity_type', 'Cooking contest', '🍳', 7),
      ('activity_type', 'Workshop', '🧑‍🏫', 8)
    ) as v(kind, label, emoji, position)
  on conflict do nothing;
$$;

grant execute on function app.seed_default_catalogue(uuid) to service_role;

create or replace function app.seed_catalogue_for_new_community()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.seed_default_catalogue(new.id);
  return new;
end;
$$;

create trigger communities_seed_catalogue
  after insert on public.communities
  for each row execute function app.seed_catalogue_for_new_community();

-- Societies that already exist get the defaults too.
select app.seed_default_catalogue(c.id) from public.communities c;

-- Link bills and budget lines to the catalogue while keeping the label on the
-- row, so renaming a category later never rewrites a published ledger.
alter table public.expenses
  add column vendor_id uuid references public.catalogue_items (id) on delete set null,
  add column category_id uuid references public.catalogue_items (id) on delete set null;
alter table public.budget_lines
  add column category_id uuid references public.catalogue_items (id) on delete set null;
alter table public.events
  add column event_type_id uuid references public.catalogue_items (id) on delete set null,
  add column venue_id uuid references public.catalogue_items (id) on delete set null;
alter table public.event_activities
  add column activity_type_id uuid references public.catalogue_items (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Society setup
-- ---------------------------------------------------------------------------

alter table public.communities
  add column address text,
  add column pincode text,
  add column setup_completed_at timestamptz,
  -- Set when the committee confirms the default catalogue suits them.
  add column catalogue_reviewed_at timestamptz,
  add constraint communities_pincode_format check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  add constraint communities_address_length check (address is null or length(address) <= 300);

-- ---------------------------------------------------------------------------
-- First-run welcome
-- ---------------------------------------------------------------------------

alter table public.memberships
  add column welcomed_at timestamptz;

-- Memberships are only writable by staff and the committee, so a member marks
-- their own welcome as seen through this narrow function.
create or replace function public.mark_welcomed(p_community_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.memberships m
     set welcomed_at = coalesce(m.welcomed_at, now())
   where m.community_id = p_community_id
     and m.user_id = (select auth.uid())
     and m.status = 'active';
$$;

grant execute on function public.mark_welcomed(uuid) to authenticated, service_role;

-- Everyone already in has effectively been welcomed.
update public.memberships set welcomed_at = coalesce(joined_at, created_at) where welcomed_at is null;
