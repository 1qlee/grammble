/**
 * Simple Rate Limit Tracker
 * Tracks request attempts independently for frontend display purposes
 * Uses simple Redis key format: rate-limit:{path}:{ip}
 */
import { redis } from "./redis";

/**
 * Get client IP from request
 */
function getClientIP(request: Request): string {
  // Try X-Forwarded-For (for proxies/load balancers)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    const firstIP = ips[0];
    if (firstIP && firstIP !== "unknown") {
      return firstIP;
    }
  }

  // Try X-Real-IP (alternative proxy header)
  const realIP = request.headers.get("x-real-ip");
  if (realIP && realIP !== "unknown") {
    return realIP;
  }

  // Try CF-Connecting-IP (Cloudflare)
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP && cfIP !== "unknown") {
    return cfIP;
  }

  // Fallback: Use a combination of headers to create a stable identifier
  const userAgent = request.headers.get("user-agent") || "unknown";
  const acceptLanguage = request.headers.get("accept-language") || "";
  const acceptEncoding = request.headers.get("accept-encoding") || "";
  const fallbackId = `${userAgent.slice(0, 20)}-${acceptLanguage.slice(0, 10)}-${acceptEncoding.slice(0, 10)}`;
  return `fallback:${fallbackId}`;
}

/**
 * Normalize path to match better-auth's format
 * Strips /api/auth prefix if present
 */
function normalizePath(path: string): string {
  if (path.startsWith("/api/auth")) {
    return path.slice("/api/auth".length) || "/";
  }
  return path;
}

/**
 * Get rate limit rule for a path
 * Matches better-auth's rate limit rules
 */
function getRateLimitRule(path: string): { window: number; max: number } {
  if (path.includes("/sign-in/email") || path.includes("/signin")) {
    return { window: 10 * 60, max: 5 }; // 5 per 10 minutes
  }
  if (path.includes("/sign-up/email") || path.includes("/signup")) {
    return { window: 10 * 60, max: 5 }; // 5 per 10 minutes
  }
  if (
    path.includes("/forgot-password") ||
    path.includes("/reset-password") ||
    path.includes("/password-reset")
  ) {
    return { window: 10 * 60, max: 5 }; // 5 per 10 minutes
  }
  if (path.includes("/verify-email") || path.includes("/email-verification")) {
    return { window: 60 * 60, max: 10 }; // 10 per hour
  }

  // Default: 20 per minute
  return { window: 60, max: 20 };
}

/**
 * Track a request and return remaining attempts
 * Increments the counter atomically and returns remaining attempts
 */
export async function trackRequestAndGetRemaining(request: Request): Promise<{
  remaining: number;
  limit: number;
  reset: number; // Unix timestamp
} | null> {
  try {
    const url = new URL(request.url);
    const fullPath = url.pathname;
    const normalizedPath = normalizePath(fullPath);
    const ip = getClientIP(request);
    const rule = getRateLimitRule(normalizedPath);

    // Skip if IP is unknown (can't track reliably)
    if (ip === "unknown") {
      return null;
    }

    // Create Redis key: rate-limit:{path}:{ip}
    const key = `rate-limit:${normalizedPath}:${ip}`;

    // Atomically increment the counter
    // INCR returns the new count after incrementing
    const count = await redis.incr(key);

    // Set expiration on first request (when count is 1)
    // This ensures the key expires after the window
    if (count === 1) {
      await redis.expire(key, rule.window);
    }

    // Get the actual TTL to calculate accurate reset time
    // TTL returns seconds until expiration, or -1 if no expiration, or -2 if key doesn't exist
    const ttl = await redis.ttl(key);
    const reset =
      ttl > 0
        ? Math.floor(Date.now() / 1000) + ttl
        : Math.floor(Date.now() / 1000) + rule.window; // Fallback if TTL unavailable

    // Calculate remaining attempts
    const remaining = Math.max(0, rule.max - count);

    return {
      remaining,
      limit: rule.max,
      reset,
    };
  } catch (error) {
    // If Redis fails, don't block the request
    console.error("Error tracking rate limit:", error);
    return null;
  }
}
