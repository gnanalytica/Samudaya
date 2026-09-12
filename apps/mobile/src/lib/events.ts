import { normalizeStats } from '@samudaya/core';
import { supabase } from './supabase';

/**
 * Event reads for the mobile app. Mirrors apps/web/src/lib/events.ts —
 * both go through the same RLS, so what a resident can see is identical
 * whichever surface they use.
 */

// A single string literal: supabase-js infers the row type from the select
// text, and `+` concatenation widens it to `string`.
const EVENT_FIELDS =
  'id, slug, emoji, name, starts_on, venue, organizer, description, status, fund_target, fund_rule, fund_rule_note, closed_at';

export async function fetchEvents(communityId: string) {
  const { data } = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .eq('community_id', communityId)
    .order('starts_on', { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function fetchStats(eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, ReturnType<typeof normalizeStats>>();
  const { data } = await supabase.from('event_stats').select('*').in('event_id', eventIds);
  const map = new Map<string, ReturnType<typeof normalizeStats>>();
  for (const row of data ?? []) if (row.event_id) map.set(row.event_id, normalizeStats(row));
  return map;
}

export async function fetchEventBySlug(communityId: string, slug: string) {
  const { data } = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .eq('community_id', communityId)
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

export async function fetchEventDetail(communityId: string, slug: string, membershipId: string) {
  const event = await fetchEventBySlug(communityId, slug);
  if (!event) return null;

  const [stats, tasks, activities, activityStats, roles, roleStats, expenses, mine, myVolunteer] =
    await Promise.all([
      supabase.from('event_stats').select('*').eq('event_id', event.id).maybeSingle(),
      supabase
        .from('event_tasks')
        .select('id, name, status')
        .eq('event_id', event.id)
        .order('position'),
      supabase
        .from('event_activities')
        .select('id, name, emoji, description, is_open')
        .eq('event_id', event.id)
        .order('position'),
      supabase.from('activity_stats').select('activity_id, interested').eq('event_id', event.id),
      supabase
        .from('volunteer_roles')
        .select('id, name, emoji, target_count')
        .eq('event_id', event.id)
        .order('position'),
      supabase
        .from('volunteer_role_stats')
        .select('role_id, signed_up, still_needed')
        .eq('event_id', event.id),
      // RLS returns approved rows only to a resident, which is the ledger.
      supabase
        .from('expenses')
        .select('id, name, amount, vendor, bill_url, status')
        .eq('event_id', event.id)
        .eq('status', 'approved')
        .order('spent_on', { ascending: false }),
      supabase
        .from('activity_participants')
        .select('activity_id, event_activities!inner(event_id)')
        .eq('membership_id', membershipId)
        .eq('event_activities.event_id', event.id),
      supabase
        .from('event_volunteers')
        .select('role_id, volunteer_roles!inner(event_id)')
        .eq('membership_id', membershipId)
        .eq('volunteer_roles.event_id', event.id),
    ]);

  const interest = new Map(
    (activityStats.data ?? []).map((row) => [row.activity_id, row.interested ?? 0]),
  );
  const roleCounts = new Map((roleStats.data ?? []).map((row) => [row.role_id, row]));

  return {
    event,
    stats: normalizeStats(stats.data),
    tasks: tasks.data ?? [],
    activities: (activities.data ?? []).map((activity) => ({
      ...activity,
      interested: interest.get(activity.id) ?? 0,
    })),
    roles: (roles.data ?? []).map((role) => ({
      ...role,
      signedUp: roleCounts.get(role.id)?.signed_up ?? 0,
      stillNeeded: roleCounts.get(role.id)?.still_needed ?? role.target_count,
    })),
    expenses: expenses.data ?? [],
    joinedActivities: new Set((mine.data ?? []).map((row) => row.activity_id)),
    joinedRoles: new Set((myVolunteer.data ?? []).map((row) => row.role_id)),
  };
}

/** The soonest published event that has not happened yet. */
export function pickNextEvent<T extends { status: string; starts_on: string }>(events: T[]) {
  const today = new Date().toISOString().slice(0, 10);
  const published = events.filter((event) => event.status === 'published');
  return (
    published
      .filter((event) => event.starts_on >= today)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ?? published[0]
  );
}
