import { z } from 'zod';

/**
 * Payments go straight from a resident's UPI app to the society's own UPI ID:
 * no gateway, no KYC, nothing to approve. The app opens the UPI app with the
 * amount and a note pre-filled; the resident then reports the 12-digit UPI
 * reference (UTR) and staff confirm it against the bank statement.
 */

/** Same rule as the communities_upi_vpa_format check in the database. */
export const UPI_VPA_PATTERN = /^[A-Za-z0-9._-]{2,255}@[A-Za-z][A-Za-z0-9.-]{1,64}$/;

export const upiVpaSchema = z
  .string()
  .trim()
  .regex(UPI_VPA_PATTERN, 'Enter a UPI ID like society@okaxis');

/** UPI references (UTR / transaction IDs) are 12 digits; some apps show more. */
export const upiReferenceSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, ''))
  .pipe(
    z
      .string()
      .regex(/^[A-Za-z0-9]{10,22}$/, 'Enter the 12-digit UPI reference from your payment app'),
  );

export const reportPaymentSchema = z.object({
  event_id: z.string().uuid(),
  amount: z.coerce.number().positive('Enter the amount you paid').max(10_000_000),
  reference: upiReferenceSchema,
});

export type UpiPaymentLink = {
  vpa: string;
  payeeName: string;
  amount: number;
  /** Shown in the resident's and the society's bank statements. */
  note: string;
  /**
   * Our own id for this attempt (UPI `tr`). Many apps echo it back as
   * `txnRef`, which ties the app's response to the payment we started.
   */
  transactionRef?: string;
};

/**
 * A note that identifies the payment on a bank statement, e.g. "A-1104 GANESH".
 * UPI notes are short and some banks drop punctuation, so keep it plain.
 */
export function upiNote(flatLabel: string | null | undefined, eventName: string): string {
  const flat = (flatLabel ?? '').replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  const event = eventName
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)[0]
    ?.toUpperCase();
  return [flat, event].filter(Boolean).join(' ').slice(0, 50);
}

/** The `upi://pay` link every UPI app understands (NPCI deep-link format). */
export function upiPayUri({
  vpa,
  payeeName,
  amount,
  note,
  transactionRef,
}: UpiPaymentLink): string {
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note,
  });
  if (transactionRef) params.set('tr', transactionRef);
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}

/** A fresh, UPI-safe reference for one payment attempt, e.g. "SMDY7K2F9QX1". */
export function newTransactionRef(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `SMDY${Date.now().toString(36)}${random}`.toUpperCase().slice(0, 35);
}

export type UpiAppResult = {
  /** 'submitted' means the UPI app accepted it but the bank has not settled yet. */
  status: 'success' | 'submitted' | 'failure' | 'unknown';
  /** The bank reference (UTR) when the app gives one, else the app's transaction id. */
  reference: string | null;
  approvalRef: string | null;
  txnId: string | null;
  txnRef: string | null;
  responseCode: string | null;
  raw: string;
};

/**
 * Reads the key=value string an Android UPI app hands back after a payment,
 * e.g. "txnId=AXI123&responseCode=00&Status=SUCCESS&txnRef=SMDY...&ApprovalRefNo=612345678901".
 *
 * Apps differ in key casing, order and which keys they send, and some send
 * nothing. The result is the payer's phone talking, not the bank: treat it as
 * a report that still needs staff to confirm against the statement.
 */
export function parseUpiResponse(raw: string | null | undefined): UpiAppResult {
  const text = (raw ?? '').trim().replace(/^\?/, '');
  const values = new Map<string, string>();
  for (const part of text.split('&')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim().toLowerCase();
    let value = part.slice(index + 1).trim();
    try {
      value = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      // Keep the raw value if an app sent a malformed escape.
    }
    if (value && value.toLowerCase() !== 'null' && value.toLowerCase() !== 'undefined') {
      values.set(key, value);
    }
  }

  const statusText = (values.get('status') ?? '').toLowerCase();
  const status: UpiAppResult['status'] =
    statusText === 'success'
      ? 'success'
      : statusText === 'submitted' || statusText === 'pending'
        ? 'submitted'
        : statusText === 'failure' || statusText === 'failed'
          ? 'failure'
          : 'unknown';

  const approvalRef = values.get('approvalrefno') ?? null;
  const txnId = values.get('txnid') ?? null;
  const usable = (value: string | null) =>
    value && /^[A-Za-z0-9]{10,22}$/.test(value.replace(/\s+/g, ''))
      ? value.replace(/\s+/g, '')
      : null;

  return {
    status,
    reference: usable(approvalRef) ?? usable(txnId),
    approvalRef,
    txnId,
    txnRef: values.get('txnref') ?? null,
    responseCode: values.get('responsecode') ?? null,
    raw: text,
  };
}

/**
 * For staff reviewing a report: how it reached us. A capture from the UPI app is
 * still the payer's phone talking, but an echoed transaction reference means it
 * answered the payment Samudaya started rather than something pasted in.
 */
export function upiCaptureNote(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;
  if (data.source !== 'upi_app') return null;
  const echoed = Boolean(data.txn_ref) && data.txn_ref === data.expected_txn_ref;
  const processing =
    data.status === 'submitted' ? ' The UPI app said it was still processing.' : '';
  return echoed
    ? `Captured from the resident’s UPI app.${processing}`
    : `Captured from the resident’s UPI app, but it did not return our payment reference, so check it carefully.${processing}`;
}

/** Storage paths, mirroring the bucket policies in the database. */
export const billPath = (communityId: string, eventId: string, fileName: string) =>
  `${communityId}/${eventId}/${safeFileName(fileName)}`;

export const paymentProofPath = (communityId: string, membershipId: string, fileName: string) =>
  `${communityId}/${membershipId}/${safeFileName(fileName)}`;

/** Unique, URL-safe file name that keeps the extension. */
export function safeFileName(original: string): string {
  const dot = original.lastIndexOf('.');
  const ext =
    dot > -1
      ? original
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : '';
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return ext ? `${stamp}.${ext}` : stamp;
}

export const UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const;

/**
 * The amounts the contribute screen offers, given what the event asks for.
 *
 * Societies do not think in ladders, they think in a figure: "₹2,100 per flat
 * this year." When the committee has named one it is the whole answer, and the
 * only other chip worth offering is twice it — for the household paying for
 * two flats they own, or doubling as a gesture, both of which happen often
 * enough to be worth a tap. Everything else is what the custom field is for.
 *
 * With no figure named, the generic ladder stands in. There is one of it now:
 * the web offered ₹500/₹1,001/₹2,001/₹5,001 and the phone ₹1,001/₹2,001/₹5,001,
 * which is the kind of difference nobody decides on purpose.
 */
export const GENERIC_CONTRIBUTION_PRESETS = [500, 1001, 2001, 5001] as const;

export function contributionPresets(suggested: number | null | undefined): number[] {
  const asked = Number(suggested ?? 0);
  if (!Number.isFinite(asked) || asked <= 0) return [...GENERIC_CONTRIBUTION_PRESETS];
  return [asked, asked * 2];
}

/** True when this chip is the figure the committee actually asked for. */
export function isSuggestedAmount(preset: number, suggested: number | null | undefined): boolean {
  const asked = Number(suggested ?? 0);
  return Number.isFinite(asked) && asked > 0 && preset === asked;
}
