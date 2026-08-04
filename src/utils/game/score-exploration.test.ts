import { describe, expect, it } from "vitest";
import { decomposeScore } from "./score";
import type { LetterFeedback } from "./types";

const has = (
  d: ReturnType<typeof decomposeScore>,
  key: string
): boolean => d.contributions.some((c) => c.key === key);

// A 3-guess win. Guess 1 (ENIJKL) plays STRONG while the field is near the endgame: it introduces
// four new letters and re-tests no dead letter. Guess 2 is the answer.
const GUESSES = ["ENABCD", "ENIJKL", "ENMOPQ"];
const FEEDBACK: LetterFeedback[][] = [
  ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
  ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
  ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
];

const base = { guesses: GUESSES, feedback: FEEDBACK, won: true, wordLength: 6 };

describe("strong-play (exploration) relief", () => {
  it("does not fire without poolByGuess (prior behavior / sim / old callers)", () => {
    expect(has(decomposeScore(base), "exploration")).toBe(false);
  });

  it("refunds turn cost for a strong guess made near the endgame (pool <= STUCK_POOL)", () => {
    // Only the answer and a couple of others still fit entering guess 1.
    const relieved = decomposeScore({ ...base, poolByGuess: [100, 3, 1] });
    expect(has(relieved, "exploration")).toBe(true);
    // Relief can only raise the score.
    expect(relieved.total).toBeGreaterThan(decomposeScore(base).total);
  });

  it("does not fire when the field was still wide open (pool > STUCK_POOL)", () => {
    // 50 possible answers entering guess 1: the player was mid-narrowing, not stuck.
    expect(
      has(decomposeScore({ ...base, poolByGuess: [100, 50, 1] }), "exploration")
    ).toBe(false);
  });

  it("does not fire for a wheel-spinning guess even at a small pool", () => {
    // Guess 1 here re-tests A and B, already proven dead by the opener: waste, not strong play.
    const wasteful: LetterFeedback[][] = [
      ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
    ];
    const noRelief = decomposeScore({
      guesses: ["ENABCD", "ENABGH", "ENMOPQ"],
      feedback: wasteful,
      won: true,
      wordLength: 6,
      poolByGuess: [100, 3, 1],
    });
    expect(has(noRelief, "exploration")).toBe(false);
  });
});
