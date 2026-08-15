import { describe, expect, it } from "vitest";
import { decomposeScore } from "./score";
import type { LetterFeedback } from "./types";

// The opener's gram grade. A gram placed in its CORRECT slot earns full marks outright (graded on the
// outcome), even when that slot is a-priori uncommon; a gram bet that did NOT land is graded on prior
// likelihood, relative to the best slot. Before this, a correct-but-unlikely bet was graded only on
// prior, so a wrong bet on the popular slot could outscore a correct bet on a rare one.
const openerGramLine = (d: ReturnType<typeof decomposeScore>) =>
  d.frameLines.find((l) => l.key === "openerGram");

const WIN: LetterFeedback[] = [
  "correct",
  "correct",
  "correct",
  "gramCorrect",
  "gramCorrect",
  "correct",
];

// Prior distribution over the five gram slots (positions 0..4 for a 6-letter answer): the start is
// the likeliest, the correct slot below (pos 3 = 0.2 vs best pos 0 = 0.5).
const FRACTIONS = [0.5, 0.1, 0.1, 0.2, 0.0];

describe("opener gram grade", () => {
  it("awards full marks for a gram landed in its correct slot, even when that slot is unlikely", () => {
    // Opener places the gram (EN) correctly at position 3 -- an a-priori uncommon slot (0.2, not best).
    const feedback: LetterFeedback[][] = [
      ["absent", "absent", "absent", "gramCorrect", "gramCorrect", "absent"],
      WIN,
    ];
    const d = decomposeScore({
      guesses: ["ABCENF", "XYZENW"],
      feedback,
      won: true,
      wordLength: 6,
      gramPositionFractions: FRACTIONS,
    });
    const line = openerGramLine(d);
    expect(line?.exact).toBe(true);
    // Full credit: points equals the line's own ceiling, not the 0.2/0.5 prior grade (which would be 2).
    expect(line?.points).toBeCloseTo(line?.max ?? 0, 5);
  });

  it("grades a gram bet that did not land on prior likelihood, below full", () => {
    // Opener bets the gram at position 1 (gramMisplaced, prior 0.1) -- wrong, and not the best slot.
    const feedback: LetterFeedback[][] = [
      ["absent", "gramMisplaced", "gramMisplaced", "absent", "absent", "absent"],
      WIN,
    ];
    const d = decomposeScore({
      guesses: ["AENBCD", "XYZENW"],
      feedback,
      won: true,
      wordLength: 6,
      gramPositionFractions: FRACTIONS,
    });
    const line = openerGramLine(d);
    expect(line?.exact).toBeFalsy();
    expect(line?.points).toBeLessThan(line?.max ?? 0);
  });

  it("a correct bet on a rare slot ranks above a wrong bet on a below-best slot", () => {
    const correctUnlikely = decomposeScore({
      guesses: ["ABCENF", "XYZENW"],
      feedback: [
        ["absent", "absent", "absent", "gramCorrect", "gramCorrect", "absent"],
        WIN,
      ],
      won: true,
      wordLength: 6,
      gramPositionFractions: FRACTIONS,
    });
    // Wrong bet at position 1 (prior 0.1), which is not the best slot (0.5): graded to 1, below full.
    const wrongBelowBest = decomposeScore({
      guesses: ["AENBCD", "XYZENW"],
      feedback: [
        ["absent", "gramMisplaced", "gramMisplaced", "absent", "absent", "absent"],
        WIN,
      ],
      won: true,
      wordLength: 6,
      gramPositionFractions: FRACTIONS,
    });
    expect(openerGramLine(correctUnlikely)?.points).toBeGreaterThan(
      openerGramLine(wrongBelowBest)?.points ?? 0
    );
  });

  it("a wrong bet on the single best slot still earns full marks, tying a correct bet on the grade", () => {
    // The MATTER/DAMAGE case: a wrong bet on the most-probable slot grades to full (frac/best = 1), so
    // on the openerGram term alone it ties a correct-but-rare bet. The two games separate on OTHER terms.
    const wrongOnBest = decomposeScore({
      guesses: ["ENABCD", "XYZENW"],
      feedback: [
        ["gramMisplaced", "gramMisplaced", "absent", "absent", "absent", "absent"],
        WIN,
      ],
      won: true,
      wordLength: 6,
      gramPositionFractions: FRACTIONS,
    });
    const line = openerGramLine(wrongOnBest);
    expect(line?.exact).toBeFalsy();
    expect(line?.points).toBeCloseTo(line?.max ?? 0, 5);
  });
});
