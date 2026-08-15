import { describe, expect, it } from "vitest";
import { decomposeScore } from "./score";
import type { LetterFeedback } from "./types";

// Breadth points credited to a specific guess row (breadth is split per guess, so read it off
// perGuess rather than the flat contributions list).
const breadthOn = (
  d: ReturnType<typeof decomposeScore>,
  guess: number
): number =>
  (d.perGuess[guess]?.items ?? [])
    .filter((c) => c.key === "breadth")
    .reduce((s, c) => s + c.points, 0);

// Stuck-effort bonus credited to a specific guess row. It is now its OWN ledger line, separate from
// breadth, so read it off the same perGuess items under the stuckEffort key.
const stuckEffortOn = (
  d: ReturnType<typeof decomposeScore>,
  guess: number
): number =>
  (d.perGuess[guess]?.items ?? [])
    .filter((c) => c.key === "stuckEffort")
    .reduce((s, c) => s + c.points, 0);

// A 3-guess win. Guess 1 (ENIJKL) plays STRONG while the field is near the endgame: it introduces
// four new letters and re-tests no dead letter. Guess 2 is the answer, so all non-opener breadth
// lands on guess 1.
const GUESSES = ["ENABCD", "ENIJKL", "ENMOPQ"];
const FEEDBACK: LetterFeedback[][] = [
  ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
  ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
  ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
];

const base = { guesses: GUESSES, feedback: FEEDBACK, won: true, wordLength: 6 };

describe("stuck-strong breadth buff", () => {
  it("does not fire without poolByGuess (prior behavior / sim / old callers)", () => {
    const d = decomposeScore(base);
    expect(breadthOn(d, 1)).toBeGreaterThan(0);
    expect(stuckEffortOn(d, 1)).toBe(0);
    expect(decomposeScore({ ...base, poolByGuess: undefined }).total).toBe(
      d.total
    );
  });

  it("credits a separate stuckEffort line for a strong guess near the endgame, leaving breadth intact", () => {
    // Only the answer and a couple of others still fit entering guess 1.
    const buffed = decomposeScore({ ...base, poolByGuess: [100, 3, 1] });
    const plain = decomposeScore(base);
    // The buff no longer inflates breadth: guess 1's breadth is unchanged.
    expect(breadthOn(buffed, 1)).toBeCloseTo(breadthOn(plain, 1), 5);
    // Instead it lands on its own stuckEffort line worth 25% of that breadth share (and under the cap).
    expect(stuckEffortOn(buffed, 1)).toBeCloseTo(breadthOn(plain, 1) * 0.25, 0);
    expect(stuckEffortOn(buffed, 1)).toBeLessThanOrEqual(3);
    expect(buffed.total).toBeGreaterThan(plain.total);
  });

  it("does not fire when the field was still wide open (pool > STUCK_POOL)", () => {
    // 50 possible answers entering guess 1: the player was mid-narrowing, not stuck.
    const wide = decomposeScore({ ...base, poolByGuess: [100, 50, 1] });
    expect(breadthOn(wide, 1)).toBeCloseTo(breadthOn(decomposeScore(base), 1), 5);
    expect(stuckEffortOn(wide, 1)).toBe(0);
  });

  it("does not fire for a wheel-spinning guess even at a small pool", () => {
    // Guess 1 here re-tests A and B, already proven dead by the opener: waste, not strong play.
    const wasteful: LetterFeedback[][] = [
      ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
    ];
    const input = {
      guesses: ["ENABCD", "ENABGH", "ENMOPQ"],
      feedback: wasteful,
      won: true,
      wordLength: 6,
    };
    const withPool = decomposeScore({ ...input, poolByGuess: [100, 3, 1] });
    const withoutPool = decomposeScore(input);
    expect(breadthOn(withPool, 1)).toBeCloseTo(breadthOn(withoutPool, 1), 5);
    expect(stuckEffortOn(withPool, 1)).toBe(0);
  });
});
