import { cache } from 'react';
import { notFound } from 'next/navigation';
import { normalizeStats } from '@samudaya/core';
import { getSupabase } from './supabase/server';

/**
 * Event reads shared by several pages.
 *
 * Every query is scoped by RLS, so a resident asking for an event they have no
 * business seeing gets nothing back rather than an error — which is why the
 * loaders below treat "no row" as a 404.
 *
 * Wrapped in React's `cache()` so a page that asks for the same event in the
 * header and the body makes one round trip.
 */

// Written as single string literals: supabase-js infers the row type from the
// select text, and concatenating with `+` widens it to `string`, which
// collapses the result to an error type.
const EVENT_FIELDS =
  'id, slug, emoji, name, starts_on, ends_on, venue, organizer, description, status, expected_attendance, fund_target, fund_rule, fund_rule_note, published_at, closed_at, closing_summary, created_at';

export const getEvent = cache(async (communityId: string, slug: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .eq('community_id', communityId)
    .eq('slug', slug)
    .maybeSingle();
  return data;
});

export async function requireEvent(communityId: string, slug: string) {
  const event = await getEvent(communityId, slug);
  if (!event) notFound();
  return event;
}

/** The derived numbers every event screen shows, with nulls filled in. */
export const getEventStats = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('event_stats')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();
  return normalizeStats(data);
});

export const listEvents = cache(async (communityId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .eq('community_id', communityId)
    .order('starts_on', { ascending: false })
    .limit(100);
  return data ?? [];
});

/** Stats for a list of events in one round trip, keyed by event id. */
export const getStatsFor = cache(async (eventIds: string[]) => {
  if (eventIds.length === 0) return new Map<string, ReturnType<typeof normalizeStats>>();
  const supabase = await getSupabase();
  const { data } = await supabase.from('event_stats').select('*').in('event_id', eventIds);
  const map = new Map<string, ReturnType<typeof normalizeStats>>();
  for (const row of data ?? []) {
    if (row.event_id) map.set(row.event_id, normalizeStats(row));
  }
  return map;
});

export const getTasks = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('event_tasks')
    .select(
      'id, name, notes, status, due_on, position, completed_at, memberships(profiles(full_name))',
    )
    .eq('event_id', eventId)
    .order('position')
    .order('created_at');
  return data ?? [];
});

export const getActivities = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const [activities, stats] = await Promise.all([
    supabase
      .from('event_activities')
      .select(
        'id, name, emoji, description, capacity, is_open, practice_dates, memberships(profiles(full_name))',
      )
      .eq('event_id', eventId)
      .order('position')
      .order('name'),
    supabase.from('activity_stats').select('activity_id, interested').eq('event_id', eventId),
  ]);

  const counts = new Map((stats.data ?? []).map((row) => [row.activity_id, row.interested ?? 0]));
  return (activities.data ?? []).map((activity) => ({
    ...activity,
    interested: counts.get(activity.id) ?? 0,
  }));
});

export const getVolunteerRoles = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const [roles, stats] = await Promise.all([
    supabase
      .from('volunteer_roles')
      .select('id, name, emoji, description, target_count, memberships(profiles(full_name))')
      .eq('event_id', eventId)
      .order('position')
      .order('name'),
    supabase
      .from('volunteer_role_stats')
      .select('role_id, signed_up, still_needed')
      .eq('event_id', eventId),
  ]);

  const counts = new Map((stats.data ?? []).map((row) => [row.role_id, row]));
  return (roles.data ?? []).map((role) => ({
    ...role,
    signedUp: counts.get(role.id)?.signed_up ?? 0,
    stillNeeded: counts.get(role.id)?.still_needed ?? role.target_count,
  }));
});

/**
 * The ledger. RLS decides what comes back: a resident sees approved spending
 * only, the committee sees everything including what is still under review.
 */
export const getExpenses = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('expenses')
    .select(
      'id, name, category, amount, vendor, paid_by, method, status, bill_url, spent_on, review_note, created_at, requested_by, requester:memberships!expenses_requested_by_fkey(profiles(full_name)), approver:memberships!expenses_approved_by_fkey(title, profiles(full_name))',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  return data ?? [];
});

/** What the signed-in member has personally done for this event. */
export const getMyParticipation = cache(async (eventId: string, membershipId: string | null) => {
  if (!membershipId) return { activities: [], roles: [], contributed: 0 };
  const supabase = await getSupabase();

  const [activities, volunteers, contributions] = await Promise.all([
    supabase
      .from('activity_participants')
      .select('activity_id, event_activities!inner(event_id)')
      .eq('membership_id', membershipId)
      .eq('event_activities.event_id', eventId),
    supabase
      .from('event_volunteers')
      .select('role_id, volunteer_roles!inner(event_id)')
      .eq('membership_id', membershipId)
      .eq('volunteer_roles.event_id', eventId),
    supabase
      .from('contributions')
      .select('amount')
      .eq('membership_id', membershipId)
      .eq('event_id', eventId)
      .eq('status', 'succeeded'),
  ]);

  return {
    activities: (activities.data ?? []).map((row) => row.activity_id),
    roles: (volunteers.data ?? []).map((row) => row.role_id),
    contributed: (contributions.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0),
  };
});
