import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "~/utils/auth/auth";

/**
 * Auth middleware using Better Auth's server-side API
 * This directly accesses session data from Redis (via secondaryStorage)
 * without making HTTP calls, avoiding rate limiting issues
 */
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  // Get request headers (includes cookies)
  const headers = getRequestHeaders();

  try {
    // Use Better Auth's server-side API to get session directly
    // This bypasses HTTP calls and rate limiting, using Redis directly via secondaryStorage
    // Better Auth's API uses the headers to extract session cookies and validate them
    console.log(
      "[Auth Middleware] Using server-side API (Redis) - no HTTP call"
    );
    const session = await auth.api.getSession({
      headers: headers,
    });

    console.log(`[Auth Middleware] Session retrieved.`);

    return await next({
      context: {
        user: session?.user || null,
      },
    });
  } catch (error) {
    // If session retrieval fails, continue without user (unauthenticated)
    console.warn("[Auth Middleware] Failed to retrieve session:", error);
    return await next({
      context: {
        user: null,
      },
    });
  }
});
