import * as Sentry from '@sentry/nextjs';
import type { Instrumentation } from 'next';

/**
 * Where server errors go.
 *
 * `register` runs once per server instance and loads the right Sentry config
 * for the runtime it finds itself in; `onRequestError` is Next's hook for
 * errors it catches while rendering or handling a request, which is most of
 * the ones a resident would ever see.
 *
 * Both are inert without a DSN — see lib/observability.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('../sentry.server.config');
  if (process.env.NEXT_RUNTIME === 'edge') await import('../sentry.edge.config');
}

export const onRequestError: Instrumentation.onRequestError = Sentry.captureRequestError;
