-- ============================================================================
-- Samudaya · 0919.0200 · The group everybody is already in
-- ----------------------------------------------------------------------------
-- Every society runs on WhatsApp, and every festival spawns another group for
-- it. Competing with that is a losing game: a second chat app in a society of
-- 200 flats is a dead tab by the second week.
--
-- So the app does not try. It holds the link. The committee pastes the
-- society's group here, an organiser pastes the one they made for Deepavali,
-- and anybody who joins the society later can find their way in without
-- somebody having to remember to forward them an invite.
--
-- Stored as the invite URL and nothing else — no numbers, no membership, no
-- messages. What happens in the group stays WhatsApp's business.
-- ============================================================================

alter table public.communities
  add column if not exists whatsapp_group_url text,
  -- An invite link and only an invite link: this is rendered as something
  -- people tap, so it must not be a place to park an arbitrary URL.
  add constraint communities_whatsapp_group_url_shape
    check (
      whatsapp_group_url is null
      or whatsapp_group_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{10,40}$'
    );

alter table public.events
  add column if not exists whatsapp_group_url text,
  add constraint events_whatsapp_group_url_shape
    check (
      whatsapp_group_url is null
      or whatsapp_group_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{10,40}$'
    );

comment on column public.communities.whatsapp_group_url is
  'Invite link to the society''s main WhatsApp group. Set by the committee.';
comment on column public.events.whatsapp_group_url is
  'Invite link to a WhatsApp group for this event. Set by whoever runs it.';
