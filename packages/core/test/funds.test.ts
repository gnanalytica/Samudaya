import { describe, expect, it } from 'vitest';
import {
  NEW_EDITION,
  SURPLUS_ANSWERS,
  SURPLUS_CHOICES,
  surplusKindFor,
  UNPUBLISHED_EVENT,
  addsToBalance,
  allocateSurplusSchema,
  fundMovementLine,
  holdingNote,
  nextEditionDate,
  nextEditionName,
  spendBalanceSchema,
  whereTheBalanceIs,
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
    ).toBe('₹500 the society had kept, put behind Pongal 2027');
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

describe('where the balance is', () => {
  // Shaped like the society that asked: ₹7,830 collected, a ₹10 bill, and the
  // ₹6,990 Challenge had left carried to Velocity vipers. Challenge then holds
  // nothing, and the other ₹830 is with the event it was collected for.
  const CHALLENGE = '33333333-3333-4333-8333-333333333333';
  const VIPERS = '44444444-4444-4444-8444-444444444444';
  const DIWALI = '55555555-5555-4555-8555-555555555555';
  const stats = [
    { event_id: CHALLENGE, available: '0.00', fund_carried: '-6990.00' },
    { event_id: VIPERS, available: '6990.00', fund_carried: '6990.00' },
    { event_id: DIWALI, available: '830.00', fund_carried: '0.00' },
  ];
  const events = [
    { id: CHALLENGE, name: 'Challenge', emoji: '🏆', slug: 'challenge', status: 'completed' },
    {
      id: VIPERS,
      name: 'Velocity vipers',
      emoji: '🏍️',
      slug: 'velocity-vipers',
      status: 'published',
    },
    { id: DIWALI, name: 'Diwali 2026', emoji: '🪔', slug: 'diwali-2026', status: 'published' },
  ];

  it('lists every event still holding money, largest first, and none that is not', () => {
    const rows = whereTheBalanceIs(stats, events);
    expect(rows.map((row) => [row.name, row.amount])).toEqual([
      ['Velocity vipers', 6_990],
      ['Diwali 2026', 830],
    ]);
  });

  it('adds up, with what the society kept, to the balance', () => {
    const kept = 0;
    const balance = 7_830 - 10;
    const rows = whereTheBalanceIs(stats, events);
    expect(rows.reduce((sum, row) => sum + row.amount, kept)).toBe(balance);
  });

  it('says where carried money came into an event', () => {
    const [vipers] = whereTheBalanceIs(stats, events);
    expect(holdingNote(vipers!)).toBe('₹6,990 carried across by the committee');
  });

  it('flags a closed event still holding money nobody has decided about', () => {
    const [row] = whereTheBalanceIs(
      [{ event_id: CHALLENGE, available: 830, fund_carried: -6_990 }],
      events,
    );
    expect(holdingNote(row!)).toBe('Closed, and the committee has not yet decided where this goes');
  });

  it('flags an event that has spent more than it holds, and lists it last', () => {
    const rows = whereTheBalanceIs(
      [...stats, { event_id: CHALLENGE, available: -500, fund_carried: 0 }],
      events,
    );
    expect(rows.at(-1)?.amount).toBe(-500);
    expect(holdingNote(rows.at(-1)!)).toBe('Has spent more than it holds');
  });

  it('keeps an event the viewer cannot see in the sum, without its name', () => {
    // A resident reads event_stats for every event, drafts included, but the
    // events table leaves drafts out — and money can be carried into a draft.
    const rows = whereTheBalanceIs(stats, events.slice(0, 1));
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.name === null)).toBe(true);
    expect(UNPUBLISHED_EVENT).toMatch(/not published/);
  });
});
