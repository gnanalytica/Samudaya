import * as Sentry from '@sentry/nextjs';
import { SENTRY_BASE, scrub } from '@/lib/observability';

/**
 * Errors in the browser. No session replay and no PII: a replay of somebody
 * filling in their flat number and phone is exactly the recording this app
 * should not be making.
 */
Sentry.init({ ...SENTRY_BASE, beforeSend: (event) => scrub(event) });

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
