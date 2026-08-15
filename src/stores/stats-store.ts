import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  EMPTY_STATS,
  applyTerminalToStats,
  type Stats,
} from "~/utils/game/stats";

interface StatsState {
  stats: Stats;
  applyTerminal: (
    outcome: "WON" | "LOST",
    guessCount: number,
    puzzleNumber: number,
    score: number,
  ) => void;
  reset: () => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      stats: EMPTY_STATS,
      applyTerminal: (outcome, guessCount, puzzleNumber, score) =>
        set((state) => ({
          stats: applyTerminalToStats(
            state.stats,
            outcome,
            guessCount,
            puzzleNumber,
            score,
          ),
        })),
      reset: () => set({ stats: EMPTY_STATS }),
    }),
    {
      name: "grammble-stats",
      partialize: (state) => ({ stats: state.stats }),
    },
  ),
);
