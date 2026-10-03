-- ============================================================================
-- A reply can be a face
-- ============================================================================
-- Half of what people say in a society's group chat is a thumbs-up: "seen",
-- "agreed", "thank you". In the discussion under an event that meant typing
-- "+1" as a comment, which notified everybody in the thread and buried the
-- comments that said something.
--
-- So any member can react to any comment — their own included — with one of a
-- few faces, once each. A reaction notifies nobody. The set is fixed here
-- rather than open, so the thread stays a thread and not a sticker board, and
-- so a reaction can never be a way to post text that skips the comment rules.
-- ============================================================================

create table public.comment_reactions (
  comment_id    uuid not null references public.comments (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  emoji         text not null,
  created_at    timestamptz not null default now(),
  -- One of each face per person per comment: reacting again takes it back.
  primary key (comment_id, membership_id, emoji),
  -- The same set as COMMENT_REACTIONS in @samudaya/core.
  constraint comment_reactions_known_face
    check (emoji in ('👍', '❤️', '😂', '🎉', '🙏', '😮'))
);

create index comment_reactions_comment_idx on public.comment_reactions (comment_id);

comment on table public.comment_reactions is
  'A face a member put on a comment. Anyone in the society may react to any '
  'comment, once per face; reacting notifies nobody.';

alter table public.comment_reactions enable row level security;

-- Whoever can read the thread can see who reacted to it.
create policy comment_reactions_select_member
  on public.comment_reactions for select to authenticated
  using (app.is_member(community_id));

-- As yourself, on a comment in your own society — staff included, since they
-- are in the conversation too.
create policy comment_reactions_insert_own
  on public.comment_reactions for insert to authenticated
  with check (
    membership_id = app.my_membership_id(community_id)
    and exists (
      select 1 from public.comments c
       where c.id = comment_reactions.comment_id
         and c.community_id = comment_reactions.community_id
    )
  );

-- And only your own comes off again. There is no update: a different face is
-- a different reaction.
create policy comment_reactions_delete_own
  on public.comment_reactions for delete to authenticated
  using (membership_id = app.my_membership_id(community_id));

revoke all on public.comment_reactions from anon;
grant select, insert, delete on public.comment_reactions to authenticated;
grant all on public.comment_reactions to service_role;
