import { describe, expect, it } from 'vitest';
import {
  SURPLUS_CHOICES,
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

describe('what the committee may choose', () => {
  it('offers three answers at closure; the fourth kind is the way back out', () => {
    expect([...SURPLUS_CHOICES]).toEqual(['next_event', 'next_edition', 'society_balance']);
  });

  it('insists on a target for “carry it to the next event”', () => {
    const problem = allocateSurplusSchema.safeParse({ event_id: EVENT, kind: 'next_event' });
    expect(problem.success).toBe(false);
  });

  it('does not, for next year’s edition, because that event may not exist yet', () => {
    expect(allocateSurplusSchema.safeParse({ event_id: EVENT, kind: 'next_edition' }).success).toBe(
      true,
    );
  });

  it('does not ask for one at all when the society is keeping it', () => {
    expect(
      allocateSurplusSchema.safeParse({ event_id: EVENT, kind: 'society_balance' }).success,
    ).toBe(true);
  });

  it('never takes an amount: the figure is what the ledger says', () => {
    const parsed = allocateSurplusSchema.safeParse({
      event_id: EVENT,
      kind: 'next_event',
      to_event_id: OTHER,
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
