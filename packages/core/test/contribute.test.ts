import { describe, expect, it } from 'vitest';
import {
  contributionPresets,
  isSuggestedAmount,
  paymentEvidenceProblem,
  reportPaymentSchema,
} from '../src/payments';
import { fundBarSegments, fundedPercent, normalizeStats } from '../src/events';

/**
 * Two things a resident sees on the way to paying: what the bar says has been
 * raised, and what the screen suggests they give. Both apps read them from
 * here, so a phone that draws a different bar from the laptop is a
 * disagreement about the society's own money.
 */
describe('fundBarSegments', () => {
  it('draws confirmed money and money on its way as two stacked widths', () => {
    const bar = fundBarSegments(60_000, 20_000, 100_000);
    expect(bar).toEqual({ confirmed: 60, pending: 20 });
  });

  it('never lets the two together overflow the bar', () => {
    // 90% confirmed and another 30% reported is a real state — a fund can be
    // over-subscribed. The bar is still only 100% wide.
    const bar = fundBarSegments(90_000, 30_000, 100_000);
    expect(bar.confirmed).toBe(90);
    expect(bar.pending).toBe(10);
    expect(bar.confirmed + bar.pending).toBe(100);
  });

  it('gives confirmed money the whole bar when it has already filled it', () => {
    const bar = fundBarSegments(150_000, 20_000, 100_000);
    expect(bar).toEqual({ confirmed: 100, pending: 0 });
  });

  it('draws nothing for an event with no target', () => {
    expect(fundBarSegments(5_000, 1_000, 0)).toEqual({ confirmed: 0, pending: 0 });
  });

  it('keeps pending out of the raised figure entirely', () => {
    // The promise the whole ledger rests on: the headline total is confirmed
    // money. Pending is a second number, never folded into the first.
    const stats = normalizeStats({ fund_raised: 60_000, fund_pending: 20_000 });
    expect(stats.fundRaised).toBe(60_000);
    expect(stats.fundPending).toBe(20_000);
    expect(fundedPercent(stats.fundRaised, 100_000)).toBe(60);
  });

  it('reads a pending total the database hands back as a numeric string', () => {
    const stats = normalizeStats({ fund_pending: '12000.00' as unknown as number });
    expect(stats.fundPending).toBe(12_000);
  });

  it('is zero for an event nobody has paid towards', () => {
    const stats = normalizeStats(null);
    expect(stats.fundPending).toBe(0);
    expect(stats.pendingContributors).toBe(0);
  });
});

describe('contributionPresets', () => {
  it('offers the figure the committee asked for, and twice it', () => {
    expect(contributionPresets(2100)).toEqual([2100, 4200]);
  });

  it('falls back to the generic ladder when no figure was named', () => {
    expect(contributionPresets(null)).toEqual([500, 1001, 2001, 5001]);
    expect(contributionPresets(undefined)).toEqual([500, 1001, 2001, 5001]);
  });

  it('treats a nonsense figure as no figure rather than offering it', () => {
    for (const bad of [0, -100, Number.NaN]) {
      expect(contributionPresets(bad)).toEqual([500, 1001, 2001, 5001]);
    }
  });

  it('hands back a fresh array, so a caller sorting it cannot poison the next', () => {
    const first = contributionPresets(null);
    first.push(99);
    expect(contributionPresets(null)).toEqual([500, 1001, 2001, 5001]);
  });
});

describe('isSuggestedAmount', () => {
  it('marks only the committee’s own figure', () => {
    expect(isSuggestedAmount(2100, 2100)).toBe(true);
    expect(isSuggestedAmount(4200, 2100)).toBe(false);
  });

  it('marks nothing when no figure was named', () => {
    for (const preset of [500, 1001, 2001, 5001]) {
      expect(isSuggestedAmount(preset, null)).toBe(false);
    }
  });
});

describe('optionalUpiReference', () => {
  const parse = (input: unknown) => reportPaymentSchema.shape.reference.safeParse(input);

  it('accepts a real twelve-digit reference', () => {
    expect(parse('612345678901').data).toBe('612345678901');
  });

  it('strips the spaces UPI apps put in one', () => {
    expect(parse(' 6123 4567 8901 ').data).toBe('612345678901');
  });

  it('treats empty, null and missing alike, as no reference at all', () => {
    for (const nothing of ['', '   ', null, undefined]) {
      const result = parse(nothing);
      expect(result.success, String(nothing)).toBe(true);
      expect(result.data, String(nothing)).toBeNull();
    }
  });

  it('still refuses a half-typed one, which would match nothing and look like it should', () => {
    for (const wrong of ['61234', '6123-4567-8901!', 'way-too-long-to-be-a-reference-x']) {
      expect(parse(wrong).success, wrong).toBe(false);
    }
  });

  it('is as loose about the shape as it always was, deliberately', () => {
    // 10 to 22 alphanumerics, because apps differ about what they print and a
    // stricter rule would reject real references. It is a hint for the bank
    // matcher, not an identity check — the bank statement is the check.
    expect(parse('AXI123456789').data).toBe('AXI123456789');
  });
});

describe('paymentEvidenceProblem', () => {
  it('is happy with a reference alone', () => {
    expect(paymentEvidenceProblem('612345678901', false)).toBeNull();
  });

  it('is happy with a screenshot alone — the reference can be read off it later', () => {
    expect(paymentEvidenceProblem(null, true)).toBeNull();
  });

  it('is happy with both', () => {
    expect(paymentEvidenceProblem('612345678901', true)).toBeNull();
  });

  it('refuses neither, because that is a claim with nothing behind it', () => {
    const problem = paymentEvidenceProblem(null, false);
    expect(problem).toBeTruthy();
    expect(problem).toContain('screenshot');
  });

  it('treats an empty reference as no reference', () => {
    expect(paymentEvidenceProblem('', false)).toBeTruthy();
  });
});
