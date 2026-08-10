import type { LetterFeedback } from "./types";

// Which board tiles a single score note refers to, so the recap can highlight the exact letters a
// contribution was earned (or charged) on when the player hovers or taps that note.
//
// This mirrors the POSITION bookkeeping of the per-guess walks in score.ts (deductionsByGuess,
// coldPlacementsByGuess, wastedByGuess, newTestedByGuess, gradeOpener, etc.). score.ts is the tuned,
// server-only source of truth for the point math and must not change; this reproduces only where each
// walk lands, never what it is worth. Keys with no per-tile meaning in a row -- a `length` shortfall
// or a `neglect` omission is about tiles that are absent -- return an empty list, so their note
// renders as plain, non-interactive text.
//
// `gi` is the guess (board row) the note is attributed to. Most keys highlight tiles in that same
// row, but some point elsewhere: `neglect` (a known letter left unused this guess) highlights that
// letter's earliest appearance on an earlier row. So the result is a list of explicit board cells,
// not bare columns. Every walk replays from guess 0 to `gi` because attribution depends on
// prior-guess knowledge (a green is a deduction only if the letter was yellow on an earlier guess, a
// letter is "new" only if untested before, and so on).

// A single board tile: a column in a guess row.
export interface NoteCell {
  row: number;
  col: number;
}

const isGramTile = (t: LetterFeedback | undefined): boolean =>
  t === "gramCorrect" || t === "gramMisplaced";

const isSkippable = (t: LetterFeedback | undefined): boolean =>
  isGramTile(t) || t === "blank";

// Non-gram green (correct) placements in `gi`, split by whether the letter had shown up yellow on an
// earlier guess (deduction) or never had (coldPlacement). Mirrors deductionsByGuess /
// coldPlacementsByGuess: each distinct letter is attributed once, at its first green.
function placementCols(
  guesses: string[],
  feedback: LetterFeedback[][],
  gi: number,
  wantDeduction: boolean
): number[] {
  const everYellow = new Set<string>();
  const counted = new Set<string>();
  const cols: number[] = [];
  for (let i = 0; i <= gi; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      const c = word[p];
      if (row[p] === "correct" && !counted.has(c)) {
        const isDeduction = everYellow.has(c);
        if (isDeduction === wantDeduction) {
          counted.add(c);
          if (i === gi) cols.push(p);
        } else {
          counted.add(c);
        }
      }
    }
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "misplaced") everYellow.add(word[p]);
    }
  }
  return cols;
}

// Deduction cells for row `gi`: each letter placed green on `gi` that had shown up yellow on an
// earlier guess, paired with the earliest cell where that yellow clue appeared, so the highlight
// reads as a deduction (the prior clue and the lock it earned) rather than an indistinguishable
// green, and spans the originating row like neglect does.
//
// This must mirror score.ts deductionsByGuess EXACTLY, including its `counted` semantics: a letter is
// added to `counted` only when it is actually credited as a deduction (it was yellow before this
// green). A green placed with no prior yellow (a cold placement) is deliberately NOT consumed, so a
// letter locked green early, later seen yellow in another slot, and re-placed green still counts as a
// deduction on that later guess -- matching the score. (An earlier version added every green to
// `counted`, which swallowed exactly this case and left the note with no tiles to highlight.)
function deductionCells(
  guesses: string[],
  feedback: LetterFeedback[][],
  gi: number
): NoteCell[] {
  const firstYellow = new Map<string, NoteCell>();
  const everYellow = new Set<string>();
  const counted = new Set<string>();
  const cells: NoteCell[] = [];
  for (let i = 0; i <= gi; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      const c = word[p];
      if (row[p] === "correct" && everYellow.has(c) && !counted.has(c)) {
        counted.add(c);
        if (i === gi) {
          cells.push({ row: gi, col: p });
          const origin = firstYellow.get(c);
          if (origin) cells.push(origin);
        }
      }
    }
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "misplaced") {
        everYellow.add(word[p]);
        if (!firstYellow.has(word[p]))
          firstYellow.set(word[p], { row: i, col: p });
      }
    }
  }
  return cells;
}

// Wrong letter-positions ruled out on `gi`: a letter ALREADY known present (seen yellow on an earlier
// guess) replayed at a slot never previously ruled out and still yellow. Mirrors
// positionRuledOutByGuess (knowledge read ENTERING each guess, folded in AFTER), so the highlight
// lands on the exact tiles that earned "Ruled out a wrong letter spot" -- never a letter's first
// yellow (its discovery, credited by breadth) nor a green (a deduction).
function positionRuledOutCells(
  guesses: string[],
  feedback: LetterFeedback[][],
  gi: number
): NoteCell[] {
  const everYellow = new Set<string>();
  const knownWrongPos = new Set<string>();
  const cells: NoteCell[] = [];
  for (let i = 0; i <= gi; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      if (row[p] !== "misplaced") continue;
      const c = word[p];
      if (i === gi && everYellow.has(c) && !knownWrongPos.has(`${c}@${p}`))
        cells.push({ row: gi, col: p });
    }
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "misplaced") {
        everYellow.add(word[p]);
        knownWrongPos.add(`${word[p]}@${p}`);
      }
    }
  }
  return cells;
}

// Non-gram letters first tested on `gi` (breadth). Mirrors newTestedByGuess: a letter
// counts on the guess that first introduces it. The winning guess is skipped on a win, exactly as the
// scoring helper does, so a hover never highlights letters that earned nothing.
function newTestedCols(
  guesses: string[],
  feedback: LetterFeedback[][],
  gi: number,
  won: boolean
): number[] {
  const upTo = won ? guesses.length - 1 : guesses.length;
  if (gi >= upTo) return [];
  const tested = new Set<string>();
  const cols: number[] = [];
  for (let i = 0; i <= gi; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      if (isSkippable(row[p])) continue;
      const c = word[p];
      if (!tested.has(c)) {
        tested.add(c);
        if (i === gi) cols.push(p);
      }
    }
  }
  return cols;
}

// Wasted non-gram tiles in `gi`: a letter re-tried on a known-wrong position (a locked green's slot,
// a known-absent letter, or a known wrong-position pairing). Mirrors wastedByGuess.
function wastedCols(
  guesses: string[],
  feedback: LetterFeedback[][],
  gi: number
): number[] {
  if (gi < 1) return [];
  const knownGreen = new Map<number, string>();
  const absentLetters = new Set<string>();
  const knownWrongPos = new Set<string>();
  const cols: number[] = [];
  for (let i = 0; i <= gi; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    if (i === gi) {
      for (let p = 0; p < word.length; p++) {
        if (isSkippable(row[p])) continue;
        const c = word[p];
        if (
          (knownGreen.has(p) && knownGreen.get(p) !== c) ||
          absentLetters.has(c) ||
          knownWrongPos.has(`${c}@${p}`)
        ) {
          cols.push(p);
        }
      }
    }
    for (let p = 0; p < word.length; p++) {
      const c = word[p];
      const tile = row[p];
      if (isSkippable(tile)) continue;
      if (tile === "correct") {
        knownGreen.set(p, c);
      } else if (tile === "misplaced") {
        knownWrongPos.add(`${c}@${p}`);
      } else {
        const presentElsewhere = word
          .split("")
          .some(
            (ch, q) =>
              ch === c && (row[q] === "correct" || row[q] === "misplaced")
          );
        if (!presentElsewhere) absentLetters.add(c);
      }
    }
  }
  return cols;
}

// Known letters left unused on guess `gi`, each highlighted at its EARLIEST appearance (the first
// guess where it showed up misplaced). Mirrors neglectByGuess: a letter counts as known once it has
// been seen yellow, and is neglected on a guess that omits it while it is still unplaced. The
// server's `letterProbeable` waiver (which needs the probe pool) is not reproduced here, so this can
// point at a letter whose omission was actually forced; the highlight still names the known letter
// the note is about. The winning guess of a won game placed the answer, so its omissions are never
// neglect (matching the scoring helper).
function neglectCells(
  guesses: string[],
  feedback: LetterFeedback[][],
  gi: number,
  won: boolean
): NoteCell[] {
  if (gi < 1) return [];
  if (won && gi === guesses.length - 1) return [];
  // Knowledge entering guess gi, built from every earlier guess: which letters were seen yellow (and
  // where first), and which have since been locked green.
  const knownPresent = new Set<string>();
  const placed = new Set<string>();
  const firstYellow = new Map<string, NoteCell>();
  for (let i = 0; i < gi; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "misplaced") {
        knownPresent.add(word[p]);
        if (!firstYellow.has(word[p])) firstYellow.set(word[p], { row: i, col: p });
      }
    }
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "correct") placed.add(word[p]);
    }
  }
  const wordGi = guesses[gi] ?? "";
  const cells: NoteCell[] = [];
  for (const c of knownPresent) {
    if (placed.has(c) || wordGi.includes(c)) continue;
    const cell = firstYellow.get(c);
    if (cell) cells.push(cell);
  }
  return cells;
}

// Columns in row `gi` matching a predicate on the tile's feedback.
function colsWhere(
  feedback: LetterFeedback[][],
  gi: number,
  pred: (t: LetterFeedback | undefined) => boolean
): number[] {
  const row = feedback[gi] ?? [];
  const cols: number[] = [];
  for (let p = 0; p < row.length; p++) if (pred(row[p])) cols.push(p);
  return cols;
}

/**
 * Resolve a score note's `key` (see CONTRIBUTION_LABELS / FRAME_LABELS) to the board cells it refers
 * to. Most keys land on row `gi`; `neglect` points at an omitted letter's earliest appearance on an
 * earlier row. Returns an empty array for keys with no per-tile meaning (length) or when the game
 * state is missing, in which case the note is rendered as plain text.
 */
export function noteTiles(
  key: string,
  gi: number,
  guesses: string[],
  feedback: LetterFeedback[][],
  won: boolean
): NoteCell[] {
  const row = feedback[gi] ?? [];
  // Tiles that live on row `gi`: wrap the column list in that row's index.
  const onGuessRow = (cols: number[]): NoteCell[] =>
    cols.map((col) => ({ row: gi, col }));
  switch (key) {
    // Opener grade lines.
    case "openerGram":
      return onGuessRow(colsWhere(feedback, gi, isGramTile));
    case "openerLetters":
      return onGuessRow(
        row.reduce<number[]>((cols, t, p) => {
          if (!isSkippable(t)) cols.push(p);
          return cols;
        }, [])
      );
    case "openerLength":
      return onGuessRow(
        row.reduce<number[]>((cols, t, p) => {
          if (t !== "blank") cols.push(p);
          return cols;
        }, [])
      );
    // Per-guess skill items.
    case "deduction":
      return deductionCells(guesses, feedback, gi);
    case "coldPlacement":
      return onGuessRow(placementCols(guesses, feedback, gi, false));
    case "breadth":
      return onGuessRow(newTestedCols(guesses, feedback, gi, won));
    case "waste":
      return onGuessRow(wastedCols(guesses, feedback, gi));
    case "heldGreen":
      return onGuessRow(
        colsWhere(feedback, gi, (t) => t === "correct" || t === "gramCorrect")
      );
    case "foundGram":
      return onGuessRow(colsWhere(feedback, gi, (t) => t === "gramCorrect"));
    case "gramDeduction":
    case "gramStagnation":
      return onGuessRow(colsWhere(feedback, gi, isGramTile));
    case "positionDeduction":
      return positionRuledOutCells(guesses, feedback, gi);
    case "neglect":
      return neglectCells(guesses, feedback, gi, won);
    // shortGuess (missing letters the guess did NOT play) has no cells to point at, so it falls
    // through to an empty list and renders as plain, non-interactive text.
    default:
      return [];
  }
}
