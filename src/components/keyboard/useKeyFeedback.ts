import { useMemo } from "react";
import { useGameStore, type LetterFeedback } from "~/stores/game-store";

export type KeyFeedback = "misplaced" | "correct" | "absent";

const FEEDBACK_RANK: Record<KeyFeedback, number> = {
  correct: 3,
  misplaced: 2,
  absent: 1,
};

function normalizeFeedback(f: LetterFeedback): KeyFeedback | null {
  if (f === "misplaced" || f === "gramMisplaced") return "misplaced";
  if (f === "correct" || f === "gramCorrect") return "correct";
  if (f === "absent") return "absent";
  return null;
}

export interface KeyFeedbackResult {
  keyFeedback: Record<string, KeyFeedback>;
  gramFeedback: KeyFeedback | null;
}

export function useKeyFeedback(): KeyFeedbackResult {
  const guesses = useGameStore((s) => s.guesses);
  const feedback = useGameStore((s) => s.feedback);

  return useMemo(() => {
    const map: Record<string, KeyFeedback> = {};
    let gramFb: KeyFeedback | null = null;

    for (let i = 0; i < feedback.length; i++) {
      const guess = guesses[i] ?? "";
      const row = feedback[i] ?? [];

      for (let j = 0; j < row.length; j++) {
        const char = guess[j]?.toUpperCase();
        if (!char) continue;

        const raw = row[j];
        const norm = normalizeFeedback(raw);
        if (!norm) continue;

        if (raw === "gramCorrect" || raw === "gramMisplaced") {
          if (!gramFb || FEEDBACK_RANK[norm] > FEEDBACK_RANK[gramFb]) {
            gramFb = norm;
          }
          continue;
        }

        const existing = map[char];
        if (!existing || FEEDBACK_RANK[norm] > FEEDBACK_RANK[existing]) {
          map[char] = norm;
        }
      }
    }

    return { keyFeedback: map, gramFeedback: gramFb };
  }, [guesses, feedback]);
}
