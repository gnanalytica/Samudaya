import { z } from 'zod';
import { formatMoney } from './format';
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

/** The three answers the committee can give at closure. `from_balance` is the way back out. */
export const SURPLUS_CHOICES = ['next_event', 'next_edition', 'society_balance'] as const;

export type SurplusChoice = (typeof SURPLUS_CHOICES)[number];

export const SURPLUS_CHOICE_LABEL: Record<SurplusChoice, string> = {
  next_event: 'Carry it to the next event',
  next_edition: 'Keep it for next year’s edition',
  society_balance: 'Keep it as society balance',
};

export const SURPLUS_CHOICE_DETAIL: Record<SurplusChoice, string> = {
  next_event:
    'It shows on that event’s bar as money already received, so residents are asked only for the difference.',
  next_edition:
    'The same, for next year’s run of this festival. We’ll create the event if it isn’t on the calendar yet.',
  society_balance:
    'It sits with the society, on everybody’s home screen, until the committee puts it behind an event.',
};

export const surplusChoiceSchema = z.enum(SURPLUS_CHOICES);

export const allocateSurplusSchema = z
  .object({
    event_id: uuid,
    kind: surplusChoiceSchema,
    /** The event to carry into. Absent for `society_balance`, and for a `next_edition` we create. */
    to_event_id: uuid.optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((value) => value.kind !== 'next_event' || Boolean(value.to_event_id), {
    message: 'Pick the event to carry it to',
    path: ['to_event_id'],
  });

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
 * One line of the log behind the society balance.
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
      return `${money} from the society balance, put behind ${to}`;
    case 'next_edition':
      return `${money} left over from ${from}, carried to ${to}`;
    case 'next_event':
    default:
      return `${money} left over from ${from}, now counting towards ${to}`;
  }
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
