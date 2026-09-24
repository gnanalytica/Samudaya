import type { Enums } from '@samudaya/supabase';

/**
 * Event vocabulary and the arithmetic every surface repeats. Kept here so the
 * web app, the mobile app and the WhatsApp bot describe the same event with
 * the same words and the same numbers.
 */

export type EventStatus = Enums<'event_status'>;
export type TaskStatus = Enums<'task_status'>;
export type ExpenseStatus = Enums<'expense_status'>;
export type FundRule = Enums<'fund_rule'>;

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  proposed: 'Awaiting committee approval',
  draft: 'Draft',
  published: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To-do',
  in_progress: 'In progress',
  done: 'Completed',
  blocked: 'Blocked',
};

/** The dot the prototype shows next to each checklist row. */
export const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  todo: '🔴',
  in_progress: '🟡',
  done: '🟢',
  blocked: '⚫',
};

export const AUDIENCE_LABEL: Record<Enums<'announcement_audience'>, string> = {
  all: 'Everyone',
  residents: 'Residents',
  committee: 'Committee only',
};

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  pending: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes requested',
};

/**
 * What happens to money left over when an event closes. Chosen when the event
 * is created — before anybody has contributed — so nobody is deciding the fate
 * of a surplus after seeing how large it is.
 */
/** What happens to money left over, in the words a resident would use. */
export const FUND_RULE_LABEL: Record<FundRule, string> = {
  general_fund: 'Add it to the society’s event fund',
  carry_next_edition: 'Keep it for next year’s event',
  carry_related: 'Use it for related activities',
  refund: 'Give it back to the households who paid',
  donate: 'Donate it',
};

export const FUND_RULES: FundRule[] = [
  'general_fund',
  'carry_next_edition',
  'carry_related',
  'refund',
  'donate',
];

export type BudgetLineSeed = { name: string; amount: number };
export type ActivitySeed = { name: string; emoji: string };
export type VolunteerRoleSeed = { name: string; emoji: string; target: number };

/** The budget lines the creation wizard starts from. Editable, not fixed. */
export const DEFAULT_BUDGET_LINES: BudgetLineSeed[] = [
  { name: 'Decoration', amount: 30000 },
  { name: 'Food', amount: 40000 },
  { name: 'Sound', amount: 15000 },
  { name: 'Pooja materials', amount: 10000 },
  { name: 'Cultural program', amount: 20000 },
  { name: 'Miscellaneous', amount: 15000 },
];

/**
 * Requirements toggled in the wizard, and the checklist each one seeds. This
 * is what turns "we need food and sound" into an actionable list rather than
 * an empty page the committee has to fill in from memory.
 */
export const REQUIREMENT_TASKS: Record<string, { label: string; tasks: string[] }> = {
  religious: {
    label: 'Religious activities',
    tasks: ['Finalize idol / deity arrangements', 'Order pooja materials', 'Book the priest'],
  },
  decoration: {
    label: 'Decoration',
    tasks: ['Select decoration vendor', 'Confirm stage and mandap setup'],
  },
  food: { label: 'Food', tasks: ['Finalize food vendor', 'Confirm prasad arrangements'] },
  sound: { label: 'Sound & lighting', tasks: ['Book sound system', 'Arrange generator backup'] },
  cultural: {
    label: 'Cultural program',
    tasks: ['Finalize cultural program', 'Schedule the final rehearsal'],
  },
  volunteers: {
    label: 'Volunteers',
    tasks: ['Recruit volunteers', 'Share the volunteer roster'],
  },
  photography: { label: 'Photography', tasks: ['Book photographer'] },
  kids: { label: "Kids' activities", tasks: ['Plan the kids activity corner'] },
  logistics: {
    label: 'Logistics & safety',
    tasks: ['Share the parking plan', 'Arrange first-aid kit', 'Brief the cleanup crew'],
  },
};

export const REQUIREMENT_KEYS = Object.keys(REQUIREMENT_TASKS);

/** Builds the starting checklist from the requirements that were ticked. */
export function tasksForRequirements(requirements: Record<string, boolean>): string[] {
  const tasks: string[] = [];
  for (const key of REQUIREMENT_KEYS) {
    if (requirements[key]) tasks.push(...REQUIREMENT_TASKS[key]!.tasks);
  }
  return tasks;
}

/** The cultural activities offered by default when `cultural` is ticked. */
export const DEFAULT_ACTIVITIES: ActivitySeed[] = [
  { name: 'Dance', emoji: '💃' },
  { name: 'Singing', emoji: '🎤' },
  { name: 'Skit', emoji: '🎭' },
  { name: 'Kids performance', emoji: '🧒' },
  { name: 'Open mic', emoji: '🎙️' },
];

export const DEFAULT_VOLUNTEER_ROLES: VolunteerRoleSeed[] = [
  { name: 'Decoration', emoji: '🎈', target: 6 },
  { name: 'Food', emoji: '🍛', target: 5 },
  { name: 'Photography', emoji: '📷', target: 2 },
  { name: 'Cleanup', emoji: '🧹', target: 8 },
];

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

/**
 * The numbers `public.event_stats` returns. Every field is nullable because a
 * left join in the view can produce no row at all.
 */
export type EventStats = {
  fund_target: number | null;
  fund_raised: number | null;
  contributors: number | null;
  spent: number | null;
  available: number | null;
  tasks_total: number | null;
  tasks_done: number | null;
  readiness: number | null;
  participants: number | null;
  volunteers: number | null;
  pending_expenses: number | null;
  /** Reported and not yet confirmed. Never part of fund_raised. */
  fund_pending: number | null;
  pending_contributors: number | null;
  /** Moved across by the committee, net. Never part of fund_raised either. */
  fund_carried: number | null;
};

/** Fills in zeroes so callers never have to null-check a total. */
export function normalizeStats(stats: Partial<EventStats> | null | undefined) {
  return {
    fundTarget: Number(stats?.fund_target ?? 0),
    fundRaised: Number(stats?.fund_raised ?? 0),
    contributors: stats?.contributors ?? 0,
    spent: Number(stats?.spent ?? 0),
    available: Number(stats?.available ?? 0),
    tasksTotal: stats?.tasks_total ?? 0,
    tasksDone: stats?.tasks_done ?? 0,
    readiness: stats?.readiness ?? 0,
    participants: stats?.participants ?? 0,
    volunteers: stats?.volunteers ?? 0,
    pendingExpenses: stats?.pending_expenses ?? 0,
    fundPending: Number(stats?.fund_pending ?? 0),
    pendingContributors: stats?.pending_contributors ?? 0,
    fundCarried: Number(stats?.fund_carried ?? 0),
  };
}

/** Share of the fund target raised so far, clamped for a progress bar. */
export function fundedPercent(raised: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((raised / target) * 100));
}

/**
 * What an event asks its residents for: the target, less whatever the
 * committee has already carried across into it from a closed event.
 *
 * This, not the target, is the figure a fund card leads with. A card that read
 * "Target ₹2,00,000" over an event already holding ₹6,990 of it told sixty
 * flats they owed the whole ₹2,00,000, when the money was carried across
 * precisely so that they would not. The target is still the event's — the sum
 * it was planned against — and every card that leads with this figure says in
 * words how the two differ.
 *
 * Money carried out of an event (a negative net figure, on an event that gave
 * its surplus away) never raises what the event asked for.
 */
export function fundAsk(target: number, carriedIn = 0): number {
  return Math.max(0, target - Math.max(0, carriedIn));
}

/**
 * The two widths a fund bar draws — money confirmed and money on its way — as
 * shares of what residents are asked for (fundAsk), not of the target.
 *
 * Measured that way, the bar, the percentage beside it and the "₹X of ₹Y" line
 * all describe the same thing. They used to disagree: the bar drew money
 * carried across as a first segment of the target while the percentage beside
 * it counted contributions only, so an event holding ₹6,990 of ₹2,00,000
 * showed a sliver of colour over "0%".
 *
 * The two stack, so pending is whatever the bar has left after confirmed —
 * never its own share. Without that clamp an event at 90% confirmed with
 * another 30% reported would draw 120% of a bar that is 100% wide.
 *
 * When money carried across covers the whole target there is nothing left to
 * ask for, and the bar is full before anybody has paid.
 */
export function fundBarSegments(
  raised: number,
  pending: number,
  target: number,
  carriedIn = 0,
): { confirmed: number; pending: number } {
  const ask = fundAsk(target, carriedIn);
  if (target > 0 && ask === 0) return { confirmed: 100, pending: 0 };
  const confirmed = fundedPercent(raised, ask);
  return { confirmed, pending: Math.min(100 - confirmed, fundedPercent(pending, ask)) };
}

/**
 * What the event still has to ask residents for.
 *
 * Money carried across counts, which is the whole point of carrying it: a
 * society holding ₹10,000 from last year should not send sixty flats a request
 * for the full ₹50,000 and then sit on the difference.
 */
export function stillNeeded(target: number, raised: number, carriedIn = 0): number {
  return Math.max(0, fundAsk(target, carriedIn) - raised);
}

/**
 * Surplus once an event closes. Negative means the event overspent, which is
 * shown as a shortfall rather than hidden behind a zero.
 */
export function surplus(raised: number, spent: number): number {
  return raised - spent;
}

export function volunteersStillNeeded(target: number, signedUp: number): number {
  return Math.max(0, target - signedUp);
}
