import { useGameStore } from "~/stores/game-store";
import { useStatsStore } from "~/stores/stats-store";

/**
 * Wipes anonymous localStorage (grammble-game, grammble-stats) and resets the
 * in-memory stores. Called on sign-in, after the anonymous session has been
 * synced to the account, and on sign-out, so one user's local data never leaks
 * into another session on a shared device.
 *
 * Note: this discards the anonymous stats history. Signed-in users read stats
 * from the server, so the local grammble-stats aggregate is not migrated; only
 * the current day's game session is synced to the account on sign-in.
 */
export function clearAnonymousStorage() {
  if (typeof window === "undefined") return;

  useGameStore.persist.clearStorage();
  useStatsStore.persist.clearStorage();
  useGameStore.getState().resetSession();
  useStatsStore.getState().reset();
}
