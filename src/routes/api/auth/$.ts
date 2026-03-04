import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/utils/auth/auth";
import {
  getCorsHeaders,
  getCorsPreflightHeaders,
  createCorsErrorResponse,
  getAllowedOrigin,
} from "~/utils/cors";
import { trackRequestAndGetRemaining } from "~/utils/rate-limit";
import { SignupSchema } from "~/components/forms/SignupForm.types";
import { safeParse } from "valibot";
import { validateUsernameAgainstBlacklist } from "~/utils/username-validation";
import { sendVerificationEmail } from "~/utils/email";
import { prismaClient } from "~/utils/prisma";

type AuthResponseBody = Record<string, unknown> & {
  remainingAttempts?: number;
  code: string;
  message: string;
  retryAfter?: number;
};

/**
 * Customize rate limit error response with a user-friendly message
 */
async function customizeRateLimitResponse(
  response: Response,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  console.warn(
    `[Rate Limit] 429 Too Many Requests - Path: ${url.pathname}, IP: ${ip}`
  );

  // Get retry-after header from original response
  const retryAfter =
    response.headers.get("Retry-After") ||
    response.headers.get("X-Retry-After") ||
    "60";
  const retryAfterNum = parseInt(retryAfter, 10);

  // Track request and get remaining attempts
  const rateLimitInfo = await trackRequestAndGetRemaining(request);

  // Get CORS headers (security headers are handled globally in start.ts)
  const corsHeaders = getCorsHeaders(request);

  // Build response body
  const responseBody: AuthResponseBody = {
    code: "TOO_MANY_REQUESTS",
    message: "Too many attempts! Please try again later.",
    retryAfter: retryAfterNum,
    remainingAttempts: rateLimitInfo?.remaining,
  };

  // Return custom error message
  return new Response(JSON.stringify(responseBody), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": retryAfter,
      ...Object.fromEntries(response.headers.entries()),
      ...corsHeaders,
    },
  });
}

/**
 * Validate request size and return error response if too large
 * @param request - The incoming request
 * @param options - Options for the validation
 * @returns Response if request is too large, null if valid
 */
async function validateRequestSize(request: Request): Promise<Response | null> {
  const contentLength = request.headers.get("content-length");

  if (contentLength && parseInt(contentLength) > 100 * 1024) {
    // 100KB limit (security headers handled globally in start.ts)
    const corsHeaders = getCorsHeaders(request);

    // Track request and get remaining attempts even on validation errors
    const rateLimitInfo = await trackRequestAndGetRemaining(request);

    const responseBody: AuthResponseBody = {
      code: "REQUEST_TOO_LARGE",
      message: "Request too large",
      remainingAttempts: rateLimitInfo?.remaining,
    };

    return new Response(JSON.stringify(responseBody), {
      status: 413,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
      statusText: "Request too large",
    });
  }

  return null;
}

/**
 * Validate Content-Type header for POST requests
 * @param request - The incoming request
 * @returns Response if Content-Type is unsupported, null if valid
 */
async function validateContentType(request: Request): Promise<Response | null> {
  const contentType = request.headers.get("content-type");
  if (
    contentType &&
    !contentType.includes("application/json") &&
    !contentType.includes("application/x-www-form-urlencoded") &&
    !contentType.includes("multipart/form-data")
  ) {
    const corsHeaders = getCorsHeaders(request);
    // Track request and get remaining attempts even on validation errors
    const rateLimitInfo = await trackRequestAndGetRemaining(request);
    const responseBody: AuthResponseBody = {
      code: "UNSUPPORTED_CONTENT_TYPE",
      message: "Unsupported content type",
      remainingAttempts: rateLimitInfo?.remaining,
    };
    return new Response(JSON.stringify(responseBody), {
      status: 415,
      statusText: "Unsupported content type",
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }

  return null;
}

/**
 * Add CORS headers and remaining attempts to response body
 * Note: Security headers are handled globally in start.ts middleware
 */
async function addCorsHeadersAndRateLimitInfo(
  response: Response,
  request: Request
): Promise<Response> {
  const corsHeaders = getCorsHeaders(request);

  // Track request and get remaining attempts
  const rateLimitInfo = await trackRequestAndGetRemaining(request);

  // Check if response is JSON
  const contentType = response.headers.get("content-type") || "";
  const isJSON = contentType.includes("application/json");

  // Only modify JSON responses
  if (isJSON) {
    try {
      const text = await response.clone().text();
      if (text) {
        const responseBody: AuthResponseBody = JSON.parse(text);

        // Add remainingAttempts to response body
        responseBody.remainingAttempts = rateLimitInfo?.remaining;

        // Create new response with CORS headers and updated body
        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });

        return new Response(JSON.stringify(responseBody), {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
    } catch (error) {
      // If parsing fails, fall through to non-JSON handling
    }
  }

  // For non-JSON responses, just add CORS headers
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  // Return original response with CORS headers (can't modify non-JSON body)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      // Handle CORS preflight requests
      OPTIONS: async ({ request }: { request: Request }) => {
        // Check if origin is allowed
        const allowedOrigin = getAllowedOrigin(request);

        if (!allowedOrigin && request.headers.get("origin")) {
          // Origin not allowed (security headers handled globally in start.ts)
          return createCorsErrorResponse();
        }

        // Return preflight response with CORS headers
        // Security headers are handled globally in start.ts
        const corsHeaders = getCorsPreflightHeaders(request);
        return new Response(null, {
          status: 204, // No Content
          headers: corsHeaders,
        });
      },
      GET: async ({ request }: { request: Request }) => {
        // Security: Validate request size (prevent DoS)
        const sizeValidationResponse = await validateRequestSize(request);
        if (sizeValidationResponse) {
          return sizeValidationResponse;
        }

        try {
          const response = await auth.handler(request);

          // Customize rate limit error message
          if (response.status === 429) {
            return await customizeRateLimitResponse(response, request);
          }

          // Add CORS headers and remaining attempts to ALL responses (success, errors, etc.)
          // This ensures clients always know how many attempts remain
          return await addCorsHeadersAndRateLimitInfo(response, request);
        } catch (error) {
          // Security: Don't leak internal error details
          console.error("Auth handler error:", error);
          const corsHeaders = getCorsHeaders(request);
          // Track request and get remaining attempts even on errors
          const rateLimitInfo = await trackRequestAndGetRemaining(request);
          const responseBody: AuthResponseBody = {
            code: "INTERNAL_ERROR",
            message: "Internal server error",
            remainingAttempts: rateLimitInfo?.remaining,
          };

          return new Response(JSON.stringify(responseBody), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          });
        }
      },
      POST: async ({ request }: { request: Request }) => {
        // Security: Validate request size (prevent DoS)
        const sizeValidationResponse = await validateRequestSize(request);
        if (sizeValidationResponse) {
          return sizeValidationResponse;
        }

        // Security: Validate Content-Type for POST requests
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

          // Validate request against the SignupSchema
          const schemaResult = safeParse(SignupSchema, body, {
            abortEarly: false,
          });

          if (!schemaResult.success) {
            // Collect all schema validation errors
            schemaResult.issues.forEach((issue) => {
              const fieldPath =
                issue.path?.map((p) => p.key).join(".") || "unknown";
              errors.push({
                code: `INVALID_${fieldPath.toUpperCase()}`,
                message: `${fieldPath}: ${issue.message}`,
              });
            });
          }

          // Additional validation: check username against blacklist
          const username = body?.username;
          if (username && typeof username === "string") {
            const blacklistError = validateUsernameAgainstBlacklist(username);
            if (blacklistError) {
              errors.push({
                code: "INAPPROPRIATE_USERNAME",
                message: `username: ${blacklistError}`,
              });
            }
          }

          // If there are validation errors, return error response with remainingAttempts
          if (errors.length > 0) {
            const corsHeaders = getCorsHeaders(request);
            const responseBody: AuthResponseBody = {
              code:
                errors.length > 1
                  ? "MULTIPLE_VALIDATION_ERRORS"
                  : errors[0].code,
              message:
                errors.length > 1
                  ? errors.map((e) => e.message).join(". ")
                  : errors[0].message,
            };

            return new Response(JSON.stringify(responseBody), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            });
          }
        }

        try {
          // Store email from request body if it's a signup request (needed for verification email)
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
            return await customizeRateLimitResponse(response, request);
          }

          // If signup was successful, send verification email and create settings
          if (isSignupRequest && response.status === 200 && signupEmail) {
            // Get theme from cookie (same key as used in theme.ts)
            const storageKey = "_preferred-theme";
            const cookieHeader = request.headers.get("cookie") || "";
            const cookieMatch = cookieHeader.match(
              new RegExp(`(?:^|; )${storageKey}=([^;]*)`)
            );
            const themeFromCookie = cookieMatch?.[1] || "light"; // Default to "light" if no cookie

            // Create settings for the new user asynchronously (don't block the response)
            // Find user by email and create settings with theme preference
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
                // Don't throw - signup was successful, settings failure shouldn't break it
              });

            // Send verification email asynchronously (don't block the response)
            // Fire and forget - if it fails, log it but don't fail the signup
            sendVerificationEmail(signupEmail).catch((error) => {
              console.error(
                `Failed to send verification email to ${signupEmail}:`,
                error
              );
              // Don't throw - signup was successful, email failure shouldn't break it
            });
          }

          return await addCorsHeadersAndRateLimitInfo(response, request);
        } catch (error) {
          // Security: Don't leak internal error details
          console.error("Auth handler error:", error);
          const corsHeaders = getCorsHeaders(request);
          // Track request and get remaining attempts even on errors
          const rateLimitInfo = await trackRequestAndGetRemaining(request);
          const responseBody: AuthResponseBody = {
            code: "INTERNAL_ERROR",
            message: "Internal server error",
            remainingAttempts: rateLimitInfo?.remaining,
          };

          return new Response(JSON.stringify(responseBody), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          });
        }
      },
    },
  },
});
