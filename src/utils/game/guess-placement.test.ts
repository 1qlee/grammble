import { describe, expect, it } from "vitest";
import { parseGuess } from "./guess-placement";

describe("parseGuess", () => {
  it("parses a flat, offset-0 guess", () => {
    expect(parseGuess("WORDS", 6)).toEqual({
      ok: true,
      value: { spaced: "WORDS", word: "WORDS", offset: 0 },
    });
  });

  it("reads leading blanks as the offset and keeps them in the spaced form", () => {
    expect(parseGuess("  WORD", 6)).toEqual({
      ok: true,
      value: { spaced: "  WORD", word: "WORD", offset: 2 },
    });
  });

  it("uppercases and trims trailing blanks (empty columns carry no offset)", () => {
    expect(parseGuess(" word  ", 7)).toEqual({
      ok: true,
      value: { spaced: " WORD", word: "WORD", offset: 1 },
    });
  });

  it("rejects an interior blank as noncontiguous", () => {
    expect(parseGuess("GU SS", 6)).toEqual({ ok: false, reason: "noncontiguous" });
  });

  it("rejects an all-blank row as empty", () => {
    expect(parseGuess("   ", 6)).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects a placement that runs off the board", () => {
    // offset 3 + a 4-letter word = 7 columns, past a 6-wide board.
    expect(parseGuess("   WORD", 6)).toEqual({ ok: false, reason: "overflow" });
  });

  it("allows a placement that exactly fills the board from its offset", () => {
    expect(parseGuess("  WORD", 6)).toMatchObject({ ok: true });
    expect(parseGuess("   WORD", 7)).toMatchObject({ ok: true });
  });
});
