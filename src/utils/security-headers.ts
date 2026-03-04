/**
 * Security Headers Utility
 * Provides security headers to protect against common web vulnerabilities
 */

/**
 * Get security headers for responses
 * Implements high-priority security headers:
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-Frame-Options: Prevents clickjacking attacks
 * - Referrer-Policy: Controls referrer information leakage
 * - Strict-Transport-Security (HSTS): Forces HTTPS (production only)
 */
export function getSecurityHeaders(request?: Request): Record<string, string> {
  const headers: Record<string, string> = {
    // Prevents browsers from MIME-sniffing responses
    // Forces browser to respect the declared Content-Type
    "X-Content-Type-Options": "nosniff",

    // Prevents clickjacking by blocking iframe embedding
    // DENY: Never allow framing (most secure)
    // SAMEORIGIN: Allow framing from same origin only (more flexible)
    "X-Frame-Options": "DENY",

    // Controls how much referrer information is sent
    // strict-origin-when-cross-origin: Send full URL for same-origin, only origin for cross-origin
    // This prevents leaking sensitive URLs while maintaining functionality
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };

  // HSTS: Only add in production and when using HTTPS
  if (
    process.env.NODE_ENV === "production" &&
    request &&
    request.url.startsWith("https://")
  ) {
    // Strict-Transport-Security: Force HTTPS for 1 year, include subdomains
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  }

  return headers;
}

/**
 * Add security headers to a response
 * Returns a new Response with security headers added
 */
export function addSecurityHeaders(response: Response): Response {
  const securityHeaders = getSecurityHeaders();

  // Create new headers object
  const newHeaders = new Headers(response.headers);

  // Add security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  // Return new response with security headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Get security headers as a plain object
 * Useful for creating new responses with security headers
 */
export function getSecurityHeadersObject(): Record<string, string> {
  return getSecurityHeaders();
}
