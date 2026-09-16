import { describe, expect, it } from 'vitest';
import { foundSocietySchema, residentPhoneSchema } from '../src/schemas';

/**
 * These have to agree with app.e164() in 20260917000100, which applies the
 * same rule where the data lands. If one of these cases changes, change both.
 */
describe('residentPhoneSchema', () => {
  it('gives a ten-digit Indian mobile its country code', () => {
    expect(residentPhoneSchema.parse('9845010101')).toBe('+919845010101');
  });

  it('ignores the spaces, dashes and brackets people type', () => {
    for (const typed of ['98450 10101', '98450-10101', '(98450) 10101', ' 9845010101 ']) {
      expect(residentPhoneSchema.parse(typed)).toBe('+919845010101');
    }
  });

  it('leaves a number that is already international alone', () => {
    expect(residentPhoneSchema.parse('+91 98450 10101')).toBe('+919845010101');
    expect(residentPhoneSchema.parse('+442071838750')).toBe('+442071838750');
  });

  it('refuses what cannot be dialled', () => {
    for (const bad of ['12345', '1234567890', 'not a phone', '', '+0 12345678']) {
      expect(residentPhoneSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('says how to fix it rather than just failing', () => {
    const result = residentPhoneSchema.safeParse('12345');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toMatch(/international format/i);
  });
});

describe('foundSocietySchema', () => {
  const valid = { name: 'Shraddha Whitecliff', city: 'Bengaluru', phone: '9845010101' };

  it('normalises the founder’s phone on the way through', () => {
    const parsed = foundSocietySchema.parse(valid);
    expect(parsed.phone).toBe('+919845010101');
  });

  it('will not found a society without one', () => {
    // The founder is the committee. Before this they were the one member of a
    // society nobody could reach.
    const result = foundSocietySchema.safeParse({ name: valid.name, city: valid.city });
    expect(result.success).toBe(false);
  });

  it('still lets the address and PIN code wait for the checklist', () => {
    const parsed = foundSocietySchema.parse(valid);
    expect(parsed.address).toBeUndefined();
    expect(parsed.pincode).toBeUndefined();
  });
});
