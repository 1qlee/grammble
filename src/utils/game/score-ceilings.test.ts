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
  it("breadth's ramped max sits below the capped deduction family, independent of PT", () => {
    // Breadth was demoted from parity (0.18) to 0.12: testing letters ranks under placing deduced
    // ones, so the deduction family tops the ledger and breadth sits below it.
    expect(T.BREADTH_WEIGHT).toBeLessThan(T.DEDUCTION_CAP * T.DEDUCTION_WEIGHT);
  });

  it("gram and position triangulation are weighted at parity with letter deduction but are uncapped", () => {
    // Both triangulation credits are paid per elimination at the deduction weight, but neither has a
    // count cap: each elimination is turn-paid narrowing (yellows, never a solve), so there is no
    // one-shot green-dump to guard. Only the per-elimination weight is at parity; the game ceiling is
    // bounded by play, not a fixed charge count.
    expect(T.GRAM_DEDUCTION_WEIGHT).toBeCloseTo(T.DEDUCTION_WEIGHT, 10);
    expect(T.POSITION_DEDUCTION_WEIGHT).toBeCloseTo(T.DEDUCTION_WEIGHT, 10);
    expect(T).not.toHaveProperty("GRAM_DEDUCTION_CAP");
    expect(T).not.toHaveProperty("POSITION_DEDUCTION_CAP");
  });

  it("cold placement is at parity with letter deduction per letter, and uncapped", () => {
    // A fresh green (a letter placed with no prior yellow clue) is as skillful as placing a deduced
    // one, so it pays deduction's per-letter weight. It has no count cap: the number of cold placements
    // is bounded by the mode's non-gram tile count, not a fixed charge budget.
    expect(T.COLD_PLACEMENT_WEIGHT).toBeCloseTo(T.DEDUCTION_WEIGHT, 10);
    expect(T).not.toHaveProperty("COLD_PLACEMENT_CAP");
  });

  it("short-guess penalty is the breadth mirror: breadth's per-letter rate, uncapped", () => {
    // A missing slot forgoes exactly the breadth a full-length slot could have gathered, so shortGuess
    // is priced at breadth's per-letter reward rate (BREADTH_WEIGHT / (HI - LO)) and, like the reward it
    // mirrors, has no count cap. It is NO LONGER pinned to WASTE_WEIGHT: waste was buffed off the mirror
    // to neglect parity, but short-guess is forgone coverage (not thrown-away info) so it stays here.
    const breadthPerLetter =
      T.BREADTH_WEIGHT / (T.BREADTH_RAMP_HI - T.BREADTH_RAMP_LO);
    expect(T.SHORT_GUESS_WEIGHT).toBeCloseTo(breadthPerLetter, 10);
    expect(T.SHORT_GUESS_WEIGHT).not.toBeCloseTo(T.WASTE_WEIGHT, 10);
    expect(T).not.toHaveProperty("SHORT_GUESS_CAP");
  });

  it("wasted-info penalty is at parity with neglect, and uncapped", () => {
    // Re-testing a dead letter / overwriting a locked green throws away information already held; it is
    // priced per tile the same as neglecting a known-present letter (NEGLECT_WEIGHT). Uncapped, unlike
    // neglect: re-testing dead info is always avoidable, so continuous bad play is penalized continuously.
    expect(T.WASTE_WEIGHT).toBeCloseTo(T.NEGLECT_WEIGHT, 10);
    expect(T).not.toHaveProperty("WASTE_CAP");
  });

  it("gram stagnation is priced at exactly twice letter waste (two gram tiles vs one dead letter)", () => {
    expect(T.GRAM_STAGNATION_WEIGHT).toBeCloseTo(T.WASTE_WEIGHT * 2, 10);
  });
});

describe("score ceiling invariants (behavioral)", () => {
  // gram EN, 6-letter win. Opener tests ABCD (4 distinct = BREADTH_RAMP_LO, fills the floor), then the
  // probe ENFGHI tests FGHI (4 more), pushing the game to 8 distinct -- PAST BREADTH_RAMP_HI (7). With
  // the game cap removed, breadth is no longer clamped at PT * BREADTH_WEIGHT: the probe's 4 letters each
  // earn the per-letter rate PT * BREADTH_WEIGHT / (HI - LO), so the realized breadth EXCEEDS the old
  // ceiling. The winning guess (fresh letters) adds no breadth; no poolByGuess, so no stuck buff.
  it("breadth is uncapped past BREADTH_RAMP_HI: a very broad game exceeds PT * BREADTH_WEIGHT", () => {
    const guesses = ["ENABCD", "ENFGHI", "ENWXYZ"];
    const feedback: LetterFeedback[][] = [
      ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
    ];
    const d = decomposeScore({ guesses, feedback, won: true, wordLength: 6 });
    const perLetter = (T.PT * T.BREADTH_WEIGHT) / (T.BREADTH_RAMP_HI - T.BREADTH_RAMP_LO);
    // The opener fills the floor (4 distinct -> 0 credit); the probe's 4 fresh letters each pay perLetter.
    expect(total(d, "breadth")).toBeCloseTo(4 * perLetter, 0);
    expect(total(d, "breadth")).toBeGreaterThan(T.PT * T.BREADTH_WEIGHT);
  });

  // gram EN, 6-letter win. The opener turns all four non-gram letters yellow, then the winning guess
  // places them all green: four yellow->green deductions credited flat at DEDUCTION_WEIGHT (no coverage
  // scaling since 2026-08-15) and capped at DEDUCTION_CAP. Realized deduction should hit its ceiling AND
  // equal the breadth ceiling above (both are PT * cap * weight === PT * BREADTH_WEIGHT).
  it("a batch of deductions realizes PT * DEDUCTION_CAP * DEDUCTION_WEIGHT", () => {
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
    // Deduction now tops breadth through real scoring (breadth was demoted to 0.12), not just arithmetic.
    expect(total(d, "deduction")).toBeGreaterThan(T.PT * T.BREADTH_WEIGHT);
  });

  // gram AB, 6-letter win. The gram is bet wrong (pos 0, pos 1) then locked correct for the FIRST time
  // on the winning guess. The heldGreen/foundGram loop stops at lastNonWin (= n - 2), so without the
  // win-lock credit the final placement would earn nothing; it now earns a flat gram-family unit
  // (PT * GRAM_DEDUCTION_WEIGHT) under foundGram. A gram found on a MIDDLE guess must NOT get it.
  it("locking the gram correct on the winning guess earns a flat gram-family foundGram credit", () => {
    const winLock = decomposeScore({
      guesses: ["ABMNOP", "MABNOP", "XYABZW"],
      feedback: [
        ["gramMisplaced", "gramMisplaced", "absent", "absent", "absent", "absent"],
        ["absent", "gramMisplaced", "gramMisplaced", "absent", "absent", "absent"],
        ["correct", "correct", "gramCorrect", "gramCorrect", "correct", "correct"],
      ],
      won: true,
      wordLength: 6,
    });
    expect(total(winLock, "foundGram")).toBeCloseTo(T.PT * T.GRAM_DEDUCTION_WEIGHT, 1);

    // Found on a middle guess: the win-lock credit does not apply (only the averaged mid-game credit).
    const midFound = decomposeScore({
      guesses: ["ABMNOP", "XYABZW", "XYABZW"],
      feedback: [
        ["gramMisplaced", "gramMisplaced", "absent", "absent", "absent", "absent"],
        ["correct", "correct", "gramCorrect", "gramCorrect", "absent", "absent"],
        ["correct", "correct", "gramCorrect", "gramCorrect", "correct", "correct"],
      ],
      won: true,
      wordLength: 6,
    });
    expect(total(midFound, "foundGram")).not.toBeCloseTo(T.PT * T.GRAM_DEDUCTION_WEIGHT, 1);
  });

  // gram EN, 6-letter win. heldGreen credits ONLY greens carried from an earlier guess. Middle guess
  // ENABCD places C green for the FIRST time (a cold placement) -- that fresh green must not read as
  // "held", so heldGreen stays 0. The second run carries C's green into the next middle guess, so
  // heldGreen fires. Guards the score/label/note agreement (mirrors heldGreenCols in note-tiles).
  it("heldGreen credits carried greens only, never a green first placed this turn", () => {
    const fresh = decomposeScore({
      guesses: ["ENABCD", "ENDIVE"],
      feedback: [
        ["gramCorrect", "gramCorrect", "absent", "absent", "correct", "absent"],
        ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
      ],
      won: true,
      wordLength: 6,
    });
    expect(total(fresh, "heldGreen")).toBe(0);

    const carried = decomposeScore({
      guesses: ["ENABCD", "ENABGH", "ENDIVE"],
      feedback: [
        ["gramCorrect", "gramCorrect", "absent", "absent", "correct", "absent"],
        ["gramCorrect", "gramCorrect", "absent", "absent", "correct", "absent"],
        ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
      ],
      won: true,
      wordLength: 6,
    });
    expect(total(carried, "heldGreen")).toBeGreaterThan(0);
  });

  // gram XY, 6-letter win with a DUPLICATE letter (two Es). "Held your locked letters" is per POSITION:
  // one E is locked green at col 2 and carried, while the OTHER E -- previously yellow (col 5 on guess
  // 1) -- is placed correctly for the first time at col 3 on the MIDDLE guess. That second E is a
  // deduction, not held: heldGreen must count only the carried cols (X, Y, E@2), never the fresh E@3,
  // and the deduction line must own col 3. Guards the score/note agreement (a by-letter walk wrongly
  // counted the fresh E as held because the letter E was already green somewhere).
  it("heldGreen counts a carried position, not a second instance freshly placed", () => {
    const args = {
      guesses: ["XYEZZE", "XYEEZZ", "XYEENN"],
      feedback: [
        ["gramCorrect", "gramCorrect", "correct", "absent", "absent", "misplaced"],
        ["gramCorrect", "gramCorrect", "correct", "correct", "absent", "absent"],
        ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
      ] as LetterFeedback[][],
      won: true,
      wordLength: 6,
    };
    const d = decomposeScore(args);
    // Held mass on the middle guess = 3 carried greens (X, Y, E@2) / 6, averaged over lastNonWin (1).
    // The fresh E@3 is excluded, so this is strictly less than the 4-green (by-letter) count would give.
    expect(total(d, "heldGreen")).toBeCloseTo(
      (T.PT * T.HELD_GREEN_WEIGHT * (3 / 6)) / 1,
      1
    );
    // The fresh E@3 (yellow -> green) is a deduction, credited once at the per-letter rate.
    expect(total(d, "deduction")).toBeCloseTo(T.PT * T.DEDUCTION_WEIGHT, 1);
  });

  // gram EN, 6-letter win with a DUPLICATE letter (two Es) in the answer. Placement credit is
  // per-INSTANCE: a second copy of a letter locked green must earn its own credit, not be swallowed by
  // the first. Two unclued Es (never seen yellow) are BOTH cold; when only one E was seen yellow
  // earlier, the first E is a deduction and the second unclued E is still a fresh cold placement.
  const perLetter = T.PT * T.COLD_PLACEMENT_WEIGHT;
  it("credits each instance of a duplicate letter placed green, not just the first", () => {
    // ENEEBB: both Es (cols 2,3) and both Bs (cols 4,5) locked with no prior yellow -> 4 cold.
    const bothCold = decomposeScore({
      guesses: ["ENXXXX", "ENYYYY", "ENEEBB"],
      feedback: [
        ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
        ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
        ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
      ],
      won: true,
      wordLength: 6,
    });
    expect(total(bothCold, "coldPlacement")).toBeCloseTo(4 * perLetter, 1);

    // One E seen yellow on guess 1 (col 3). On the win the first E is a deduction; the second E has no
    // clue of its own, so it is cold alongside the two Bs -> 1 deduction + 3 cold.
    const oneClued = decomposeScore({
      guesses: ["ENXEXX", "ENYYYY", "ENEEBB"],
      feedback: [
        ["gramCorrect", "gramCorrect", "absent", "misplaced", "absent", "absent"],
        ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
        ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
      ],
      won: true,
      wordLength: 6,
    });
    expect(total(oneClued, "deduction")).toBeCloseTo(perLetter, 1);
    expect(total(oneClued, "coldPlacement")).toBeCloseTo(3 * perLetter, 1);
  });

  // gram EN, 6-letter win. Guess 1 (ENABCD) leaves A,B,C,D gray; guess 2 (ENABGH) replays A and B in
  // their EXACT gray tiles (cols 2 and 3), then guess 3 wins. Each same-spot repeat folds a flat
  // SAME_POS_WASTE_PENALTY INTO the "waste" line (no separate key), on top of the per-tile dead-letter
  // weight -- so the one waste line is deepened by both, not split.
  it("same-spot dead repeats deepen the waste line by a flat penalty each (no separate key)", () => {
    const guesses = ["ENABCD", "ENABGH", "ENMOPQ"];
    const feedback: LetterFeedback[][] = [
      ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
      ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
    ];
    const d = decomposeScore({ guesses, feedback, won: true, wordLength: 6 });
    // Two dead letters (A,B) at the per-tile weight PLUS two flat same-spot penalties, all under "waste".
    expect(total(d, "waste")).toBeCloseTo(
      -(2 * T.PT * T.WASTE_WEIGHT + 2 * T.SAME_POS_WASTE_PENALTY),
      1
    );
    // No separate same-spot line exists.
    expect(total(d, "wasteSamePos")).toBe(0);
  });
});
