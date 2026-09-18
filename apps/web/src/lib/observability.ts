import type { ErrorEvent } from '@sentry/nextjs';

/**
 * Whether crash reporting is switched on, and what it is allowed to carry.
 *
 * Off unless SENTRY_DSN is set, because a build with no DSN — CI, a local
 * checkout, a fork — must behave exactly as it did before this was added. The
 * SDK no-ops on an empty DSN, and being explicit about it here means the
 * decision is readable rather than implied.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';
export const SENTRY_ENABLED = SENTRY_DSN.length > 0;

/**
 * Shared options that keep personal data out of the error reports.
 *
 * This is a privacy decision before it is a technical one, and it is load
 * bearing twice over: residents' names, flats, phone numbers and payment
 * references are the whole point of the RLS work, and sending them to a third
 * party to debug a stack trace would undo it. It also decides what the Play
 * Data Safety form and the App Store privacy labels have to declare — crash
 * logs that carry no personal data are a much smaller disclosure than ones
 * that do, and the only honest way to make that claim is to be sure.
 *
 * So: `sendDefaultPii: false` (no IP address, no cookies, no request bodies),
 * and a scrubber that drops anything we might have put on the event ourselves.
 */
export const SENTRY_BASE = {
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
  // Traces cost money and answer a question nobody is asking yet.
  tracesSampleRate: 0,
  sendDefaultPii: false,
} as const;

/** Header names worth keeping; everything else on a request is dropped. */
const SAFE_HEADERS = new Set(['content-type', 'user-agent']);

/**
 * Strips the event down to what is useful for fixing a bug.
 *
 * Sentry already omits bodies with sendDefaultPii off; this removes the rest of
 * the places a name or a phone number can hide — the user object, cookies,
 * query strings and every header we have not explicitly allowed.
 */
export function scrub(event: ErrorEvent): ErrorEvent {
  const next = event as unknown as Record<string, unknown>;
  delete next.user;

  const request = next.request as Record<string, unknown> | undefined;
  if (request) {
    delete request.cookies;
    delete request.data;
    delete request.query_string;
    // A society slug in the path is not a secret, but an invite code in a
    // query string is, and /invite/CODE puts one in the path.
    if (typeof request.url === 'string') {
      request.url = request.url.split('?')[0]?.replace(/\/invite\/[^/]+/, '/invite/[code]');
    }
    const headers = request.headers as Record<string, string> | undefined;
    if (headers) {
      request.headers = Object.fromEntries(
        Object.entries(headers).filter(([name]) => SAFE_HEADERS.has(name.toLowerCase())),
      );
    }
  }
  return next as unknown as ErrorEvent;
}
