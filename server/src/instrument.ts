// src/instrument.ts
// MUST be the very first import in main.ts. @sentry/nestjs instruments modules via
// import-time hooks, so Sentry.init has to run before anything else is imported.
//
// Reads process.env directly: this file executes before ConfigModule validates env,
// so it cannot depend on ConfigService. The same vars are also declared in
// src/config/env.validation.ts for validation/documentation.
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// SENTRY_DSN absent ⇒ init skipped, so local dev and tests never emit.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0),
    // Never let message content or PII leak into error reports (NF-15).
    sendDefaultPii: false,
    beforeSend(event) {
      // Defense in depth: strip request bodies from captured events.
      if (event.request) delete event.request.data;
      return event;
    },
  });
}
