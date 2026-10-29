// Crash reporting, production only. Wired 2026-10-07 as part of Bug Desk's
// Sentry rollout: every new error here becomes a Bug Desk card with a fix
// plan on Matt's phone, and closing the card resolves it in Sentry.
//
// Uncaught errors, and since 2026-10-08 every console.error too — the
// caught failures that used to die in a console nobody reads (a refused
// write, a sync that gave up). utils/sentryHandled.js budgets and groups
// those so they cannot spend the free plan's error quota, which every app
// shares; a crash or a handled failure is what Bug Desk can act on.
// No performance tracing (tracesSampleRate 0): this app's reads are small. Every URL is scrubbed before it leaves — Firebase takes the sign-in
// token as `?auth=` and other APIs their keys in the query string, and
// Sentry would keep them for 90 days (Cinema Roll's 2026-10-06 lesson,
// utils/scrubUrl.js).
import * as Sentry from '@sentry/vue';
import { scrubBreadcrumb, scrubEvent } from './utils/scrubUrl';
import { handledErrorFilter } from './utils/sentryHandled.js';

// No Sentry project yet: neither token in ~/.config/sentry may create one
// (2026-10-29). Paste the DSN here once the project exists and this turns on.
const DSN = '';

export function setupSentry (app) {
  if (!import.meta.env.PROD || !DSN) return;
  // VUE_APP_GIT_SHA is defined at build time (scripts/writeVersion.mjs),
  // the same sha the build stamp shows, so an error names the deploy it came from.
  const version = process.env.VUE_APP_GIT_SHA;
  Sentry.init({
    app,
    dsn: DSN,
    release: version ? `deck-city@${version}` : undefined,
    environment: 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    sampleRate: 1.0,
    integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
    attachStacktrace: true,
    maxValueLength: 8000,
    beforeSend: handledErrorFilter(scrubEvent),
    beforeBreadcrumb: scrubBreadcrumb,
  });
}
