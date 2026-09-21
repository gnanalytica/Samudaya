import { cache } from 'react';
import { notFound } from 'next/navigation';
import { normalizeStats } from '@samudaya/core';
import { getSupabase } from './supabase/server';
import { rowsOf } from './rows';

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
  'id, slug, emoji, name, kind, starts_on, ends_on, venue, venue_id, event_type_id, organizer, description, status, expected_attendance, fund_target, suggested_amount, fund_rule, fund_rule_note, whatsapp_group_url, published_at, closed_at, closing_summary, created_by, created_at';

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
      'id, name, notes, status, due_on, position, completed_at, memberships!event_tasks_assignee_id_fkey(profiles(full_name))',
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
        'id, name, emoji, description, capacity, is_open, practice_dates, memberships!event_activities_coordinator_id_fkey(profiles(full_name))',
      )
      .eq('event_id', eventId)
      .order('position')
      .order('name'),
    supabase.from('activity_stats').select('activity_id, interested').eq('event_id', eventId),
  ]);

  const counts = new Map((stats.data ?? []).map((row) => [row.activity_id, row.interested ?? 0]));
  return rowsOf(activities, "an event's activities").map((activity) => ({
    ...activity,
    interested: counts.get(activity.id) ?? 0,
  }));
});

export const getVolunteerRoles = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const [roles, stats] = await Promise.all([
    supabase
      .from('volunteer_roles')
      .select(
        'id, name, emoji, description, target_count, memberships!volunteer_roles_coordinator_id_fkey(profiles(full_name))',
      )
      .eq('event_id', eventId)
      .order('position')
      .order('name'),
    supabase
      .from('volunteer_role_stats')
      .select('role_id, signed_up, still_needed')
      .eq('event_id', eventId),
  ]);

  const counts = new Map((stats.data ?? []).map((row) => [row.role_id, row]));
  return rowsOf(roles, "an event's volunteer roles").map((role) => ({
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
      'id, name, category, category_id, amount, vendor, vendor_id, paid_by, method, status, bill_url, spent_on, review_note, created_at, approved_at, updated_at, requested_by, revised_by, revised_at, requester:memberships!expenses_requested_by_fkey(profiles(full_name)), approver:memberships!expenses_approved_by_fkey(profiles(full_name)), editor:memberships!expenses_updated_by_fkey(profiles(full_name)), reviser:memberships!expenses_revised_by_fkey(profiles(full_name))',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  return data ?? [];
});

/**
 * How many people can approve a bill or confirm somebody else's payment.
 *
 * One is the case every separation-of-duties rule has to answer for: the
 * database lets the sole committee member sign off their own, so the screens
 * must not tell them somebody else will.
 */
export const getCommitteeCount = cache(async (communityId: string) => {
  const supabase = await getSupabase();
  const { count } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('role', 'committee')
    .eq('status', 'active');
  return count ?? 0;
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

/** Planned spend for an event, line by line. Their sum is the fund target. */
export const getBudgetLines = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('budget_lines')
    .select('id, category, category_id, amount, notes, position')
    .eq('event_id', eventId)
    .order('position')
    .order('created_at');
  return data ?? [];
});

/** Normalises a budget or expense category so "Decoration" and "decoration" line up. */
export function categoryKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase() || 'other';
}

/**
 * Planned against actually spent, per category. Only approved expenses count
 * as spent; categories that were spent without a budget line still appear.
 */
export function budgetVsSpent(
  lines: { category: string; amount: number | string }[],
  expenses: { category: string | null; amount: number | string; status: string }[],
) {
  const rows = new Map<string, { label: string; planned: number; spent: number }>();
  for (const line of lines) {
    const key = categoryKey(line.category);
    const row = rows.get(key) ?? { label: line.category.trim(), planned: 0, spent: 0 };
    row.planned += Number(line.amount);
    rows.set(key, row);
  }
  for (const expense of expenses) {
    if (expense.status !== 'approved') continue;
    const key = categoryKey(expense.category);
    const row = rows.get(key) ?? {
      label: expense.category?.trim() || 'Other',
      planned: 0,
      spent: 0,
    };
    row.spent += Number(expense.amount);
    rows.set(key, row);
  }
  return [...rows.values()];
}

/** Who has registered for each activity, and the signed-in member's own registrations. */
export const getRegistrations = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('activity_participants')
    .select(
      'id, activity_id, membership_id, participant_name, joined_at, event_activities!inner(event_id), memberships!activity_participants_membership_id_fkey(profiles(full_name))',
    )
    .eq('event_activities.event_id', eventId)
    .order('joined_at');
  return data ?? [];
});

const SUGGESTION_COLUMNS =
  'id, kind, name, description, status, review_note, resolved_at, created_at, suggested_by, memberships!activity_suggestions_suggested_by_fkey(profiles(full_name))';

/**
 * Attaches each suggestion's tally, the caller's own vote, and the ballots the
 * caller is allowed to see by name.
 *
 * Two queries, because they answer to different rules. The totals come from
 * suggestion_stats, a view that counts without handing over the rows it counts;
 * it is the only honest source for "14 against" when the reader may see none of
 * the fourteen. The second reads suggestion_votes, whose policy decides who is
 * named: your own ballot always, every vote in favour to any member, and votes
 * against to the committee. So `ballots` below is already filtered by the
 * database — this function sorts it, it does not censor it.
 */
async function withVotes<T extends { id: string }>(suggestions: T[], membershipId: string | null) {
  const ids = suggestions.map((row) => row.id);
  if (!ids.length) return [];

  const supabase = await getSupabase();
  const [{ data: tallies }, votes] = await Promise.all([
    supabase
      .from('suggestion_stats')
      .select('suggestion_id, votes_for, votes_against')
      .in('suggestion_id', ids),
    supabase
      .from('suggestion_votes')
      .select(
        'suggestion_id, membership_id, support, voted_at, memberships!suggestion_votes_membership_id_fkey(profiles(full_name))',
      )
      .in('suggestion_id', ids)
      .order('voted_at'),
  ]);

  const tallyFor = new Map((tallies ?? []).map((row) => [row.suggestion_id, row]));
  const ballots = rowsOf(votes, 'who voted on a suggestion');

  return suggestions.map((suggestion) => {
    const tally = tallyFor.get(suggestion.id);
    const cast = ballots.filter((vote) => vote.suggestion_id === suggestion.id);
    const ballot = cast.find((vote) => vote.membership_id === membershipId);
    return {
      ...suggestion,
      votesFor: tally?.votes_for ?? 0,
      votesAgainst: tally?.votes_against ?? 0,
      myVote: membershipId === null ? null : (ballot?.support ?? null),
      voters: cast.map((vote) => ({
        membershipId: vote.membership_id,
        name: vote.memberships?.profiles?.full_name ?? 'A resident',
        support: vote.support,
      })),
    };
  });
}

/** One suggestion with its tally — the shape both suggestion boards render. */
export type SuggestionRow = Awaited<ReturnType<typeof getSuggestions>>[number];

/** Suggestions for one event, with their vote tally. */
export const getSuggestions = cache(async (eventId: string, membershipId: string | null) => {
  const supabase = await getSupabase();
  const result = await supabase
    .from('activity_suggestions')
    .select(SUGGESTION_COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  return withVotes(rowsOf(result, 'suggestions for an event'), membershipId);
});

/**
 * The society's own suggestions — the ones not tied to any event. Same three
 * stages as an event's: a resident suggests, the committee opens it, everybody
 * votes. Kept separate by `event_id is null` rather than by a second table, so
 * one To do queue and one set of policies still cover both.
 */
export const getSocietySuggestions = cache(
  async (communityId: string, membershipId: string | null) => {
    const supabase = await getSupabase();
    const result = await supabase
      .from('activity_suggestions')
      .select(SUGGESTION_COLUMNS)
      .eq('community_id', communityId)
      .is('event_id', null)
      .order('created_at', { ascending: false });

    return withVotes(rowsOf(result, "the society's own suggestions"), membershipId);
  },
);

/**
 * Every payment for an event with the flat and payer. RLS returns all rows to
 * staff and committee, and only the caller's own to a resident.
 */
export const getPayments = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('contributions')
    .select(
      'id, amount, reported_amount, method, status, reference, receipt_no, channel, paid_at, proof_path, review_note, verified_at, updated_at, gateway_payload, membership_id, units(block, number), memberships!contributions_membership_id_fkey(profiles(full_name)), verifier:memberships!contributions_verified_by_fkey(profiles(full_name)), editor:memberships!contributions_updated_by_fkey(profiles(full_name))',
    )
    .eq('event_id', eventId)
    .order('paid_at', { ascending: false });
  return data ?? [];
});
