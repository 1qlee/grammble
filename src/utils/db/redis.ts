import Redis from "ioredis";
import { devLog } from "../log";

// Initialize Redis client for Better Auth secondaryStorage
const redisUrl =
  process.env.REDIS_URL ||
  `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}${process.env.REDIS_PASSWORD ? `?password=${process.env.REDIS_PASSWORD}` : ""}`;

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

redis.on("connect", () => {
  devLog("Connected to Redis");
});
