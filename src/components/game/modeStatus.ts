import { GAME_MODES, type GameMode } from "~/utils/game/constants";
import type { ArchiveDayStatus, ArchiveModeSession } from "~/trpc/router";

type DailyLike = { gameState: { status: string } | null } | undefined;

interface BuildModeStatusesArgs {
  // On an archived board the other modes' live gameState isn't available, so the
  // fetched per-mode sessions drive their status instead of `dailies`.
  isArchive: boolean;
  // Today's per-mode sessions from the app-load context.
  dailies: Partial<Record<GameMode, DailyLike>>;
  // Per-mode session summaries for the shown date (carrying the authoritative
  // status). Drives the archive path outright; on the today path it overlays the
  // frozen `dailies` so completions made this session are not read as stale.
  archiveSessions?: Partial<Record<GameMode, ArchiveModeSession>>;
  // Live board result to override its own mode with, so a game finished (or
  // still in progress) this session reflects immediately rather than the stale
  // load-time state.
  liveMode?: GameMode;
  liveStatus?: ArchiveDayStatus;
}

// Reduces the various per-mode data sources to the shared OPEN/IN_PROGRESS/WON/
// LOST language used by the archive calendar and the mode tabs. Modes with no
// session are left absent; callers treat absent as OPEN.
export function buildModeStatuses({
  isArchive,
  dailies,
  archiveSessions,
  liveMode,
  liveStatus,
}: BuildModeStatusesArgs): Partial<Record<GameMode, ArchiveDayStatus>> {
  const map: Partial<Record<GameMode, ArchiveDayStatus>> = {};
  if (isArchive) {
    if (archiveSessions) {
      for (const m of GAME_MODES) {
        const session = archiveSessions[m];
        if (session) map[m] = session.status;
      }
    }
  } else {
    // Today: the route context `dailies` is frozen at the initial page load, so
    // a mode completed later this session still reads stale (or absent) there.
    // Use it as the base, then overlay the fresh per-mode sessions when a caller
    // supplies them (the archive dialog fetches today's scores) so today's
    // completions reflect across every mode, not just the live one.
    for (const m of GAME_MODES) {
      const gameState = dailies[m]?.gameState;
      if (gameState) map[m] = gameState.status as ArchiveDayStatus;
    }
    if (archiveSessions) {
      for (const m of GAME_MODES) {
        const session = archiveSessions[m];
        if (session) map[m] = session.status;
      }
    }
  }
  if (liveMode && liveStatus) map[liveMode] = liveStatus;
  return map;
}
