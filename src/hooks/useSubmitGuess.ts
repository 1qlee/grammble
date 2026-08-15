import { useCallback } from "react";
import { useGameStore, type GameStatus } from "~/stores/game-store";
import { submitGuessServerFn } from "~/utils/trpc/server-caller";
import { patchDailiesCacheGameState } from "~/utils/game/dailies-cache";
import {
  GUESS_MIN_LENGTH_BY_MODE,
  GUESS_MAX_LENGTH_BY_MODE,
  MAX_GUESSES,
} from "~/utils/game/constants";
import { parseGuess } from "~/utils/game/guess-placement";
import { pickMessage } from "~/utils/game/end-game-messages.constants";
import { SUBMIT_MIN_VISIBLE_MS } from "~/components/guesses/tileAnimations.constants";

export function useSubmitGuess() {
  const submit = useCallback(async () => {
    const state = useGameStore.getState();
    const {
      guesses,
      currentGuessIndex,
      gram,
      mode,
      wordLength,
      date,
      isArchive,
      status,
      loading,
      setLoading,
      setToast,
      setGuess,
      submitGuess,
    } = state;

    if (loading) return;
    if (status !== "IN_PROGRESS") return;

    const minLen = GUESS_MIN_LENGTH_BY_MODE[mode];
    const maxLen = GUESS_MAX_LENGTH_BY_MODE[mode];

    // A row may be placed shorter than the board and slid over, carrying leading
    // blank tiles. Parse that placement: `word` is validated, `guess` is the
    // canonical spaced string sent to (and echoed by) the server.
    const parsed = parseGuess(guesses[currentGuessIndex] ?? "", wordLength);
    if (!parsed.ok) {
      setToast(
        parsed.reason === "noncontiguous"
          ? {
              type: "warning",
              message: "Letters must be connected, with blanks only on the ends.",
              shake: true,
            }
          : { type: "error", message: `Guess must be ${minLen}-${maxLen} letters.` },
      );
      return;
    }
    const { spaced: guess, word } = parsed.value;

    if (word.length < minLen || word.length > maxLen) {
      setToast({
        type: "error",
        message: `Guess must be ${minLen}-${maxLen} letters.`,
      });
      return;
    }

    if (gram && !word.includes(gram)) {
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

    // Canonicalize the live row to the parsed placement (trailing blanks
    // trimmed, letters uppercased) so the committed row renders exactly what the
    // server scored.
    setGuess(guess);

    setToast(null);
    setLoading(true);
    const startedAt = Date.now();
    try {
      const result = await submitGuessServerFn({
        data: { mode, guess, history: committed, date, archive: isArchive },
      });

      // Keep the scaled-down submitting state on screen long enough for the tile
      // animation to play through even when the server responds near-instantly.
      const elapsed = Date.now() - startedAt;
      if (elapsed < SUBMIT_MIN_VISIBLE_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, SUBMIT_MIN_VISIBLE_MS - elapsed),
        );
      }

      if (!result.ok) {
        setToast({ type: "error", message: result.error });
        return;
      }
      submitGuess(
        result.feedback,
        result.status as GameStatus,
        result.word,
        result.score,
      );

      // Keep the per-tab dailies cache in sync with the live game so switching
      // to another mode and back reflects this guess (and the per-mode score in
      // the mode tabs) instead of the state captured when the cache was filled.
      // Archive replays never feed the daily cache.
      if (!isArchive) {
        const next = useGameStore.getState();
        patchDailiesCacheGameState(date, mode, {
          guesses: next.guesses
            .slice(0, next.currentGuessIndex)
            .map((g) => g.toUpperCase()),
          feedback: next.feedback,
          status: next.status,
          attemptsRemaining: MAX_GUESSES - next.currentGuessIndex,
          word: next.revealedWord,
          score: next.score,
        });
      }

      // On completion, surface the flavor headline as a toast: green on a win,
      // yellow on a loss. Seed off the date so the message stays deterministic.
      const finalStatus = result.status as GameStatus;
      if (finalStatus === "WON" || finalStatus === "LOST") {
        const won = finalStatus === "WON";
        const guessCount = won ? currentGuessIndex + 1 : MAX_GUESSES;
        const seed = Number(date.replaceAll("-", "")) || 0;
        setToast({
          type: won ? "success" : "warning",
          message: pickMessage(won, guessCount, seed),
        });
      }
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
