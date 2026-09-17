-- ============================================================================
-- Samudaya · 0919.0100 · Somewhere to argue before the vote
-- ----------------------------------------------------------------------------
-- A suggestion could be voted on and never discussed, which makes it a poll
-- rather than a decision. The argument happened on WhatsApp, where it scrolled
-- away — so next Deepavali nobody can say why the society settled on green
-- crackers, only that it did.
--
-- Deliberately comments on a thing, not channels. A thread hangs off the event
-- or the suggestion it is about, so it is searchable, permanent, and sitting
-- next to the decision it produced. Channels would be a second WhatsApp, and
-- every society already has five of those.
-- ============================================================================

create table public.comments (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  -- Exactly one subject. A comment about nothing, or about two things at once,
  -- is a bug rather than a thread.
  event_id      uuid references public.events (id) on delete cascade,
  suggestion_id uuid references public.activity_suggestions (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  body          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint comments_one_subject check (num_nonnulls(event_id, suggestion_id) = 1),
  constraint comments_body_length check (length(btrim(body)) between 1 and 2000)
);

create index comments_event_idx on public.comments (event_id, created_at);
create index comments_suggestion_idx on public.comments (suggestion_id, created_at);

create trigger comments_touch_updated_at
  before update on public.comments
  for each row execute function app.touch_updated_at();

alter table public.comments enable row level security;

-- Everyone in the society reads the thread. That is the point of writing it
-- down instead of leaving it in a group chat.
create policy comments_select_member
  on public.comments for select to authenticated
  using (app.is_member(community_id));

-- Everyone in the society may post, staff included. Voting excludes staff
-- because they do not take part in the society's events; answering "when does
-- the decorator arrive?" is exactly their job.
create policy comments_insert_member
  on public.comments for insert to authenticated
  with check (
    app.is_member(community_id)
    and membership_id = app.my_membership_id(community_id)
  );

-- No editing: a thread people have replied to should not change underneath
-- them. Withdrawing what you said is different, and allowed.
create policy comments_delete_own
  on public.comments for delete to authenticated
  using (membership_id = app.my_membership_id(community_id));

-- Somebody has to be able to take down what should not have been said.
create policy comments_delete_staff
  on public.comments for delete to authenticated
  using (app.is_staff(community_id));

-- ---------------------------------------------------------------------------
-- Telling the people already in the conversation
-- ---------------------------------------------------------------------------
-- The thread, not the society: whoever raised the subject, and whoever has
-- already said something on it. A comment that notified 200 flats would be
-- the last comment anybody read.
create or replace function app.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject text;
  v_slug    text;
  v_users   uuid[];
begin
  select coalesce(e.name, s.name, 'the society'),
         coalesce(e.slug, '')
    into v_subject, v_slug
    from (select 1) one
    left join public.events e on e.id = new.event_id
    left join public.activity_suggestions s on s.id = new.suggestion_id;

  select array_agg(distinct u) into v_users from (
    -- Whoever raised it.
    select e.created_by as u from public.events e where e.id = new.event_id
    union
    select m.user_id from public.activity_suggestions s
      join public.memberships m on m.id = s.suggested_by
     where s.id = new.suggestion_id
    union
    -- And whoever is already in the thread.
    select m.user_id from public.comments c
      join public.memberships m on m.id = c.membership_id
     where c.id <> new.id
       and c.event_id is not distinct from new.event_id
       and c.suggestion_id is not distinct from new.suggestion_id
  ) people;

  if v_users is not null then
    perform app.notify(
      new.community_id,
      v_users,
      'comment',
      'New comment on ' || v_subject,
      left(new.body, 200),
      jsonb_build_object(
        'comment_id', new.id,
        'event_id', new.event_id,
        'event_slug', nullif(v_slug, ''),
        'suggestion_id', new.suggestion_id
      )
    );
  end if;
  return null;
end;
$$;

create trigger comments_notify
  after insert on public.comments
  for each row execute function app.notify_comment();
