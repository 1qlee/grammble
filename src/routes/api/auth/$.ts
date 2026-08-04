import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/utils/auth/auth";
import { SignupSchema } from "~/components/forms/SignupForm.types";
import { safeParse } from "valibot";
import { validateUsernameAgainstBlacklist } from "~/utils/auth/username-validation";
import { sendVerificationEmail } from "~/utils/email/email";
import { prismaClient } from "~/utils/db/prisma";

type AuthResponseBody = Record<string, unknown> & {
  code: string;
  message: string;
  retryAfter?: number;
};

function jsonResponse(
  body: AuthResponseBody,
  status: number,
  extra?: HeadersInit
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

/**
 * Customize rate limit error response with a user-friendly message
 */
function customizeRateLimitResponse(
  response: Response,
  request: Request
): Response {
  const url = new URL(request.url);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  console.warn(
    `[Rate Limit] 429 Too Many Requests - Path: ${url.pathname}, IP: ${ip}`
  );

  const retryAfter =
    response.headers.get("Retry-After") ||
    response.headers.get("X-Retry-After") ||
    "60";
  const retryAfterNum = parseInt(retryAfter, 10);

  return new Response(
    JSON.stringify({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Please try again later.",
      retryAfter: retryAfterNum,
    } satisfies AuthResponseBody),
    {
      status: 429,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        "Content-Type": "application/json",
        "Retry-After": retryAfter,
      },
    }
  );
}

const MAX_REQUEST_BYTES = 100 * 1024;

async function validateRequestSize(
  request: Request
): Promise<Response | null> {
  const tooLarge = jsonResponse(
    { code: "REQUEST_TOO_LARGE", message: "Request too large" },
    413
  );

  // Fast path: reject when the declared length is over the cap.
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_REQUEST_BYTES) {
    return tooLarge;
  }

  // Content-Length is client-controlled and can be omitted (or the body sent
  // chunked) to skip the check above, so also measure the actual bytes. A clone
  // is read so the original body stays intact for the auth handler, and the
  // read aborts as soon as the cap is exceeded, keeping buffered memory bounded.
  const body = request.clone().body;
  if (!body) return null;

  const reader = body.getReader();
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return tooLarge;
      }
    }
  } catch (error) {
    // A malformed/aborted body isn't oversized per se; let the auth handler
    // deal with it. Log so the failure is visible.
    console.warn("[Auth] Failed to measure request body size:", error);
  }

  return null;
}

async function validateContentType(
  request: Request
): Promise<Response | null> {
  const contentType = request.headers.get("content-type");
  if (
    contentType &&
    !contentType.includes("application/json") &&
    !contentType.includes("application/x-www-form-urlencoded") &&
    !contentType.includes("multipart/form-data")
  ) {
    return jsonResponse(
      { code: "UNSUPPORTED_CONTENT_TYPE", message: "Unsupported content type" },
      415
    );
  }

  return null;
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const sizeValidationResponse = await validateRequestSize(request);
        if (sizeValidationResponse) {
          return sizeValidationResponse;
        }

        try {
          const response = await auth.handler(request);

          if (response.status === 429) {
            return customizeRateLimitResponse(response, request);
          }

          return response;
        } catch (error) {
          console.error("Auth handler error:", error);
          return jsonResponse(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            500
          );
        }
      },
      POST: async ({ request }: { request: Request }) => {
        const sizeValidationResponse = await validateRequestSize(request);
        if (sizeValidationResponse) {
          return sizeValidationResponse;
        }

        const contentTypeValidationResponse =
          await validateContentType(request);
        if (contentTypeValidationResponse) {
          return contentTypeValidationResponse;
        }

        const url = new URL(request.url);
        const isSignupRequest = url.pathname.includes("/sign-up/email");

        // Validate sign-up requests before passing to auth handler
        if (isSignupRequest) {
          const body = await request.clone().json();
          const errors: { code: string; message: string }[] = [];

          const schemaResult = safeParse(SignupSchema, body, {
            abortEarly: false,
          });

          if (!schemaResult.success) {
            schemaResult.issues.forEach((issue) => {
              const fieldPath =
                issue.path?.map((p) => p.key).join(".") || "unknown";
              errors.push({
                code: `INVALID_${fieldPath.toUpperCase()}`,
                message: `${fieldPath}: ${issue.message}`,
              });
            });
          }

          const username = body?.username;
          if (username && typeof username === "string") {
            const blacklistError = await validateUsernameAgainstBlacklist(username);
            if (blacklistError) {
              errors.push({
                code: "INAPPROPRIATE_USERNAME",
                message: `username: ${blacklistError}`,
              });
            }
          }

          if (errors.length > 0) {
            return jsonResponse(
              {
                code:
                  errors.length > 1
                    ? "MULTIPLE_VALIDATION_ERRORS"
                    : errors[0].code,
                message:
                  errors.length > 1
                    ? errors.map((e) => e.message).join(". ")
                    : errors[0].message,
              },
              400
            );
          }
        }

        try {
          let signupEmail: string | null = null;
          if (isSignupRequest) {
            try {
              const body = await request.clone().json();
              signupEmail = body?.email || null;
            } catch {
              // If we can't parse the body, continue anyway
            }
          }

          const response = await auth.handler(request);

          if (response.status === 429) {
            return customizeRateLimitResponse(response, request);
          }

          // Security: Prevent account enumeration via distinct signup error codes.
          // better-auth returns different codes for duplicate email vs duplicate username,
          // allowing attackers to probe which accounts exist. Normalize both into a
          // single generic code.
          if (
            isSignupRequest &&
            response.status >= 400 &&
            response.status < 500
          ) {
            const cloned = response.clone();
            try {
              const body = await cloned.json();
              const enumerationCodes = new Set([
                "USER_ALREADY_EXISTS",
                "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
                "USERNAME_IS_ALREADY_TAKEN",
              ]);
              if (body?.code && enumerationCodes.has(body.code)) {
                return jsonResponse(
                  {
                    code: "ACCOUNT_ALREADY_EXISTS",
                    message:
                      "An account with this email or username already exists.",
                  },
                  409
                );
              }
            } catch {
              // If we can't parse the body, fall through and return the original response
            }
          }

          // If signup was successful, send verification email and create settings
          if (isSignupRequest && response.status === 200 && signupEmail) {
            const storageKey = "_preferred-theme";
            const cookieHeader = request.headers.get("cookie") || "";
            const cookieMatch = cookieHeader.match(
              new RegExp(`(?:^|; )${storageKey}=([^;]*)`)
            );
            const themeFromCookie = cookieMatch?.[1] || "light";

            prismaClient.user
              .findUnique({
                where: { email: signupEmail },
                select: { id: true },
              })
              .then((user) => {
                if (user) {
                  return prismaClient.settings.upsert({
                    where: { userId: user.id },
                    create: {
                      userId: user.id,
                      theme: themeFromCookie === "dark" ? "dark" : "light",
                    },
                    update: {
                      theme: themeFromCookie === "dark" ? "dark" : "light",
                    },
                  });
                }
              })
              .catch((error) => {
                console.error(
                  `Failed to create settings for user ${signupEmail}:`,
                  error
                );
              });

            sendVerificationEmail(signupEmail).catch((error) => {
              console.error(
                `Failed to send verification email to ${signupEmail}:`,
                error
              );
            });

            // Check for invite token and auto-convert to lifetime premium
            const inviteMatch = cookieHeader.match(
              /(?:^|; )_invite-token=([^;]*)/
            );
            const inviteToken = inviteMatch?.[1];

            if (inviteToken) {
              prismaClient.user
                .findUnique({
                  where: { email: signupEmail },
                  select: { id: true },
                })
                .then(async (user) => {
                  if (!user) return;

                  const invite = await prismaClient.invite.findUnique({
                    where: { token: inviteToken },
                  });

                  if (!invite || invite.consumed) return;

                  // Atomically claim the invite before granting premium. The
                  // updateMany guard on `consumed: false` means only one of two
                  // concurrent signups presenting the same token wins the claim
                  // (count === 1); the loser is a no-op, preventing a single
                  // invite from granting lifetime premium more than once.
                  await prismaClient.$transaction(async (tx) => {
                    const claim = await tx.invite.updateMany({
                      where: { id: invite.id, consumed: false },
                      data: { consumed: true, consumedBy: user.id },
                    });
                    if (claim.count === 0) return;

                    await tx.user.update({
                      where: { id: user.id },
                      data: { isPremium: true, premiumGranted: true },
                    });

                    console.log(
                      `Invite token consumed: user ${user.id} granted lifetime premium`
                    );
                  });
                })
                .catch((error) => {
                  console.error(
                    `Failed to process invite token for ${signupEmail}:`,
                    error
                  );
                });
            }
          }

          return response;
        } catch (error) {
          console.error("Auth handler error:", error);
          return jsonResponse(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            500
          );
        }
      },
    },
  },
});
