// Dev-only diagnostic logging. Silenced when NODE_ENV === "production" so
// operational logs stay clean and no request-scoped data (user ids, Stripe
// customer/subscription ids, email message ids) is written to production log
// storage. Errors are NOT routed through this -- they are logged
// unconditionally via console.error at their call sites.
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}
