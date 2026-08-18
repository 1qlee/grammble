import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGameStore, type GameStatus } from "~/stores/game-store";
import { useStatsStore } from "~/stores/stats-store";
import {
  EMPTY_STATS,
  applyTerminalToStats,
  applyArchiveToStats,
  type Stats,
} from "~/utils/game/stats";
import type { GameMode } from "~/utils/game/constants";

export function useStatsRecorder(opts: {
  isAuthed: boolean;
  puzzleNumber: number;
  mode: GameMode;
  isArchive?: boolean;
  // Authoritative pre-game lifetime stats for this mode, loaded with the route.
  // Used as the optimistic-fold baseline so the fold reconciles against the real
  // lifetime totals even before the end-game dialog has seeded the query cache.
  initialStats?: Stats;
}) {
  const {
    isAuthed,
    puzzleNumber,
    mode,
    isArchive = false,
    initialStats,
  } = opts;
  const status = useGameStore((s) => s.status);
  const guesses = useGameStore((s) => s.guesses);
  const score = useGameStore((s) => s.score);
  const queryClient = useQueryClient();
  const recordedRef = useRef<number | null>(null);
  // Last observed status, used to tell a real completion this session
  // (IN_PROGRESS -> terminal) from loading an already-finished game, which must
  // not re-fold an archive replay into stats it already counts server-side.
  const prevStatusRef = useRef<GameStatus | null>(null);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === "IN_PROGRESS") return;
    // Archive replays persist per-puzzle WON/LOST (calendar) and fold into
    // lifetime totals -- everything except the streak (see applyArchiveToStats).
    if (isArchive) {
      if (
        recordedRef.current !== puzzleNumber &&
        (status === "WON" || status === "LOST")
      ) {
        recordedRef.current = puzzleNumber;
        // Refresh the calendar badges/solved count and the replay payload so a
        // revisit reflects the completed game instead of the cached pre-play one.
        queryClient.invalidateQueries({ queryKey: ["archive", mode] });
        queryClient.invalidateQueries({ queryKey: ["archivePuzzle", mode] });
        queryClient.invalidateQueries({ queryKey: ["archiveDayScores"] });
      }

      // Fold into lifetime stats only on a genuine completion this session, not
      // when landing on an already-finished replay (which the server already
      // counted). Mirror the server optimistically so the end-game dialog moves
      // at once, then invalidate to reconcile with the authoritative value.
      const justCompleted =
        prevStatus === "IN_PROGRESS" &&
        (status === "WON" || status === "LOST");
      if (justCompleted && isAuthed && score !== null) {
        const guessCount =
          status === "WON" ? guesses.filter((g) => g.length > 0).length : 0;
        queryClient.setQueryData<Stats>(["userStats", mode], (prev) =>
          applyArchiveToStats(
            prev ?? initialStats ?? EMPTY_STATS,
            status,
            guessCount,
            score,
          ),
        );
        queryClient.invalidateQueries({ queryKey: ["userStats", mode] });
      }
      return;
    }
    if (recordedRef.current === puzzleNumber) return;

    const guessCount =
      status === "WON" ? guesses.filter((g) => g.length > 0).length : 0;

    // Today's daily result also lives in the archive calendar (the cell for
    // today's date). Refresh the cached calendar and replay payload so reopening
    // the archive reflects the completed game without a hard refresh.
    const refreshArchive = () => {
      queryClient.invalidateQueries({ queryKey: ["archive", mode] });
      queryClient.invalidateQueries({ queryKey: ["archivePuzzle", mode] });
      queryClient.invalidateQueries({ queryKey: ["archiveDayScores"] });
    };

    if (isAuthed) {
      recordedRef.current = puzzleNumber;
      refreshArchive();
      // Optimistically fold the just-finished game into the cached stats with
      // the same reducer the server runs, so the dialog updates instantly
      // instead of waiting on (or silently keeping stale data after a failed)
      // refetch. Idempotent on lastPuzzleNumber, so it reconciles cleanly.
      // Skip when the score hasn't arrived yet (e.g. mid-hydration); the
      // invalidate below still refreshes from the server in that case.
      if (score !== null) {
        queryClient.setQueryData<Stats>(["userStats", mode], (prev) =>
          applyTerminalToStats(
            prev ?? initialStats ?? EMPTY_STATS,
            status,
            guessCount,
            puzzleNumber,
            score,
          ),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["userStats", mode] });
      return;
    }

    // Anonymous stats aggregate the server-computed score from the store. Wait
    // for it before recording so a refresh-restored game (score already set) and
    // a just-finished game (score arriving with the response) both count once.
    if (score === null) return;
    recordedRef.current = puzzleNumber;
    refreshArchive();

    const lastNumber = useStatsStore.getState().stats.lastPuzzleNumber;
    if (lastNumber === puzzleNumber) return;
    useStatsStore
      .getState()
      .applyTerminal(status, guessCount, puzzleNumber, score);
  }, [status, puzzleNumber, isAuthed, guesses, score, mode, isArchive, initialStats, queryClient]);
}
