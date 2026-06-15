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
  gramMisplaced: "🟧",
  absent: "⬛",
};

const OUT_OF_BOUNDS = "⬜";

export function buildShareGrid(feedback: LetterFeedback[][]): string {
  return feedback
    .map((row) => {
      const cells = row.map((f) => EMOJI[f]);
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
}: ShareTextParams): string {
  const result = won ? `${guessCount}/${maxGuesses}` : `X/${maxGuesses}`;
  const circle = DIFFICULTY_CIRCLE[difficulty];
  const header = `Grammble #${puzzleNumber} ${circle} ${gram.toUpperCase()} ${result}`;
  const scoreLine = `Score: ${score}/100`;
  const grid = buildShareGrid(feedback);
  return [header, scoreLine, grid].join("\n");
}
