import { useCallback } from "react";
import { useGameStore, type GameStatus } from "~/stores/game-store";
import { submitGuessServerFn } from "~/utils/trpc/server-caller";
import {
  GUESS_MIN_LENGTH_BY_MODE,
  GUESS_MAX_LENGTH_BY_MODE,
} from "~/utils/game/constants";

export function useSubmitGuess() {
  const submit = useCallback(async () => {
    const state = useGameStore.getState();
    const {
      guesses,
      currentGuessIndex,
      gram,
      mode,
      status,
      loading,
      setLoading,
      setToast,
      submitGuess,
    } = state;

    if (loading) return;
    if (status !== "IN_PROGRESS") return;

    const guess = (guesses[currentGuessIndex] ?? "").toUpperCase();
    const minLen = GUESS_MIN_LENGTH_BY_MODE[mode];
    const maxLen = GUESS_MAX_LENGTH_BY_MODE[mode];

    if (guess.length < minLen || guess.length > maxLen) {
      setToast({
        type: "error",
        message: `Guess must be ${minLen}-${maxLen} letters.`,
      });
      return;
    }

    if (gram && !guess.includes(gram)) {
      setToast({
        type: "error",
        message: `Guess must contain the gram "${gram}".`,
      });
      return;
    }

    const committed = guesses.slice(0, currentGuessIndex);
    if (committed.includes(guess)) {
      setToast({ type: "warning", message: "Already guessed that word." });
      return;
    }

    setToast(null);
    setLoading(true);
    try {
      const result = await submitGuessServerFn({
        data: { mode, guess, history: committed },
      });
      submitGuess(
        result.feedback,
        result.status as GameStatus,
        result.word,
        result.score,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit guess.";
      console.error("submitGuess failed:", err);
      setToast({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit };
}
