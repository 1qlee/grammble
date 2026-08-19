// Fail-fast validation of critical server environment variables. Runs once at
// server boot (see start.ts) so a misconfigured deploy dies immediately with a
// single actionable error listing everything missing, instead of limping along
// and 500-ing on the first request that touches an unset var.
//
// Only enforced when NODE_ENV === "production": local dev and tests can run
// without Stripe/SES/Redis configured. Never runs in the browser.

// Vars the app cannot function without in production. BETTER_AUTH_SECRET and
// BETTER_AUTH_URL are read implicitly by Better Auth (not via process.env in our
// code), so they are listed here explicitly to catch their absence.
const REQUIRED = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "APP_URL",
  "SES_FROM_EMAIL",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_MONTHLY_PRICE_ID",
  "STRIPE_ANNUAL_PRICE_ID",
] as const;

function isSet(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

export function validateServerEnv(): void {
  if (typeof window !== "undefined") return;
  if (process.env.NODE_ENV !== "production") return;

  const missing = REQUIRED.filter((name) => !isSet(name));

  // Redis is required, but reachable via either a full URL or host/port pair.
  if (!isSet("REDIS_URL") && !isSet("REDIS_HOST")) {
    missing.push("REDIS_URL" as (typeof REQUIRED)[number]);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s) in production: ${missing.join(
        ", ",
      )}. Set them before starting the server.`,
    );
  }
}
