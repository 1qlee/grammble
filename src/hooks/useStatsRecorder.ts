import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGameStore } from "~/stores/game-store";
import { useStatsStore } from "~/stores/stats-store";
import type { GameMode } from "~/utils/game/constants";

export function useStatsRecorder(opts: {
  isAuthed: boolean;
  puzzleNumber: number;
  mode: GameMode;
}) {
  const { isAuthed, puzzleNumber, mode } = opts;
  const status = useGameStore((s) => s.status);
  const guesses = useGameStore((s) => s.guesses);
  const score = useGameStore((s) => s.score);
  const queryClient = useQueryClient();
  const recordedRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "IN_PROGRESS") return;
    if (recordedRef.current === puzzleNumber) return;

    const guessCount =
      status === "WON" ? guesses.filter((g) => g.length > 0).length : 0;

    if (isAuthed) {
      recordedRef.current = puzzleNumber;
      queryClient.invalidateQueries({ queryKey: ["userStats", mode] });
      return;
    }

    // Anonymous stats aggregate the server-computed score from the store. Wait
    // for it before recording so a refresh-restored game (score already set) and
    // a just-finished game (score arriving with the response) both count once.
    if (score === null) return;
    recordedRef.current = puzzleNumber;

    const lastNumber = useStatsStore.getState().stats.lastPuzzleNumber;
    if (lastNumber === puzzleNumber) return;
    useStatsStore
      .getState()
      .applyTerminal(status, guessCount, puzzleNumber, score);
  }, [status, puzzleNumber, isAuthed, guesses, score, mode, queryClient]);
}
