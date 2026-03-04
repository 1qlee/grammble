/**
 * TanStack Start Configuration
 * Sets up global middleware for security headers (production only)
 *
 * Based on: https://github.com/TanStack/router/discussions/3028
 */
import { createStart } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/react-start";
import {
  getResponseHeaders,
  setResponseHeaders,
} from "@tanstack/react-start/server";
import { getSecurityHeaders } from "./src/utils/security-headers";

/**
 * Global security headers middleware
 * Applies security headers to all responses in production only
 */
const securityHeadersMiddleware = createMiddleware().server(
  ({ next, context, request }) => {
    // Only apply security headers in production
    if (process.env.NODE_ENV === "production") {
      const headers = getResponseHeaders();
      const securityHeaders = getSecurityHeaders(request);

      // Add security headers to response
      Object.entries(securityHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      setResponseHeaders(headers);
    }

    return next({ context });
  }
);

/**
 * Create and export the start instance with global middleware
 */
export const startInstance = createStart(() => {
  return {
    requestMiddleware: [securityHeadersMiddleware],
  };
});
