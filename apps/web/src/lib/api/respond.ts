import { NextResponse } from 'next/server';

/**
 * One response shape for the whole public API, so a client can branch on
 * `error.code` instead of parsing prose.
 */

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'rate_limited'
  | 'conflict'
  | 'server_error';

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 422,
  rate_limited: 429,
  conflict: 409,
  server_error: 500,
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, { status: 200, ...init });
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(code: ApiErrorCode, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    {
      status: STATUS[code],
      // 401s tell the client which scheme to use rather than leaving it to guess.
      headers: code === 'unauthorized' ? { 'WWW-Authenticate': 'Bearer' } : undefined,
    },
  );
}

/** Clamps a `?limit=` to something a single response can carry. */
export function parseLimit(value: string | null, fallback = 25, max = 100): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

/**
 * Maps a failed resource Outcome onto the right HTTP response, so no route
 * has to enumerate the failure reasons itself.
 */
export function failFromOutcome(
  result:
    | { ok: false; reason: 'invalid'; error: { flatten: () => unknown } }
    | { ok: false; reason: 'not_found' },
  notFoundMessage = 'Not found.',
) {
  return result.reason === 'not_found'
    ? fail('not_found', notFoundMessage)
    : fail('invalid_request', 'Some fields are not valid.', result.error.flatten());
}
