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
export const FUND_RULE_LABEL: Record<FundRule, string> = {
  carry_next_edition: 'Carry forward to the next edition of this event',
  carry_related: 'Carry forward to related activities',
  general_fund: 'Transfer to the Society General Event Fund',
  refund: 'Refund contributors proportionally',
  donate: 'Donate',
};

export const FUND_RULES: FundRule[] = [
  'carry_next_edition',
  'carry_related',
  'general_fund',
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
  };
}

/** Share of the fund target raised so far, clamped for a progress bar. */
export function fundedPercent(raised: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((raised / target) * 100));
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
