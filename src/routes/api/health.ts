import { createFileRoute } from "@tanstack/react-router";

// Readiness probe for uptime monitors and deploy checks. Pings the two backing
// services the app cannot serve traffic without (Postgres, Redis) and reports
// 200 only when both answer. A monitor polling this catches a downed dependency
// before users do. Kept dependency-light and server-only (dynamic imports) so it
// never leaks DB/Redis clients into the client bundle.
async function checkService(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (error) {
    console.error("Health check dependency failed:", error);
    return false;
  }
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const { prismaClient } = await import("~/utils/db/prisma");
        const { redis } = await import("~/utils/db/redis");

        const [database, cache] = await Promise.all([
          checkService(() => prismaClient.$queryRaw`SELECT 1`),
          checkService(() => redis.ping()),
        ]);

        const healthy = database && cache;
        return new Response(
          JSON.stringify({
            status: healthy ? "ok" : "degraded",
            database: database ? "up" : "down",
            cache: cache ? "up" : "down",
          }),
          {
            status: healthy ? 200 : 503,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
