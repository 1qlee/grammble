import { describe, expect, it } from "vitest";
import { decomposeScore } from "./score";
import type { LetterFeedback } from "./types";

const on = (
  d: ReturnType<typeof decomposeScore>,
  key: string,
  guess: number
): number =>
  (d.perGuess[guess]?.items ?? [])
    .filter((c) => c.key === key)
    .reduce((s, c) => s + c.points, 0);

// gram EN, 6-letter game. Guess 1 (ENJKL) is FIVE letters -- one short. The direct short-guess
// penalty should charge it. Guess 2 is the full-length answer.
const GUESSES = ["ENABCD", "ENJKL", "ENMOPQ"];
const FEEDBACK: LetterFeedback[][] = [
  ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
  ["gramCorrect", "gramCorrect", "absent", "absent", "absent"],
  ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
];

const base = { guesses: GUESSES, feedback: FEEDBACK, won: true, wordLength: 6 };

describe("direct short-guess penalty", () => {
  it("charges a short non-opener guess even when it tested new letters", () => {
    const d = decomposeScore(base);
    // One letter short at the breadth-mirror weight (PT * 0.04 = 48 * 0.04 = 1.92), applied as a
    // negative: the missing slot forgoes exactly the breadth a full-length slot could have gathered.
    expect(on(d, "shortGuess", 1)).toBeCloseTo(-1.92, 1);
  });

  it("does not charge the opener (its length is graded into the frame)", () => {
    // A short opener: two letters short, but exempt from this penalty.
    const shortOpener = {
      guesses: ["ENJK", "ENMOPQ"],
      feedback: [
        ["gramCorrect", "gramCorrect", "absent", "absent"],
        ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
      ] as LetterFeedback[][],
      won: true,
      wordLength: 6,
    };
    const d = decomposeScore(shortOpener);
    expect(on(d, "shortGuess", 0)).toBe(0);
  });

  it("does not charge a full-length guess", () => {
    const full = {
      guesses: ["ENABCD", "ENJKLM", "ENMOPQ"],
      feedback: [
        ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
        ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
        ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
      ] as LetterFeedback[][],
      won: true,
      wordLength: 6,
    };
    const d = decomposeScore(full);
    expect(on(d, "shortGuess", 1)).toBe(0);
  });
});
