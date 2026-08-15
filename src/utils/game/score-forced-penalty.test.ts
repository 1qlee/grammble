import { describe, expect, it } from "vitest";
import { decomposeScore } from "./score";
import type { LetterFeedback } from "./types";

const has = (
  d: ReturnType<typeof decomposeScore>,
  key: string
): boolean => d.contributions.some((c) => c.key === key);

// A 3-guess win where guess 2 omits a known-present letter Q (neglect), Q placed on the win.
const NEGLECT_GUESSES = ["ENQRST", "ENUVWX", "ENQBCD"];
const NEGLECT_FEEDBACK: LetterFeedback[][] = [
  ["gramCorrect", "gramCorrect", "misplaced", "absent", "absent", "absent"],
  ["gramCorrect", "gramCorrect", "absent", "absent", "absent", "absent"],
  ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
];

// A 3-guess win where guess 2 re-parks the gram on position 2, already ruled out by guess 1.
const STAGNATION_GUESSES = ["ABENCD", "XYENZW", "ENABCD"];
const STAGNATION_FEEDBACK: LetterFeedback[][] = [
  ["absent", "absent", "gramMisplaced", "gramMisplaced", "absent", "absent"],
  ["absent", "absent", "gramMisplaced", "gramMisplaced", "absent", "absent"],
  ["gramCorrect", "gramCorrect", "correct", "correct", "correct", "correct"],
];

describe("forced-penalty waivers", () => {
  describe("neglect", () => {
    const base = {
      guesses: NEGLECT_GUESSES,
      feedback: NEGLECT_FEEDBACK,
      won: true,
      wordLength: 6,
      gram: "EN",
    };

    it("charges neglect when no probePool is provided (prior behavior)", () => {
      expect(has(decomposeScore(base), "neglect")).toBe(true);
    });

    it("charges neglect when an unplayed non-answer word could have used the letter", () => {
      // ENQADS carries Q and is unplayed, so omitting Q was a choice.
      expect(has(decomposeScore({ ...base, probePool: ["ENQADS"] }), "neglect")).toBe(true);
    });

    it("waives neglect when no unplayed non-answer word contains the letter", () => {
      // The only Q-word (ENQRST) is already played; nothing left but the answer could carry Q.
      const waived = decomposeScore({ ...base, probePool: ["ENZYME"] });
      expect(has(waived, "neglect")).toBe(false);
      // Waiving a penalty can only raise the score.
      expect(waived.total).toBeGreaterThanOrEqual(decomposeScore(base).total);
    });
  });

  describe("gram stagnation", () => {
    const base = {
      guesses: STAGNATION_GUESSES,
      feedback: STAGNATION_FEEDBACK,
      won: true,
      wordLength: 6,
      gram: "EN",
    };

    it("charges stagnation when no probePool is provided (prior behavior)", () => {
      expect(has(decomposeScore(base), "gramStagnation")).toBe(true);
    });

    it("charges stagnation when an unplayed word could reach a fresh gram position", () => {
      // ENXYZW places the gram at column 0 (offset 0), a spot not yet ruled out.
      expect(
        has(decomposeScore({ ...base, probePool: ["ENXYZW"] }), "gramStagnation")
      ).toBe(true);
    });

    it("waives stagnation when every reachable gram position is already ruled out", () => {
      // QRENST is full-length with the gram fixed at column 2, the one already known wrong; it
      // cannot slide, so no fresh position was reachable.
      const waived = decomposeScore({ ...base, probePool: ["QRENST"] });
      expect(has(waived, "gramStagnation")).toBe(false);
      expect(waived.total).toBeGreaterThanOrEqual(decomposeScore(base).total);
    });

    it("charges stagnation when a short word could slide its gram to a fresh position", () => {
      // ENAB (len 4) reaches columns 0..2 by offset, so column 0/1 are fresh alternatives.
      expect(
        has(decomposeScore({ ...base, probePool: ["ENAB"] }), "gramStagnation")
      ).toBe(true);
    });
  });
});
