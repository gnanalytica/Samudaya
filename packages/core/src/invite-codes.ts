/**
 * Invite-code helpers shared by the web app, the mobile app and the WhatsApp
 * bot, so all three treat a typed-in code exactly the way the database does.
 */

/** Matches app.random_code(): no 0/O, 1/I/L or U/V lookalikes. */
export const INVITE_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Strips whatever the human typed down to the canonical stored form. */
export function normalizeInviteCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** `K7MQ3XPB` → `K7MQ-3XPB`, for display only. */
export function formatInviteCode(code: string): string {
  const normalized = normalizeInviteCode(code);
  if (normalized.length !== 8) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function isPlausibleInviteCode(input: string): boolean {
  const normalized = normalizeInviteCode(input);
  if (normalized.length < 6 || normalized.length > 16) return false;
  return [...normalized].every((ch) => INVITE_CODE_ALPHABET.includes(ch));
}

/**
 * The Society ID an admin shares (`MHR-4827`) uses the same alphabet, so the
 * same normaliser handles both. Knowing it only lets someone *ask* to join.
 */
export const normalizeJoinCode = normalizeInviteCode;

/** The statuses public.request_to_join() can return. */
export type JoinRequestStatus =
  'pending' | 'already_member' | 'not_found' | 'bad_unit' | 'rate_limited' | 'unauthenticated';

const JOIN_MESSAGES: Record<JoinRequestStatus, string> = {
  pending: 'Request sent. Your society admin will approve it shortly.',
  already_member: 'You’re already a member of this community.',
  not_found: 'We don’t recognise that Society ID. Check it and try again.',
  bad_unit: 'That flat isn’t part of this community.',
  rate_limited: 'Too many attempts. Wait 15 minutes and try again.',
  unauthenticated: 'Please sign in first.',
};

export function joinMessage(status: string): string {
  return JOIN_MESSAGES[status as JoinRequestStatus] ?? 'Something went wrong. Please try again.';
}

/** The statuses public.redeem_invite_code() can return. */
export type RedeemStatus =
  | 'ok'
  | 'already_member'
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'exhausted'
  | 'rate_limited'
  | 'unauthenticated';

const REDEEM_MESSAGES: Record<RedeemStatus, string> = {
  ok: 'You’re in.',
  already_member: 'You’re already a member of this community.',
  not_found: 'We don’t recognise that code. Check it and try again.',
  expired: 'That code has expired. Ask your admin for a new one.',
  revoked: 'That code was cancelled. Ask your admin for a new one.',
  exhausted: 'That code has already been used the maximum number of times.',
  rate_limited: 'Too many incorrect codes. Wait 15 minutes and try again.',
  unauthenticated: 'Please sign in first.',
};

export function redeemMessage(status: string): string {
  return REDEEM_MESSAGES[status as RedeemStatus] ?? 'Something went wrong. Please try again.';
}

/** `ok` and `already_member` both mean the member ends up inside. */
export function isRedeemSuccess(status: string): boolean {
  return status === 'ok' || status === 'already_member';
}
