import * as Sentry from '@sentry/nextjs';
import { SENTRY_BASE, scrub } from '@/lib/observability';

// Server-side errors: server components, route handlers, server actions.
Sentry.init({ ...SENTRY_BASE, beforeSend: (event) => scrub(event) });
