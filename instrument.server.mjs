// Server-side Sentry initialization. Preloaded before the app boots via the
// `--import` flag in the `start` script (and can be added to `dev` the same way).
// Entirely inert until SENTRY_DSN is set, so it is safe to ship unconfigured;
// set the DSN in production to turn error + performance monitoring on. The DSN
// may point at Sentry SaaS or a self-hosted GlitchTip instance (same protocol).
import * as Sentry from "@sentry/tanstackstart-react";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // Sample a fraction of requests for performance tracing in production to
    // keep event volume (and cost) bounded; capture everything in dev.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  });
}
