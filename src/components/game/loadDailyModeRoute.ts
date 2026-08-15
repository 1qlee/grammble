import type { DailyModeData } from "~/trpc/router";
import type { GameMode } from "~/utils/game/constants";
import type { User } from "~/prisma-generated/browser";
import { getInitialAppDataServerFn } from "~/utils/trpc/server-caller";
import { getDateString } from "~/utils/game/daily-puzzle";
import { readDailiesCache, writeDailiesCache } from "~/utils/game/dailies-cache";

interface GameRouteContext {
  user: User | undefined;
  dailies: Partial<Record<GameMode, DailyModeData>>;
}

// Root `beforeLoad` fetches every entitled mode's daily once and stashes it on
// the router context. But the root match is params-less, so TanStack reuses it
// across child navigations and never re-runs its `beforeLoad`: the `dailies` it
// resolved on the INITIAL page load are reused verbatim for every later client
// navigation. When that initial load was a non-game path (an archive route, or
// /signin), `dailies` is empty, so navigating client-side to a mode route would
// read `dailies[mode]` as undefined and (wrongly) surface the premium upsell
// even for entitled users.
//
// This loader closes that gap: it runs on the mode route's own (fresh) match, so
// it fires on every navigation into a mode. It prefers the already-resolved
// context, falls back to the per-tab cache, and only pays for a fetch when
// neither has the mode. On a normal game-path initial load the context already
// holds the mode, so this returns immediately with no extra request.
export async function ensureDailyForMode(
  mode: GameMode,
  context: GameRouteContext,
): Promise<DailyModeData | null> {
  const fromContext = context.dailies?.[mode];
  if (fromContext) return fromContext;

  // Non-premium users are not entitled to the 7/8-letter modes, so there is no
  // puzzle to fetch. Returning null lets GameModeView surface the upsell.
  if (mode !== "SIX" && !context.user?.isPremium) return null;

  const date = getDateString();
  const userId = context.user?.id ?? null;

  const cached = readDailiesCache(date);
  if (cached && cached.userId === userId && cached.data[mode]) {
    return cached.data[mode] ?? null;
  }

  const { dailies } = await getInitialAppDataServerFn({
    data: { needsDailies: true },
  });
  writeDailiesCache(date, userId, dailies);
  return dailies[mode] ?? null;
}
