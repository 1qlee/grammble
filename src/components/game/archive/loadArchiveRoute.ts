import { redirect } from "@tanstack/react-router";
import { queryClient } from "~/utils/query-client";
import { archivePuzzleQueryOptions } from "./archiveQueries";
import { getDateString } from "~/utils/game/daily-puzzle";
import { MODE_ROUTE_BY_MODE, type GameMode } from "~/utils/game/constants";
import type { User } from "~/prisma-generated/browser";
import type { DailyModeData } from "~/trpc/router";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Gate the `/{mode}/{date}` archive routes from `beforeLoad`, so the redirect
// short-circuits before the SSR render stream opens. Throwing redirects from a
// loader during streaming triggers a "Controller is already closed" race in
// TanStack's SSR transform, so the cheap structural checks (date shape,
// not-future) live here instead. A malformed/future date falls back to the
// mode's bare today route. Premium gating is intentionally NOT done here:
// non-premium users are allowed onto the route so the loader can withhold the
// puzzle (returns null), which surfaces the subscription dialog in-place.
export function assertArchiveAccess(mode: GameMode, date: string): void {
  if (!DATE_RE.test(date) || date > getDateString()) {
    throw redirect({ to: MODE_ROUTE_BY_MODE[mode] });
  }
}

// Fetch the past puzzle (plus the user's prior session) for the board. For
// non-premium users we return null instead of loading: GameModeView opens the
// subscription upsell when data is null. A throw means a genuinely missing
// puzzle for that date; fall back to today rather than crash the route.
export async function loadArchivePuzzle(
  mode: GameMode,
  date: string,
  user: User | undefined,
): Promise<DailyModeData | null> {
  if (!user?.isPremium) return null;
  try {
    // Reads through the shared cache: a hover/selection prefetch in the archive
    // dialog makes this resolve instantly instead of refetching on navigation.
    return await queryClient.ensureQueryData(
      archivePuzzleQueryOptions(mode, date),
    );
  } catch (err) {
    console.error("getArchivePuzzle failed:", err);
    throw redirect({ to: MODE_ROUTE_BY_MODE[mode] });
  }
}
