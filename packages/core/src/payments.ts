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
export function upiPayUri({ vpa, payeeName, amount, note }: UpiPaymentLink): string {
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note,
  });
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
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
