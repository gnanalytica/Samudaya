import * as Sentry from '@sentry/nextjs';
import { SENTRY_BASE, scrub } from '@/lib/observability';

// The middleware runs on the edge runtime and needs its own init.
Sentry.init({ ...SENTRY_BASE, beforeSend: (event) => scrub(event) });
