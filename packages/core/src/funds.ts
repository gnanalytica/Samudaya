import { z } from 'zod';
import { formatDate, formatMoney } from './format';
import { uuid } from './schemas';

/**
 * What happens to the money left in an event when it closes.
 *
 * An event budgets ₹50,000, collects ₹30,000 and spends ₹20,000. The ₹10,000
 * still in the pot is residents' money, and until now the app had nothing to
 * say about it: the closed event went on reporting a surplus forever and the
 * next event opened at zero and asked sixty flats for money the society was
 * already holding.
 */
export const FUND_MOVEMENT_KINDS = [
  'next_event',
  'next_edition',
  'society_balance',
  'from_balance',
] as const;

export type FundMovementKind = (typeof FUND_MOVEMENT_KINDS)[number];

/** The three movements a closure can write. `from_balance` is the way back out. */
export const SURPLUS_CHOICES = ['next_event', 'next_edition', 'society_balance'] as const;

export type SurplusChoice = (typeof SURPLUS_CHOICES)[number];

export const surplusChoiceSchema = z.enum(SURPLUS_CHOICES);

/**
 * The two answers the committee is actually asked for.
 *
 * There were three, and one of them — "keep it for next year's edition" — was
 * not a third answer at all. It is the second one with the event not created
 * yet, which is a detail of the calendar rather than a decision about money.
 * A committee closing Ganesh 2026 was being asked to tell two kinds of
 * carrying apart before it had decided to carry anything.
 *
 * So the question is: does the society keep it, or does it go behind another
 * event? Only then, and only for the second, which event — one already on the
 * calendar, or next year's, created there and then.
 *
 * Both movements stay in the database, because they read differently ever
 * after: "carried to Ganesh 2027" is a sentence about next year's festival,
 * and "carried to the Diwali fund" is a sentence about this month.
 */
export const SURPLUS_ANSWERS = ['society_balance', 'another_event'] as const;

export type SurplusAnswer = (typeof SURPLUS_ANSWERS)[number];

export const SURPLUS_ANSWER_LABEL: Record<SurplusAnswer, string> = {
  society_balance: 'Keep it for the society',
  another_event: 'Put it behind another event',
};

export const SURPLUS_ANSWER_DETAIL: Record<SurplusAnswer, string> = {
  society_balance:
    'Everyone sees it on the home screen until the committee puts it behind an event.',
  another_event: 'It counts towards that event’s target, so residents are asked only for the rest.',
};

export const surplusAnswerSchema = z.enum(SURPLUS_ANSWERS);

/**
 * What the form posts when the committee wants next year's edition, which does
 * not exist yet and therefore has no id to post.
 */
export const NEW_EDITION = 'new-edition';

export const surplusTargetSchema = z.union([uuid, z.literal(NEW_EDITION)]);

export const allocateSurplusSchema = z
  .object({
    event_id: uuid,
    answer: surplusAnswerSchema,
    /** An event's id, NEW_EDITION, or absent when the society keeps it. */
    to_event: surplusTargetSchema.optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((value) => value.answer !== 'another_event' || Boolean(value.to_event), {
    message: 'Choose which event it goes behind',
    path: ['to_event'],
  });

/**
 * Which movement the answer becomes.
 *
 * The mapping lives here rather than in either app so the two cannot disagree
 * about what a closure wrote — a ledger that says "carried to the next event"
 * on the web and "kept for next year" on a phone is worse than either.
 */
export function surplusKindFor(answer: SurplusAnswer, target?: string | null): SurplusChoice {
  if (answer === 'society_balance') return 'society_balance';
  return target === NEW_EDITION ? 'next_edition' : 'next_event';
}

export const spendBalanceSchema = z.object({
  to_event_id: uuid,
  amount: z.coerce
    .number()
    .positive('Enter an amount greater than zero')
    .max(10_000_000, 'That is larger than this app will accept'),
  note: z.string().trim().max(300).optional(),
});

export type FundMovementRow = {
  kind: FundMovementKind;
  amount: number | string;
  note?: string | null;
  decided_at?: string | null;
  from_event?: { name: string | null } | null;
  to_event?: { name: string | null } | null;
};

/**
 * One line of the ledger of where money moved.
 *
 * Not only into the society's balance: most of these are one event handing
 * what it did not spend to another, which never touches the balance at all.
 *
 * Written from the row rather than from the kind alone, because the sentence
 * people want is "₹10,000 left over from Ganesh 2026, now counting towards
 * Diwali 2026" — the two event names are the whole of the information, and a
 * label like "Carried forward" tells nobody anything they did not know from
 * looking at the amount.
 */
export function fundMovementLine(movement: FundMovementRow, currency = 'INR'): string {
  const money = formatMoney(Number(movement.amount ?? 0), currency);
  const from = movement.from_event?.name ?? 'a closed event';
  const to = movement.to_event?.name ?? 'an event';

  switch (movement.kind) {
    case 'society_balance':
      return `${money} left over from ${from}, kept by the society`;
    case 'from_balance':
      return `${money} the society had kept, put behind ${to}`;
    case 'next_edition':
      return `${money} left over from ${from}, carried to ${to}`;
    case 'next_event':
    default:
      return `${money} left over from ${from}, now counting towards ${to}`;
  }
}

/** A sum moved into an event, with the committee member who moved it. */
export type CarriedInRow = FundMovementRow & {
  decider?: { profiles?: { full_name: string | null } | null } | null;
};

/**
 * Where one sum carried into an event came from, who decided it and when.
 *
 * The fund card says how much was carried; this says whose decision it was.
 * Only the committee can move the society's money (spend_society_balance and
 * allocate_surplus record the member as decided_by), and residents asked for
 * less because of it should see who decided that on the event itself, not
 * only in the Money page's history of where money has moved.
 */
export function carriedFromLine(movement: CarriedInRow, currency = 'INR'): string {
  const money = formatMoney(Number(movement.amount ?? 0), currency);
  const source =
    movement.kind === 'from_balance'
      ? 'from what the society had kept'
      : `left over from ${movement.from_event?.name ?? 'a closed event'}`;
  const who = movement.decider?.profiles?.full_name;
  const when = movement.decided_at ? formatDate(movement.decided_at.slice(0, 10)) : null;
  return [`${money} ${source}`, who ? `decided by ${who}` : null, when].filter(Boolean).join(' · ');
}

/**
 * The key under a fund bar: what its solid part is and what its striped part
 * is. The striped half only when something is waiting to be confirmed.
 *
 * "To be confirmed" rather than "pending": in a UPI app pending means a
 * payment that has not gone through, which is the last thing somebody who has
 * paid should read.
 */
export function fundKey(
  confirmed: number,
  pending: number,
  currency = 'INR',
): { confirmed: string; pending: string | null } {
  return {
    confirmed: `${formatMoney(confirmed, currency)} confirmed`,
    pending: pending > 0 ? `${formatMoney(pending, currency)} to be confirmed` : null,
  };
}

/** One place the society's money is, as the Money page lists it. */
export type Holding = {
  eventId: string;
  /** Null when the viewer cannot see the event: a draft, which only staff can. */
  name: string | null;
  emoji: string | null;
  slug: string | null;
  status: string | null;
  /** What the event holds: confirmed money in, plus carried in, less approved bills. */
  amount: number;
  /** Carried across into (positive) or out of (negative) the event, net. */
  carried: number;
};

/** What a row of the breakdown is called when the viewer cannot see its event. */
export const UNPUBLISHED_EVENT = 'An event not published yet';

/**
 * Where the society's balance is: every event still holding money, largest
 * first. What the society kept outside any event (the society_balance view) is
 * the one other place, and the page lists it last.
 *
 * Together they add up to the Balance figure exactly, not approximately.
 * Every payment and every bill belongs to an event, so the balance is the sum
 * of what each event holds; and a carry only ever moves money between two of
 * those places — one event to another, or an event to the society's own pot
 * and back — so it changes where the money is and never the total. Without the
 * split, "Balance ₹7,820" beside "₹0 kept for the society" read as a
 * contradiction, and a carry of ₹6,990 left ₹830 nobody could find.
 *
 * `stats` is event_stats (every event, drafts included, for any member);
 * `events` is whatever of the events table the viewer may read, which for a
 * resident leaves drafts out.
 */
export function whereTheBalanceIs(
  stats: {
    event_id: string | null;
    available: number | string | null;
    fund_carried: number | string | null;
  }[],
  events: {
    id: string;
    name: string;
    emoji?: string | null;
    slug?: string | null;
    status?: string | null;
  }[],
): Holding[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  return stats
    .flatMap((row) => {
      const amount = Number(row.available ?? 0);
      if (!row.event_id || Math.abs(amount) < 0.005) return [];
      const event = byId.get(row.event_id);
      return [
        {
          eventId: row.event_id,
          name: event?.name ?? null,
          emoji: event?.emoji ?? null,
          slug: event?.slug ?? null,
          status: event?.status ?? null,
          amount,
          carried: Number(row.fund_carried ?? 0),
        },
      ];
    })
    .sort((a, b) => b.amount - a.amount);
}

/** The small print under a row of the breakdown, or null when there is none. */
export function holdingNote(holding: Holding, currency = 'INR'): string | null {
  if (holding.amount < 0) return 'Has spent more than it holds';
  if (holding.status === 'completed') {
    return 'Closed, and the committee has not yet decided where this goes';
  }
  if (holding.status === 'cancelled') return 'Cancelled, and still holding this';
  if (holding.carried > 0) {
    // Not "of it": the event may have spent some of what was carried in.
    return `${formatMoney(holding.carried, currency)} carried across by the committee`;
  }
  return null;
}

/** True when the movement adds to what the society is holding rather than spending it. */
export function addsToBalance(movement: Pick<FundMovementRow, 'kind'>): boolean {
  return movement.kind === 'society_balance';
}

/**
 * The name next year's edition of an event would have.
 *
 * `Ganesh Chaturthi 2026` → `Ganesh Chaturthi 2027`. A name with no year gets
 * one appended rather than being left ambiguous, because two events called
 * "Onam" a year apart is exactly the confusion this is meant to avoid.
 */
export function nextEditionName(name: string, startsOn: string | null | undefined): string {
  const fromDate = Number.parseInt((startsOn ?? '').slice(0, 4), 10);
  const year = Number.isFinite(fromDate) && fromDate > 1900 ? fromDate : new Date().getFullYear();
  const next = year + 1;
  const inName = name.match(/\b(19|20)\d{2}\b/);
  if (inName) return name.replace(inName[0], String(Number.parseInt(inName[0], 10) + 1));
  return `${name} ${next}`.trim();
}

/** The date next year's edition would start on, keeping the day and month. */
export function nextEditionDate(startsOn: string | null | undefined): string {
  const match = (startsOn ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const today = new Date();
    return `${today.getFullYear() + 1}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate(),
    ).padStart(2, '0')}`;
  }
  return `${Number.parseInt(match[1]!, 10) + 1}-${match[2]}-${match[3]}`;
}
