import { describe, expect, it } from 'vitest';
import { MATCH_CONFIDENCE } from '../src/statement';
import {
  contributionPresets,
  flatMatchesTag,
  flatTagIn,
  isSuggestedAmount,
  paymentEvidenceProblem,
  reportPaymentSchema,
  upiNote,
} from '../src/payments';
import { fundBarSegments, fundedPercent, normalizeStats, stillNeeded } from '../src/events';

/**
 * Two things a resident sees on the way to paying: what the bar says has been
 * raised, and what the screen suggests they give. Both apps read them from
 * here, so a phone that draws a different bar from the laptop is a
 * disagreement about the society's own money.
 */
describe('fundBarSegments', () => {
  it('draws confirmed money and money on its way as two stacked widths', () => {
    const bar = fundBarSegments(60_000, 20_000, 100_000);
    expect(bar).toEqual({ carried: 0, confirmed: 60, pending: 20 });
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
    expect(bar).toEqual({ carried: 0, confirmed: 100, pending: 0 });
  });

  it('draws nothing for an event with no target', () => {
    expect(fundBarSegments(5_000, 1_000, 0)).toEqual({
      carried: 0,
      confirmed: 0,
      pending: 0,
    });
  });

  it('draws money carried across first, and never counts it as a contribution', () => {
    const bar = fundBarSegments(30_000, 0, 100_000, 10_000);
    expect(bar).toEqual({ carried: 10, confirmed: 30, pending: 0 });
  });

  it('keeps all three inside the bar when the fund is over-subscribed', () => {
    const bar = fundBarSegments(90_000, 30_000, 100_000, 40_000);
    expect(bar.carried).toBe(40);
    expect(bar.confirmed).toBe(60);
    expect(bar.pending).toBe(0);
    expect(bar.carried + bar.confirmed + bar.pending).toBe(100);
  });

  it('draws nothing for an event that gave its surplus away', () => {
    // fund_carried is net, so an event that carried money out reads negative.
    // What it did belongs on its own record, not as a negative width here.
    const bar = fundBarSegments(30_000, 0, 100_000, -10_000);
    expect(bar).toEqual({ carried: 0, confirmed: 30, pending: 0 });
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

describe('the note a bank statement keeps', () => {
  it('leads with one contiguous token, because that is what survives', () => {
    const note = upiNote('A-1104', 'Ganesh Chaturthi 2026');
    expect(note).toBe('SMDA1104 GANESH');
    // No space, no hyphen, nothing a bank will punctuate differently.
    expect(note.split(' ')[0]).toMatch(/^[A-Z0-9]+$/);
  });

  it('puts the token first, because banks truncate from the right', () => {
    expect(upiNote('B-2', 'Diwali')).toMatch(/^SMD/);
  });

  it('writes no token for somebody with no flat, having nothing to name', () => {
    expect(upiNote(null, 'Deepavali 2026')).toBe('DEEPAVALI');
    expect(flatTagIn(upiNote(null, 'Deepavali'))).toBeNull();
  });

  it('stays inside the length a UPI note allows', () => {
    const note = upiNote('PHASE-2-TOWER-C-1104', 'Ganesh Chaturthi Celebrations');
    expect(note.length).toBeLessThanOrEqual(50);
  });
});

describe('flatTagIn', () => {
  it('finds the flat in a narration the bank has mangled around it', () => {
    for (const narration of [
      'UPI/CR/612345678901/RIA MENON/HDFC/SMDA1104 GANESH',
      'UPI-SMDA1104-612345678901',
      'NEFT SMDA1104 GANESH RIA MENON',
      'smda1104 ganesh',
    ]) {
      expect(flatTagIn(narration), narration).toBe('A1104');
    }
  });

  it('is null when the payer did not keep the note', () => {
    for (const narration of [
      'UPI/CR/612345678901/RIA MENON/HDFC',
      'ATM WDL 612345678901',
      null,
      '',
    ]) {
      expect(flatTagIn(narration), String(narration)).toBeNull();
    }
  });

  it('round-trips whatever upiNote wrote', () => {
    for (const flat of ['A-1104', 'B2', 'C-12', '1104']) {
      expect(flatMatchesTag(flat, flatTagIn(upiNote(flat, 'Ganesh')))).toBe(true);
    }
  });
});

describe('flatMatchesTag', () => {
  it('ignores the punctuation a flat is written with', () => {
    expect(flatMatchesTag('A-1104', 'A1104')).toBe(true);
    expect(flatMatchesTag('a 1104', 'A1104')).toBe(true);
  });

  it('does not match a different flat, or nothing at all', () => {
    expect(flatMatchesTag('A-1104', 'A1105')).toBe(false);
    expect(flatMatchesTag('A-1104', null)).toBe(false);
    expect(flatMatchesTag(null, 'A1104')).toBe(false);
    // Two flats with no label must not collide on the empty string.
    expect(flatMatchesTag('', '')).toBe(false);
  });
});

describe('MATCH_CONFIDENCE', () => {
  it('names every tier bank_line_candidates can return', () => {
    // The function's case expression has exactly these four arms. A tier added
    // there without a word here would reach staff as a blank.
    expect(Object.keys(MATCH_CONFIDENCE).sort()).toEqual(['amount', 'close', 'flat', 'reference']);
  });

  it('says what a flat match means, since it is the one that ignores the amount', () => {
    expect(MATCH_CONFIDENCE.flat).toContain('flat');
  });
});

describe('what is still needed', () => {
  it('counts money carried across, so nobody is asked for it twice', () => {
    expect(stillNeeded(50_000, 30_000, 10_000)).toBe(10_000);
  });

  it('is zero rather than negative once the target is passed', () => {
    expect(stillNeeded(50_000, 45_000, 10_000)).toBe(0);
  });

  it('ignores a negative carried figure rather than inflating the ask', () => {
    expect(stillNeeded(50_000, 30_000, -10_000)).toBe(20_000);
  });
});
