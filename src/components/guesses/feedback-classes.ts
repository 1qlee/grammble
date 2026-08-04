import type { LetterFeedback } from "~/stores/game-store";

export const FEEDBACK_CLASSES: Record<LetterFeedback, string> = {
  correct: "tile-correct",
  gramCorrect: "tile-correct",
  misplaced: "tile-misplaced",
  gramMisplaced: "tile-misplaced",
  absent: "tile-absent",
  // Offset blank tile: no color. Committed rows render these as empty wells in
  // GuessRow, so this only guards exhaustiveness.
  blank: "",
};
