import { describe, expect, it } from 'vitest';
import {
  billPath,
  correctionNote,
  correctionNoteForStaff,
  newTransactionRef,
  parseUpiResponse,
  paymentProofPath,
  upiCaptureNote,
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
      // Built rather than restated, so the link test cannot drift away from
      // what upiNote actually writes.
      note: upiNote('A-1104', 'Ganesh Chaturthi 2026'),
    });
    expect(uri.startsWith('upi://pay?')).toBe(true);
    const params = new URLSearchParams(uri.slice('upi://pay?'.length));
    expect(params.get('pa')).toBe('whitecliff.rwa@okaxis');
    expect(params.get('pn')).toBe('Whitecliff RWA');
    expect(params.get('am')).toBe('2001.00');
    expect(params.get('cu')).toBe('INR');
    expect(params.get('tn')).toBe('SMDA1104 GANESH');
    expect(uri).not.toContain('+');
  });

  it('makes a short statement note from flat and event', () => {
    expect(upiNote('A-1104', 'Ganesh Chaturthi 2026')).toBe('SMDA1104 GANESH');
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

describe('UPI app responses', () => {
  it('reads a successful response and prefers the bank reference', () => {
    const result = parseUpiResponse(
      'txnId=AXI7Y2K&responseCode=00&Status=SUCCESS&txnRef=SMDY1&ApprovalRefNo=612345678901',
    );
    expect(result.status).toBe('success');
    expect(result.reference).toBe('612345678901');
    expect(result.txnRef).toBe('SMDY1');
  });

  it('copes with lower-case keys, a leading ? and missing approval numbers', () => {
    const result = parseUpiResponse('?txnid=YBL0123456789AB&status=submitted&approvalRefNo=null');
    expect(result.status).toBe('submitted');
    expect(result.approvalRef).toBeNull();
    expect(result.reference).toBe('YBL0123456789AB');
  });

  it('reports failures and empty responses without inventing a reference', () => {
    expect(parseUpiResponse('Status=FAILURE&responseCode=ZD').status).toBe('failure');
    const empty = parseUpiResponse(undefined);
    expect(empty.status).toBe('unknown');
    expect(empty.reference).toBeNull();
  });

  it('passes our transaction reference to the UPI app', () => {
    const ref = newTransactionRef();
    expect(ref).toMatch(/^SMDY[A-Z0-9]+$/);
    expect(ref.length).toBeLessThanOrEqual(35);
    const uri = upiPayUri({
      vpa: 'a@okaxis',
      payeeName: 'A',
      amount: 1,
      note: 'N',
      transactionRef: ref,
    });
    expect(new URLSearchParams(uri.slice('upi://pay?'.length)).get('tr')).toBe(ref);
  });
});

describe('capture note for staff', () => {
  it('flags captures and whether our reference came back', () => {
    expect(upiCaptureNote({})).toBeNull();
    expect(upiCaptureNote({ source: 'upi_app', txn_ref: 'SMDY1', expected_txn_ref: 'SMDY1' })).toBe(
      'Captured from the resident’s UPI app.',
    );
    expect(
      upiCaptureNote({ source: 'upi_app', txn_ref: null, expected_txn_ref: 'SMDY1' }),
    ).toContain('check it carefully');
  });
});

describe('a corrected amount', () => {
  it('says nothing about a payment nobody corrected', () => {
    expect(correctionNote(2100, null)).toBeNull();
    expect(correctionNote(2100, undefined)).toBeNull();
    // A row where the two agree is a correction that was undone, or a figure
    // that was re-entered unchanged. Either way there is nothing to explain.
    expect(correctionNote(2100, 2100)).toBeNull();
  });

  it('names the figure the resident actually typed', () => {
    expect(correctionNote(10, 1000)).toBe('Corrected from ₹1,000, which is what you reported');
    expect(correctionNoteForStaff(10, 1000)).toBe(
      'Corrected from ₹1,000, which is what the flat reported',
    );
  });

  it('reads the numeric strings PostgREST returns as well as numbers', () => {
    expect(correctionNote('10.00', '1000.00')).toBe(
      'Corrected from ₹1,000, which is what you reported',
    );
    expect(correctionNote('2100.00', '2100.00')).toBeNull();
  });

  it('says nothing rather than something wrong when a figure is unreadable', () => {
    expect(correctionNote(10, 'not a number')).toBeNull();
    expect(correctionNote(10, '')).toBeNull();
  });

  it('works upwards too, because a correction is not always downwards', () => {
    expect(correctionNote(5000, 500)).toBe('Corrected from ₹500, which is what you reported');
  });
});
