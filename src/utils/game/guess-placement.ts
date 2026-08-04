// A guess can be placed shorter than the board and slid over, leaving blank
// tiles on one side (e.g. `[blank, blank, W, O, R, D]`). We encode that placement
// as leading spaces on the guess string itself: the letters stay one contiguous
// run and the leading-space count IS the column offset. Keeping the offset inside
// the string (rather than a parallel field) means feedback stays column-indexed
// and every downstream consumer -- scoring, luck, narrowing, rendering -- reads
// the placement for free from the string, with old spaceless guesses unchanged.

export interface ParsedGuess {
  /** The canonical stored/scored string: leading spaces (the offset) + letters. */
  spaced: string;
  /** The contiguous word alone, used for word-list / gram / length validation. */
  word: string;
  /** Column the first letter sits in (count of leading blanks). */
  offset: number;
}

export type ParseGuessError = "empty" | "noncontiguous" | "overflow";

export type ParseGuessResult =
  | { ok: true; value: ParsedGuess }
  | { ok: false; reason: ParseGuessError };

/**
 * Parse a raw board row (which may carry blank tiles as spaces) into its
 * placement. Trailing blanks are dropped (they are just empty columns past the
 * word and carry no offset); leading/interior blanks are preserved so the run
 * structure can be validated. The letters must form a single contiguous block:
 * a space between letters (`[G, U, blank, S, S]`) is rejected as noncontiguous.
 */
export function parseGuess(raw: string, wordLength: number): ParseGuessResult {
  // Trailing blanks are equivalent to empty columns, so trim them; leading
  // blanks encode the offset and are kept.
  const spaced = raw.toUpperCase().replace(/\s+$/, "");
  const word = spaced.replace(/^\s+/, "");
  const offset = spaced.length - word.length;

  if (word.length === 0) return { ok: false, reason: "empty" };
  // An interior space means the letters are in two runs, not one word.
  if (word.includes(" ")) return { ok: false, reason: "noncontiguous" };
  // The placed word must fit within the board from its offset.
  if (offset + word.length > wordLength) return { ok: false, reason: "overflow" };

  return { ok: true, value: { spaced, word, offset } };
}
