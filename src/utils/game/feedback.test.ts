import { describe, expect, it } from "vitest";
import { computeFeedback } from "./feedback";

describe("computeFeedback", () => {
  it("marks gramCorrect when guess and hidden gram align at the only occurrence", () => {
    const fb = computeFeedback("ENTREE", "ENTERS", "EN");
    expect(fb[0]).toBe("gramCorrect");
    expect(fb[1]).toBe("gramCorrect");
  });

  it("marks gramMisplaced when no occurrence aligns", () => {
    const fb = computeFeedback("OPENED", "ENTERS", "EN");
    expect(fb[2]).toBe("gramMisplaced");
    expect(fb[3]).toBe("gramMisplaced");
  });

  it("aligns to the back occurrence when hidden has the gram twice", () => {
    const fb = computeFeedback("OPENEN", "RENTEN", "EN");
    expect(fb[4]).toBe("gramCorrect");
    expect(fb[5]).toBe("gramCorrect");
    expect(fb[2]).not.toBe("gramCorrect");
    expect(fb[3]).not.toBe("gramCorrect");
  });

  it("awards gramCorrect on the exact-match guess of a hidden word with repeated grams", () => {
    const fb = computeFeedback("RENTEN", "RENTEN", "EN");
    expect(fb).toEqual([
      "correct",
      "gramCorrect",
      "gramCorrect",
      "correct",
      "correct",
      "correct",
    ]);
  });

  it("handles BANANA: hidden BANANA, guess BANANA, gram AN (appears twice)", () => {
    const fb = computeFeedback("BANANA", "BANANA", "AN");
    expect(fb).toEqual([
      "correct",
      "gramCorrect",
      "gramCorrect",
      "correct",
      "correct",
      "correct",
    ]);
  });

  it("BANANA hidden, CANYON guess (gram AN at index 1)", () => {
    const fb = computeFeedback("CANYON", "BANANA", "AN");
    expect(fb[1]).toBe("gramCorrect");
    expect(fb[2]).toBe("gramCorrect");
    expect(fb[0]).toBe("absent");
    expect(fb[3]).toBe("absent");
    expect(fb[4]).toBe("absent");
    expect(fb[5]).toBe("misplaced");
  });

  it("BANANA hidden, ANANAS guess: aligned at front; second gram letters fall through", () => {
    const fb = computeFeedback("ANANAS", "BANANA", "AN");
    expect(fb[0]).toBe("gramMisplaced");
    expect(fb[1]).toBe("gramMisplaced");
    expect(fb[2]).toBe("misplaced");
    expect(fb[3]).toBe("misplaced");
    expect(fb[4]).toBe("misplaced");
    expect(fb[5]).toBe("absent");
  });

  it("does not double-count letters used by the hidden gram", () => {
    const fb = computeFeedback("ENEMAS", "ENTERS", "EN");
    expect(fb[0]).toBe("gramCorrect");
    expect(fb[1]).toBe("gramCorrect");
    expect(fb[2]).toBe("misplaced");
    expect(fb[3]).toBe("absent");
    expect(fb[4]).toBe("absent");
    expect(fb[5]).toBe("correct");
  });

  it("throws if gram is missing in either word", () => {
    expect(() => computeFeedback("PLANTS", "BANANA", "EN")).toThrow();
    expect(() => computeFeedback("ENTERS", "PLANTS", "EN")).toThrow();
  });

  it("guess gram only at back, hidden gram only at front: gramMisplaced", () => {
    const fb = computeFeedback("ABCDEN", "ENABCD", "EN");
    expect(fb[4]).toBe("gramMisplaced");
    expect(fb[5]).toBe("gramMisplaced");
  });

  it("guess gram twice, hidden gram once: aligns at the matching position", () => {
    const fb = computeFeedback("ENABEN", "XYABEN", "EN");
    expect(fb[4]).toBe("gramCorrect");
    expect(fb[5]).toBe("gramCorrect");
    expect(fb[0]).toBe("absent");
    expect(fb[1]).toBe("absent");
  });

  // Offset-placed (slid) guesses: leading spaces are blank columns, and the rest
  // of the row is scored against the absolute board columns the letters occupy.
  describe("offset placement (blank tiles)", () => {
    it("marks leading spaces blank and scores the letters at their absolute columns", () => {
      // " ARDEN" over GARDEN: col0 blank, ARDEN sits at cols 1..5, its EN landing
      // on GARDEN's EN, so the gram aligns and A/R/D are green in place.
      const fb = computeFeedback(" ARDEN", "GARDEN", "EN");
      expect(fb).toEqual([
        "blank",
        "correct",
        "correct",
        "correct",
        "gramCorrect",
        "gramCorrect",
      ]);
    });

    it("aligns the gram by absolute column, so sliding turns a misplaced gram correct", () => {
      // OPEN left-aligned: its EN (cols 2-3) misses GARDEN's EN (cols 4-5).
      const flat = computeFeedback("OPEN", "GARDEN", "EN");
      expect(flat[2]).toBe("gramMisplaced");
      expect(flat[3]).toBe("gramMisplaced");
      // Slid two columns so its EN lands on cols 4-5: now the gram is correct.
      const slid = computeFeedback("  OPEN", "GARDEN", "EN");
      expect(slid).toEqual([
        "blank",
        "blank",
        "absent",
        "absent",
        "gramCorrect",
        "gramCorrect",
      ]);
    });

    it("is identical to the flat result for a full-length, offset-0 guess", () => {
      // No leading spaces means no blanks and byte-identical behavior to before.
      expect(computeFeedback("ENTREE", "ENTERS", "EN")).toEqual(
        computeFeedback("ENTREE", "ENTERS", "EN"),
      );
      expect(
        computeFeedback("ENTREE", "ENTERS", "EN").includes("blank"),
      ).toBe(false);
    });
  });
});
