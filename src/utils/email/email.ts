import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import { emailValidator } from "~/components/forms/SignupForm.types";

// This module is statically imported by the client verify-email route, so it must
// stay free of server-only imports at module scope. All AWS SES / Prisma work
// lives in email-server.ts and is reached only through the handler below, whose
// body is stripped from the client bundle by the createServerFn compiler.

const sendVerificationEmailSchema = v.object({
  email: emailValidator,
});

// Neutral response returned whenever we decline to send (rate limited, no such
// account, or already verified). Identical wording in every case so the
// endpoint never reveals whether an address has an unverified account.
const NEUTRAL_RESEND_RESULT = {
  success: true as const,
  message: "If an account needs verification, a new email has been sent.",
};

/**
 * Server function wrapper for sendVerificationEmail
 * This allows the function to be called from client components using useServerFn
 */
export const sendVerificationEmailFn = createServerFn({ method: "POST" })
  .inputValidator(sendVerificationEmailSchema)
  .handler(async ({ data }) => {
    const [
      { getRequestHeaders },
      { checkRateLimit },
      { prismaClient },
      { sendVerificationEmail },
    ] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("~/utils/http/rate-limit"),
      import("../db/prisma"),
      import("./email-server"),
    ]);

    const headers = new Headers(getRequestHeaders() as HeadersInit);
    const ip =
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headers.get("x-real-ip") ||
      "unknown";
    const emailKey = data.email.toLowerCase().trim();

    // This endpoint is unauthenticated and triggers an AWS SES send, so it is
    // rate limited per source IP and per target address to prevent mailbox
    // flooding and SES cost/reputation abuse. Better Auth's rate limiting only
    // covers /api/auth/*, not TanStack server functions.
    const [ipLimit, emailLimit] = await Promise.all([
      checkRateLimit(`verify-email:ip:${ip}`, 5, 60 * 60),
      checkRateLimit(`verify-email:addr:${emailKey}`, 3, 60 * 60),
    ]);
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return NEUTRAL_RESEND_RESULT;
    }

    // Only send to an existing, still-unverified account. This stops the
    // endpoint from being used to bomb arbitrary third-party addresses and
    // avoids leaking which emails have accounts.
    const user = await prismaClient.user.findUnique({
      where: { email: data.email },
      select: { emailVerified: true },
    });
    if (!user || user.emailVerified) {
      return NEUTRAL_RESEND_RESULT;
    }

    await sendVerificationEmail(data.email);
    return NEUTRAL_RESEND_RESULT;
  });
