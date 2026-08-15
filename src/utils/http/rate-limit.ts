import { redis } from "~/utils/db/redis";

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets. Only meaningful when `allowed` is false. */
  retryAfter: number;
}

/**
 * Fixed-window rate limiter backed by Redis. Increments a counter for `key` and
 * rejects once it exceeds `limit` within `windowSeconds`. Used to throttle
 * unauthenticated server functions (e.g. verification-email sends) that Better
 * Auth's own rate limiting does not cover.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;

  try {
    const count = await redis.incr(redisKey);
    // Set the TTL only on the first hit so the window is fixed from that point.
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }

    if (count > limit) {
      const ttl = await redis.ttl(redisKey);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : windowSeconds };
    }

    return { allowed: true, retryAfter: 0 };
  } catch (err) {
    // Fail open on Redis errors: a throttling backend outage must not take down
    // the endpoints it guards. The error is logged so the outage is visible.
    console.error(`[RateLimit] Redis error for key ${key}:`, err);
    return { allowed: true, retryAfter: 0 };
  }
}
