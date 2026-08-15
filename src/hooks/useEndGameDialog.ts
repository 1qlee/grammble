import { useEffect, useRef } from "react";
import { create } from "zustand";
import { useGameStore, type GameStatus } from "~/stores/game-store";
import type { GameMode } from "~/utils/game/constants";

const OPEN_DELAY_MS = 2000;

interface EndGameDialogState {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isAppHydrated: boolean;
  setIsAppHydrated: (hydrated: boolean) => void;
}

export const useEndGameDialogStore = create<EndGameDialogState>((set) => ({
  isOpen: false,
  setIsOpen: (open) => set({ isOpen: open }),
  isAppHydrated: false,
  setIsAppHydrated: (hydrated) => set({ isAppHydrated: hydrated }),
}));

export function useEndGameDialog() {
  const status = useGameStore((s) => s.status);
  const mode = useGameStore((s) => s.mode);
  const isOpen = useEndGameDialogStore((s) => s.isOpen);
  const setIsOpen = useEndGameDialogStore((s) => s.setIsOpen);
  const isAppHydrated = useEndGameDialogStore((s) => s.isAppHydrated);
  // Last observed mode + status, used to distinguish a real gameplay
  // completion (IN_PROGRESS -> terminal within the same mode) from a
  // hydration or mode switch that merely loads an already-finished game.
  const prevRef = useRef<{ mode: GameMode; status: GameStatus } | null>(null);

  useEffect(() => {
    if (!isAppHydrated) return;

    const prev = prevRef.current;
    prevRef.current = { mode, status };

    // First observation after hydration only sets the baseline, so reloading
    // a finished mode never auto-opens the dialog.
    if (!prev) return;
    // Switching modes is not a completion, even if the new mode is finished.
    if (prev.mode !== mode) return;
    // Auto-open only when the current mode just transitioned out of play.
    if (prev.status !== "IN_PROGRESS" || status === "IN_PROGRESS") return;

    const timeoutId = window.setTimeout(() => setIsOpen(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [mode, status, isAppHydrated, setIsOpen]);

  return { isOpen, setIsOpen };
}
