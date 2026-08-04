import type { DailyModeData } from "~/trpc/router";
import type { GameMode } from "./constants";

type DailiesMap = Partial<Record<GameMode, DailyModeData>>;

// Per-tab cache of today's puzzle data for every entitled mode. `getAllDaily`
// already returns all three modes in one shot, so once it has run we can reuse
// the result when switching modes instead of re-running it on every navigation
// (root `beforeLoad` otherwise refetches it each time). Keyed by puzzle date so
// it self-invalidates at the daily rollover, and tagged with the user id so a
// different signed-in user in the same tab never reads the previous user's
// game state.
//
// Client-only: on the server this module instance is shared across all requests,
// so caching per-user data there would leak between requests. Every accessor
// short-circuits when `window` is undefined, leaving the server to always fetch
// fresh.
let cache: { date: string; userId: string | null; data: DailiesMap } | null =
  null;

export function readDailiesCache(date: string) {
  if (typeof window === "undefined") return null;
  if (!cache || cache.date !== date) return null;
  return cache;
}

export function writeDailiesCache(
  date: string,
  userId: string | null,
  data: DailiesMap,
): void {
  if (typeof window === "undefined") return;
  cache = { date, userId, data };
}

// Folds a freshly submitted guess into the cached mode so switching away and
// back reflects live progress (the seed in GameBoard reads this via context),
// instead of the stale state captured when the cache was first populated.
export function patchDailiesCacheGameState(
  date: string,
  mode: GameMode,
  gameState: NonNullable<DailyModeData["gameState"]>,
): void {
  if (typeof window === "undefined") return;
  if (!cache || cache.date !== date) return;
  const entry = cache.data[mode];
  if (!entry) return;
  cache.data = { ...cache.data, [mode]: { ...entry, gameState } };
}
