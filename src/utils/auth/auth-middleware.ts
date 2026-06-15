import { createMiddleware } from "@tanstack/react-start";

/**
 * Auth middleware that resolves the current user from the session cookie
 * via Better Auth's server-side API and passes it into context.
 */
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const { getRequestHeaders } = await import("@tanstack/react-start/server");
  const { auth } = await import("~/utils/auth/auth");
  const headers = getRequestHeaders();

  try {
    const session = await auth.api.getSession({ headers });

    return await next({
      context: {
        user: session?.user || null,
      },
    });
  } catch (error) {
    console.warn("[Auth Middleware] Failed to retrieve session:", error);
    return await next({
      context: {
        user: null,
      },
    });
  }
});
