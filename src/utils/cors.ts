/**
 * CORS (Cross-Origin Resource Sharing) utility
 * Handles origin validation and CORS header generation
 */

/**
 * Allowed origins for CORS requests
 * Add your production domains and development origins here
 */
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];

  // Development origins
  if (process.env.NODE_ENV === "development") {
    origins.push(
      "http://localhost:3000",
      "http://localhost:5173", // Vite default
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173"
    );
  }

  // Production origins - add your actual production domains
  const productionOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
  origins.push(...productionOrigins.map((origin) => origin.trim()));

  // Default production origin if not specified
  if (process.env.NODE_ENV === "production" && origins.length === 0) {
    origins.push("https://grammble.com", "https://www.grammble.com");
  }

  return origins;
};

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
}

/**
 * Get the allowed origin for CORS response
 * Returns the origin if allowed, or null if not allowed
 */
export function getAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");

  // If no origin header, it's a same-origin request (no CORS needed)
  if (!origin) {
    return null;
  }

  // Check if origin is allowed
  if (isOriginAllowed(origin)) {
    return origin;
  }

  // Origin not allowed
  return null;
}

/**
 * Generate CORS headers for a response
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = getAllowedOrigin(request);
  const headers: Record<string, string> = {};

  // If origin is allowed, set CORS headers
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

/**
 * Generate CORS headers for preflight (OPTIONS) requests
 */
export function getCorsPreflightHeaders(
  request: Request
): Record<string, string> {
  const origin = getAllowedOrigin(request);
  const headers: Record<string, string> = {};

  if (origin) {
    // Get requested method and headers from preflight request
    const requestedMethod =
      request.headers.get("Access-Control-Request-Method") || "GET, POST";
    const requestedHeaders =
      request.headers.get("Access-Control-Request-Headers") ||
      "Content-Type, Authorization";

    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = requestedHeaders;
    headers["Access-Control-Max-Age"] = "86400"; // Cache preflight for 24 hours
  }

  return headers;
}

/**
 * Create a CORS error response for disallowed origins
 * Note: Security headers should be added by the caller if needed
 * This function only returns CORS-related error, security headers
 * are added in the route handler to avoid circular dependencies
 */
export function createCorsErrorResponse(): Response {
  return new Response(
    JSON.stringify({
      code: "CORS_ERROR",
      message: "Origin not allowed",
    }),
    {
      status: 403,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
