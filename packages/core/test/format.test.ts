import { describe, expect, it } from 'vitest';
import { todayIn } from '../src/format';

describe('todayIn', () => {
  it('uses the society clock, not UTC', () => {
    // 20:00 UTC on 13 Sep is 01:30 on 14 Sep in India.
    const lateUtc = new Date('2026-09-13T20:00:00Z');
    expect(todayIn('Asia/Kolkata', lateUtc)).toBe('2026-09-14');
    expect(todayIn('UTC', lateUtc)).toBe('2026-09-13');
  });

  it('falls back to India for a missing or unknown zone', () => {
    const lateUtc = new Date('2026-09-13T20:00:00Z');
    expect(todayIn(null, lateUtc)).toBe('2026-09-14');
    expect(todayIn('Not/AZone', lateUtc)).toBe('2026-09-14');
  });
});
