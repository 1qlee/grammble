import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { syncAnonymousSessionServerFn } from "~/utils/trpc/server-caller";
import { clearAnonymousStorage } from "~/utils/storage/clear-anonymous-storage";
import {
  DEFAULT_GAME_MODE,
  GAME_MODES,
  type GameMode,
} from "~/utils/game/constants";

const STORAGE_KEY = "grammble-game";

interface PersistedState {
  state?: {
    date?: string;
    mode?: GameMode;
    guesses?: string[];
    currentGuessIndex?: number;
  };
}

export function useAnonymousSessionSync(userId: string | undefined | null) {
  const router = useRouter();
  const ranForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (ranForUserRef.current === userId) return;
    ranForUserRef.current = userId;

    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    let parsed: PersistedState | null = null;
    try {
      parsed = JSON.parse(raw) as PersistedState;
    } catch (err) {
      console.error("Failed to parse persisted game state:", err);
      clearAnonymousStorage();
      return;
    }

    const persistedDate = parsed?.state?.date;
    const persistedMode = parsed?.state?.mode;
    const mode: GameMode =
      persistedMode && GAME_MODES.includes(persistedMode)
        ? persistedMode
        : DEFAULT_GAME_MODE;
    const allGuesses = parsed?.state?.guesses ?? [];
    const currentGuessIndex = parsed?.state?.currentGuessIndex ?? 0;
    // Only include committed guesses; the entry at currentGuessIndex is the
    // in-progress typing buffer and may be incomplete.
    const guesses = allGuesses.slice(0, currentGuessIndex);
    const today = new Date().toISOString().slice(0, 10);

    const shouldSync =
      persistedDate === today && guesses.length > 0;

    const finish = () => {
      clearAnonymousStorage();
      router.invalidate();
    };

    if (!shouldSync) {
      finish();
      return;
    }

    // Sync against the mode the local session was actually played in. A
    // logged-in user can complete any mode (7/8 are premium), and all modes
    // share the same localStorage key, so hardcoding SIX rejects 7/8-letter
    // guesses with "Guess must be 4-6 letters."
    syncAnonymousSessionServerFn({ data: { mode, guesses } })
      .catch((err: unknown) => {
        console.error("Failed to sync anonymous session:", err);
      })
      .finally(finish);
  }, [userId, router]);
}
