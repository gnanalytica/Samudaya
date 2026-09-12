import type { ZodError } from 'zod';

/**
 * The shape every server action returns, so forms can render errors the same
 * way everywhere. `useActionState` needs a serialisable value, which rules out
 * throwing for expected failures like validation.
 */
export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

export const EMPTY_STATE: ActionState = {};

/** First message per field — showing three complaints about one input is noise. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Turns a PostgREST error into something a resident can act on.
 *
 * RLS denials surface as 42501; a violated exclusion constraint (two bookings
 * for one slot) as 23P01. Anything unrecognised gets a generic message rather
 * than leaking database internals into the UI.
 */
export function friendlyDbError(error: { code?: string; message?: string } | null): string {
  if (!error) return 'Something went wrong. Please try again.';
  switch (error.code) {
    case '42501':
      return 'You don’t have permission to do that.';
    case '23505':
      return 'That already exists.';
    case '23503':
      return 'That refers to something which no longer exists.';
    case '23P01':
      return 'That slot has just been taken. Pick another time.';
    case '23514':
      return 'Some of those details aren’t valid.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
