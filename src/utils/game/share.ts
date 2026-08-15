import { WORD_LENGTH } from "~/utils/game/constants";
import type { LetterFeedback } from "~/utils/game/types";

export type Difficulty = "easy" | "med" | "hard";

const DIFFICULTY_CIRCLE: Record<Difficulty, string> = {
  easy: "🟢",
  med: "🟡",
  hard: "🔴",
};

const EMOJI: Record<LetterFeedback, string> = {
  correct: "🟩",
  gramCorrect: "🟩",
  misplaced: "🟨",
  gramMisplaced: "🟨",
  absent: "⬛",
  // An offset blank tile (a column the slid word left empty): shown as the same
  // empty square as out-of-bounds padding.
  blank: "⬜",
};

// Color-blind palette: the same high-contrast orange/blue used by the board and
// keyboard, so a shared result reads the way the player saw it. Only the
// correct/misplaced squares change; absent and blank stay neutral.
const EMOJI_COLOR_BLIND: Record<LetterFeedback, string> = {
  ...EMOJI,
  correct: "🟧",
  gramCorrect: "🟧",
  misplaced: "🟦",
  gramMisplaced: "🟦",
};

const OUT_OF_BOUNDS = "⬜";

export function buildShareGrid(
  feedback: LetterFeedback[][],
  colorBlind = false,
): string {
  const emoji = colorBlind ? EMOJI_COLOR_BLIND : EMOJI;
  return feedback
    .map((row) => {
      const cells = row.map((f) => emoji[f]);
      while (cells.length < WORD_LENGTH) cells.push(OUT_OF_BOUNDS);
      return cells.join("");
    })
    .join("\n");
}

type ShareTextParams = {
  puzzleNumber: number;
  gram: string;
  guessCount: number;
  maxGuesses: number;
  won: boolean;
  feedback: LetterFeedback[][];
  difficulty: Difficulty;
  score: number;
  /** Append the emoji grid. Omit when sharing an image of the grid instead. */
  includeGrid?: boolean;
  /** Use the high-contrast orange/blue squares to match color-blind mode. */
  colorBlind?: boolean;
};

export function buildShareText({
  puzzleNumber,
  gram,
  guessCount,
  maxGuesses,
  won,
  feedback,
  difficulty,
  score,
  includeGrid = true,
  colorBlind = false,
}: ShareTextParams): string {
  const result = won ? `${guessCount}/${maxGuesses}` : `X/${maxGuesses}`;
  const circle = DIFFICULTY_CIRCLE[difficulty];
  const header = `Grammble #${puzzleNumber} ${circle} ${gram.toUpperCase()} ${result}`;
  const scoreLine = `Score: ${score}/100`;
  const lines = [header, scoreLine];
  if (includeGrid) lines.push(buildShareGrid(feedback, colorBlind));
  return lines.join("\n");
}
