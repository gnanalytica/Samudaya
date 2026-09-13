import { describe, expect, it } from 'vitest';
import {
  billPath,
  paymentProofPath,
  upiNote,
  upiPayUri,
  upiReferenceSchema,
  upiVpaSchema,
} from '../src/payments';

describe('UPI links', () => {
  it('builds the standard upi://pay link with amount, payee and note', () => {
    const uri = upiPayUri({
      vpa: 'whitecliff.rwa@okaxis',
      payeeName: 'Whitecliff RWA',
      amount: 2001,
      note: 'A-1104 GANESH',
    });
    expect(uri.startsWith('upi://pay?')).toBe(true);
    const params = new URLSearchParams(uri.slice('upi://pay?'.length));
    expect(params.get('pa')).toBe('whitecliff.rwa@okaxis');
    expect(params.get('pn')).toBe('Whitecliff RWA');
    expect(params.get('am')).toBe('2001.00');
    expect(params.get('cu')).toBe('INR');
    expect(params.get('tn')).toBe('A-1104 GANESH');
    expect(uri).not.toContain('+');
  });

  it('makes a short statement note from flat and event', () => {
    expect(upiNote('A-1104', 'Ganesh Chaturthi 2026')).toBe('A-1104 GANESH');
    expect(upiNote(null, 'Deepavali 2026')).toBe('DEEPAVALI');
  });
});

describe('validation', () => {
  it('accepts real UPI IDs and rejects junk', () => {
    expect(upiVpaSchema.safeParse('society@okaxis').success).toBe(true);
    expect(upiVpaSchema.safeParse('9876543210@ybl').success).toBe(true);
    expect(upiVpaSchema.safeParse('not a vpa').success).toBe(false);
  });

  it('normalises and checks UPI references', () => {
    expect(upiReferenceSchema.parse(' 6123 4567 8901 ')).toBe('612345678901');
    expect(upiReferenceSchema.safeParse('123').success).toBe(false);
  });
});

describe('storage paths', () => {
  it('matches the bucket policy folders', () => {
    expect(billPath('c1', 'e1', 'Invoice.PDF')).toMatch(/^c1\/e1\/[a-z0-9-]+\.pdf$/);
    expect(paymentProofPath('c1', 'm1', 'shot.jpeg')).toMatch(/^c1\/m1\/[a-z0-9-]+\.jpeg$/);
  });
});
