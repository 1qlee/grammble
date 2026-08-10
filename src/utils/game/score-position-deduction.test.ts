import { describe, expect, it } from "vitest";
import { decomposeScore } from "./score";
import type { LetterFeedback } from "./types";

// Points for a contribution key credited to a specific guess row.
const on = (
  d: ReturnType<typeof decomposeScore>,
  key: string,
  guess: number
): number =>
  (d.perGuess[guess]?.items ?? [])
    .filter((c) => c.key === key)
    .reduce((s, c) => s + c.points, 0);

// gram EN, 6-letter answer. S is discovered yellow at pos 2 on guess 1, then replayed at a fresh
// slot (pos 3) on guess 2 and still yellow: one wrong letter-position ruled out. Guess 2's other
// letters (J, K, L) are all new, so the guess wastes nothing. Guess 3 is the answer.
const GUESSES = ["ENABCD", "ENSXYZ", "ENJSKL", "ENSOLD"];
const FEEDBACK: LetterFeedback[][] = [
  ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
  ["gramCorrect", "gramCorrect", "misplaced", "absent", "absent", "absent"],
  ["gramCorrect", "gramCorrect", "absent", "misplaced", "absent", "absent"],
  ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
];

const base = { guesses: GUESSES, feedback: FEEDBACK, won: true, wordLength: 6 };

describe("position triangulation (positionDeduction)", () => {
  it("credits ruling out a new wrong spot for an already-known letter", () => {
    const d = decomposeScore(base);
    expect(on(d, "positionDeduction", 2)).toBeGreaterThan(0);
  });

  it("does not credit a letter's first yellow (that is discovery, paid by breadth)", () => {
    const d = decomposeScore(base);
    expect(on(d, "positionDeduction", 1)).toBe(0);
  });

  it("does not credit re-testing an already-ruled-out spot", () => {
    // Guess 2 replays S back at pos 2, the slot guess 1 already ruled out: no new elimination.
    const feedback: LetterFeedback[][] = [
      ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "misplaced", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "misplaced", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
    ];
    const d = decomposeScore({
      guesses: ["ENABCD", "ENSXYZ", "ENSJKL", "ENSOLD"],
      feedback,
      won: true,
      wordLength: 6,
    });
    expect(on(d, "positionDeduction", 2)).toBe(0);
  });

  it("stays at parity (is NOT stuck-buffed) near the endgame", () => {
    const plain = decomposeScore(base);
    const nearEndgame = decomposeScore({ ...base, poolByGuess: [100, 100, 3, 1] });
    // Unlike breadth, position triangulation does not ride the stuck buff: the credit is identical
    // whether or not the field had narrowed, keeping it in line with the other deductions.
    expect(on(nearEndgame, "positionDeduction", 2)).toBeCloseTo(
      on(plain, "positionDeduction", 2),
      5
    );
  });
});
