import { describe, expect, it } from 'vitest';
import {
  NEW_EDITION,
  SURPLUS_ANSWERS,
  SURPLUS_CHOICES,
  surplusKindFor,
  addsToBalance,
  allocateSurplusSchema,
  fundMovementLine,
  nextEditionDate,
  nextEditionName,
  spendBalanceSchema,
} from '../src/funds';

const EVENT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('the log behind the society balance', () => {
  it('names both events, because that is the whole of the information', () => {
    expect(
      fundMovementLine({
        kind: 'next_event',
        amount: 10_000,
        from_event: { name: 'Ganesh Chaturthi 2026' },
        to_event: { name: 'Diwali 2026' },
      }),
    ).toBe('₹10,000 left over from Ganesh Chaturthi 2026, now counting towards Diwali 2026');
  });

  it('says who is holding it when nobody carried it anywhere', () => {
    expect(
      fundMovementLine({
        kind: 'society_balance',
        amount: 2_500,
        from_event: { name: 'Holi 2026' },
      }),
    ).toBe('₹2,500 left over from Holi 2026, kept by the society');
  });

  it('reads the other way round when the balance is spent', () => {
    expect(
      fundMovementLine({
        kind: 'from_balance',
        amount: 500,
        to_event: { name: 'Pongal 2027' },
      }),
    ).toBe('₹500 from the society balance, put behind Pongal 2027');
  });

  it('still reads as a sentence when an event has been deleted under it', () => {
    expect(fundMovementLine({ kind: 'next_edition', amount: 1_000 })).toBe(
      '₹1,000 left over from a closed event, carried to an event',
    );
  });

  it('reads the numeric strings PostgREST returns', () => {
    expect(
      fundMovementLine({
        kind: 'society_balance',
        amount: '2500.00',
        from_event: { name: 'Holi 2026' },
      }),
    ).toContain('₹2,500');
  });

  it('knows which movements add to what the society is holding', () => {
    expect(addsToBalance({ kind: 'society_balance' })).toBe(true);
    expect(addsToBalance({ kind: 'from_balance' })).toBe(false);
    expect(addsToBalance({ kind: 'next_event' })).toBe(false);
  });
});

describe('next year’s edition', () => {
  it('moves the year in the name when there is one', () => {
    expect(nextEditionName('Ganesh Chaturthi 2026', '2026-09-14')).toBe('Ganesh Chaturthi 2027');
  });

  it('appends one when there is not, because two Onams a year apart is the confusion', () => {
    expect(nextEditionName('Onam', '2026-09-05')).toBe('Onam 2027');
  });

  it('keeps the day and month, so the draft lands in roughly the right week', () => {
    expect(nextEditionDate('2026-09-14')).toBe('2027-09-14');
  });

  it('falls back to next year rather than an invalid date', () => {
    expect(nextEditionDate(null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(nextEditionName('Onam', null)).toMatch(/^Onam \d{4}$/);
  });
});

describe('what the committee is asked at closure', () => {
  it('asks two questions, not three', () => {
    // "Keep it for next year's edition" was never a third answer. It is the
    // second one with the event not created yet, which is a fact about the
    // calendar rather than a decision about money.
    expect([...SURPLUS_ANSWERS]).toEqual(['society_balance', 'another_event']);
  });

  it('still writes all three movements, because they read differently', () => {
    expect([...SURPLUS_CHOICES]).toEqual(['next_event', 'next_edition', 'society_balance']);
    expect(surplusKindFor('society_balance')).toBe('society_balance');
    expect(surplusKindFor('another_event', OTHER)).toBe('next_event');
    expect(surplusKindFor('another_event', NEW_EDITION)).toBe('next_edition');
  });

  it('insists on knowing which event, once they have said another event', () => {
    const problem = allocateSurplusSchema.safeParse({ event_id: EVENT, answer: 'another_event' });
    expect(problem.success).toBe(false);
    expect(problem.success === false && problem.error.issues[0]?.path).toEqual(['to_event']);
  });

  it('takes next year’s edition as an answer, though it has no id yet', () => {
    expect(
      allocateSurplusSchema.safeParse({
        event_id: EVENT,
        answer: 'another_event',
        to_event: NEW_EDITION,
      }).success,
    ).toBe(true);
  });

  it('does not ask which event at all when the society is keeping it', () => {
    expect(
      allocateSurplusSchema.safeParse({ event_id: EVENT, answer: 'society_balance' }).success,
    ).toBe(true);
  });

  it('refuses a target that is neither an event nor next year’s edition', () => {
    expect(
      allocateSurplusSchema.safeParse({
        event_id: EVENT,
        answer: 'another_event',
        to_event: 'the clubhouse fund',
      }).success,
    ).toBe(false);
  });

  it('never takes an amount: the figure is what the ledger says', () => {
    const parsed = allocateSurplusSchema.safeParse({
      event_id: EVENT,
      answer: 'another_event',
      to_event: OTHER,
      amount: 999,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && 'amount' in parsed.data).toBe(false);
  });
});

describe('spending the balance', () => {
  it('takes an amount, because a pot is not a closing figure', () => {
    const parsed = spendBalanceSchema.safeParse({ to_event_id: EVENT, amount: '500' });
    expect(parsed.success && parsed.data.amount).toBe(500);
  });

  it('refuses zero and below', () => {
    expect(spendBalanceSchema.safeParse({ to_event_id: EVENT, amount: 0 }).success).toBe(false);
    expect(spendBalanceSchema.safeParse({ to_event_id: EVENT, amount: -5 }).success).toBe(false);
  });
});
