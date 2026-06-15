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
});
