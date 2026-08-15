import {
  getArchiveServerFn,
  getArchivePuzzleServerFn,
  getArchiveDayScoresServerFn,
} from "~/utils/trpc/server-caller";
import type { GameMode } from "~/utils/game/constants";

// Shared so the active month and any prefetched months resolve to the exact
// same cache entry. Month data is immutable apart from the user's own WON/LOST
// status, which is refreshed by invalidating ["archive", mode] when an archive
// replay finishes (see useStatsRecorder).
export function archiveMonthQueryOptions(
  mode: GameMode,
  year: number,
  month: number,
) {
  return {
    queryKey: ["archive", mode, year, month] as const,
    queryFn: () => getArchiveServerFn({ data: { mode, year, month } }),
    staleTime: Infinity,
    // Override the app-wide refetchOnMount:false so an invalidated month
    // refetches the next time the dialog opens onto it.
    refetchOnMount: true,
  };
}

// Per-mode terminal scores for a single date, feeding the archive header tabs.
// Keyed by date alone (not mode) since it spans every mode. Invalidated with the
// other archive caches when a game completes (see useStatsRecorder).
export function archiveDayScoresQueryOptions(date: string) {
  return {
    queryKey: ["archiveDayScores", date] as const,
    queryFn: () => getArchiveDayScoresServerFn({ data: { date } }),
    staleTime: Infinity,
    refetchOnMount: true,
  };
}

// The replay payload carries the user's mutable session (guesses/status), so it
// is invalidated per mode when an archive game completes (see useStatsRecorder).
// The route loader reads through this cache via ensureQueryData, so a hover- or
// selection-driven prefetch makes the Play click load the board instantly.
export function archivePuzzleQueryOptions(mode: GameMode, date: string) {
  return {
    queryKey: ["archivePuzzle", mode, date] as const,
    queryFn: () => getArchivePuzzleServerFn({ data: { mode, date } }),
    staleTime: Infinity,
  };
}
