import { describe, expect, it } from "vitest";
import { SCORE_TUNING, decomposeScore } from "./score";
import type { LetterFeedback } from "./types";

// Locks the component-ceiling relationships the scoring comments claim, so a weight/cap edit (or a PT
// change) that silently breaks the balance fails here instead of only showing up as drift in the sim.
// Two layers: (1) arithmetic invariants over SCORE_TUNING -- the parity/ordering the comments assert,
// independent of PT; (2) behavioral checks that decomposeScore actually realizes a component at its
// PT-scaled ceiling (so the cap, weight, and coverage scaling are wired up, not just declared).

const T = SCORE_TUNING;

// Sum a whole game's contributions for one component key (the realized, rounded points).
const total = (d: ReturnType<typeof decomposeScore>, key: string): number =>
  d.contributions.filter((c) => c.key === key).reduce((s, c) => s + c.points, 0);

// A count-capped credit's PT-scaled ceiling; a ramped/averaged credit's is PT * weight.
const cappedCeiling = (cap: number, weight: number) => T.PT * cap * weight;

describe("score ceiling invariants (arithmetic)", () => {
  it("deduction's capped max equals breadth's max, independent of PT", () => {
    expect(T.DEDUCTION_CAP * T.DEDUCTION_WEIGHT).toBeCloseTo(T.BREADTH_WEIGHT, 10);
  });

  it("gram and position triangulation sit at parity with letter deduction", () => {
    const deduction = T.DEDUCTION_CAP * T.DEDUCTION_WEIGHT;
    expect(T.GRAM_DEDUCTION_CAP * T.GRAM_DEDUCTION_WEIGHT).toBeCloseTo(deduction, 10);
    expect(T.POSITION_DEDUCTION_CAP * T.POSITION_DEDUCTION_WEIGHT).toBeCloseTo(
      deduction,
      10
    );
  });

  it("cold placement is 0.8x letter deduction per letter, same cap", () => {
    expect(T.COLD_PLACEMENT_WEIGHT).toBeCloseTo(T.DEDUCTION_WEIGHT * 0.8, 10);
    expect(T.COLD_PLACEMENT_CAP).toBe(T.DEDUCTION_CAP);
  });

  it("short-guess penalty is calibrated at the neglect weight and cap", () => {
    expect(T.SHORT_GUESS_WEIGHT).toBeCloseTo(T.NEGLECT_WEIGHT, 10);
    expect(T.SHORT_GUESS_CAP).toBe(T.NEGLECT_CAP);
  });

  it("gram stagnation bites less than letter waste", () => {
    expect(T.GRAM_STAGNATION_WEIGHT).toBeLessThan(T.WASTE_WEIGHT);
  });
});

describe("score ceiling invariants (behavioral)", () => {
  // gram EN, 6-letter win. Opener + one probe test 8 distinct non-gram letters (>= BREADTH_RAMP_HI),
  // cleanly (all fresh, no repeats), so the breadth ramp saturates and the whole breadth pot pays out.
  // The winning guess (fresh letters) adds no breadth. No poolByGuess is passed, so the stuck buff
  // never fires and the realized breadth is exactly the ceiling.
  it("a maximally broad game realizes breadth at PT * BREADTH_WEIGHT", () => {
    const guesses = ["ENABCD", "ENFGHI", "ENWXYZ"];
    const feedback: LetterFeedback[][] = [
      ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
    ];
    const d = decomposeScore({ guesses, feedback, won: true, wordLength: 6 });
    expect(total(d, "breadth")).toBeCloseTo(T.PT * T.BREADTH_WEIGHT, 0);
  });

  // gram EN, 6-letter win. The opener turns all four non-gram letters yellow (coverage = 1 entering
  // the finish), then the winning guess places them all green: four yellow->green deductions, capped
  // at DEDUCTION_CAP and scaled by the full coverage. Realized deduction should hit its ceiling AND
  // equal the breadth ceiling above (both are PT * cap * weight === PT * BREADTH_WEIGHT).
  it("a full-coverage batch of deductions realizes PT * DEDUCTION_CAP * DEDUCTION_WEIGHT", () => {
    const guesses = ["ENIDVE", "ENDIVE"];
    const feedback: LetterFeedback[][] = [
      ["gramCorrect", "gramCorrect", "misplaced", "misplaced", "misplaced", "misplaced"],
      ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
    ];
    const d = decomposeScore({ guesses, feedback, won: true, wordLength: 6 });
    expect(total(d, "deduction")).toBeCloseTo(
      cappedCeiling(T.DEDUCTION_CAP, T.DEDUCTION_WEIGHT),
      0
    );
    // The parity the comments claim, verified through real scoring, not just arithmetic.
    expect(total(d, "deduction")).toBeCloseTo(T.PT * T.BREADTH_WEIGHT, 0);
  });
});
