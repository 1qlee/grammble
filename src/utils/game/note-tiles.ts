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

// A single board tile: a column in a guess row. `origin` marks a cell that is the SOURCE a note
// points back to on an earlier row (the locked green a later guess overwrote), so the board can give
// it a distinct, heavier border to set it apart from the note's own guess-row tiles.
export interface NoteCell {
  row: number;
  col: number;
  origin?: boolean;
}

const isGramTile = (t: LetterFeedback | undefined): boolean =>
  t === "gramCorrect" || t === "gramMisplaced";

const isSkippable = (t: LetterFeedback | undefined): boolean =>
  isGramTile(t) || t === "blank";

// Non-gram green (correct) placements in `gi`, split by whether the letter had shown up yellow on an
// earlier guess (deduction) or never had (coldPlacement). Mirrors deductionsByGuess /
// coldPlacementsByGuess: each distinct letter is attributed once, at its first green.
// Mirrors score.ts classifyGreenPlacements PER INSTANCE (see that helper for the model): each fresh
// green consumes one confirmed-present instance of its letter as a deduction, and greens beyond the
// known count are cold. A letter appearing green twice with only one prior yellow yields one deduction
// col and one cold col -- the old `counted`-by-letter walk highlighted only one of the two.
function placementCols(
  guesses: string[],
  feedback: LetterFeedback[][],
  gi: number,
  wantDeduction: boolean
): number[] {
  const knownPresent = new Map<string, number>();
  const assignedGreens = new Map<string, number>();
  const lockedPos = new Set<number>();
  const cols: number[] = [];
  for (let i = 0; i <= gi; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      if (row[p] !== "correct" || lockedPos.has(p)) continue;
      const c = word[p];
      const seen = assignedGreens.get(c) ?? 0;
      const isDeduction = seen < (knownPresent.get(c) ?? 0);
      if (isDeduction === wantDeduction && i === gi) cols.push(p);
      assignedGreens.set(c, seen + 1);
    }
    const nonAbsent = new Map<string, number>();
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "misplaced" || row[p] === "correct")
        nonAbsent.set(word[p], (nonAbsent.get(word[p]) ?? 0) + 1);
      if (row[p] === "correct") lockedPos.add(p);
    }
    for (const [c, cnt] of nonAbsent)
      knownPresent.set(c, Math.max(knownPresent.get(c) ?? 0, cnt));
  }
  return cols;
}

// Deduction cells for row `gi`: each letter placed green on `gi` that had shown up yellow on an
// earlier guess, paired with the earliest cell where that yellow clue appeared, so the highlight
// reads as a deduction (the prior clue and the lock it earned) rather than an indistinguishable
// green, and spans the originating row like neglect does.
//
// This must mirror score.ts classifyGreenPlacements EXACTLY, PER INSTANCE: each fresh green consumes
// one confirmed-present instance of its letter as a deduction, and greens beyond the known count are
// cold (not highlighted here). A letter locked green early, later seen yellow in another slot, and
// re-placed green still counts as a deduction on that later guess. Duplicate letters are paired
// individually: two E greens deduced against a prior E yellow each highlight, sharing the one yellow
// origin. (The old `counted`-by-letter walk credited each letter once, leaving a duplicate's second
// instance with no tiles.)
function deductionCells(
  guesses: string[],
  feedback: LetterFeedback[][],
  gi: number
): NoteCell[] {
  const firstYellow = new Map<string, NoteCell>();
  const knownPresent = new Map<string, number>();
  const assignedGreens = new Map<string, number>();
  const lockedPos = new Set<number>();
  const cells: NoteCell[] = [];
  for (let i = 0; i <= gi; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      if (row[p] !== "correct" || lockedPos.has(p)) continue;
      const c = word[p];
      const seen = assignedGreens.get(c) ?? 0;
      if (seen < (knownPresent.get(c) ?? 0) && i === gi) {
        cells.push({ row: gi, col: p });
        const origin = firstYellow.get(c);
        if (origin) cells.push(origin);
      }
      assignedGreens.set(c, seen + 1);
    }
    const nonAbsent = new Map<string, number>();
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "misplaced" && !firstYellow.has(word[p]))
        firstYellow.set(word[p], { row: i, col: p });
      if (row[p] === "misplaced" || row[p] === "correct")
        nonAbsent.set(word[p], (nonAbsent.get(word[p]) ?? 0) + 1);
      if (row[p] === "correct") lockedPos.add(p);
    }
    for (const [c, cnt] of nonAbsent)
      knownPresent.set(c, Math.max(knownPresent.get(c) ?? 0, cnt));
  }
  return cells;
}

// Wrong letter-positions ruled out on `gi`: a letter ALREADY known present (seen yellow on an earlier
// guess) replayed at a slot never previously ruled out and still yellow. Mirrors
// positionRuledOutByGuess (knowledge read ENTERING each guess, folded in AFTER), so the highlight
// lands on the exact tiles that earned "Ruled out a wrong letter spot" -- never a letter's first
// yellow (its discovery, credited by breadth) nor a green (a deduction).
//
// Each ruled-out tile in row `gi` is PAIRED with that same letter's earliest yellow appearance on an
// earlier row (tagged `origin`, so it gets a heavier border): the prior sighting is what made this a
// KNOWN letter whose new wrong slot the guess ruled out, so highlighting it makes the deduction read
// as "you already knew this E was in the word, and here you learned it's not in this spot either".
function positionRuledOutCells(
  guesses: string[],
  feedback: LetterFeedback[][],
  gi: number
): NoteCell[] {
  const everYellow = new Set<string>();
  const firstYellow = new Map<string, NoteCell>();
  const knownWrongPos = new Set<string>();
  const cells: NoteCell[] = [];
  for (let i = 0; i <= gi; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      if (row[p] !== "misplaced") continue;
      const c = word[p];
      if (i === gi && everYellow.has(c) && !knownWrongPos.has(`${c}@${p}`)) {
        cells.push({ row: gi, col: p });
        const origin = firstYellow.get(c);
        if (origin) cells.push(origin);
      }
    }
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "misplaced") {
        everYellow.add(word[p]);
        if (!firstYellow.has(word[p]))
          firstYellow.set(word[p], { row: i, col: p, origin: true });
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

// Wasted non-gram tiles in `gi`, split to match wastedByGuess's two kinds: `dead` re-tests known-BAD
// info (a known-absent letter, or a letter on a position already ruled out for it), while `overwrite`
// discards known-GOOD info (a different letter played on a slot already locked green). The two are
// labeled as separate notes ("Re-tested dead letters" vs "Overwrote a locked-in letter").
//
// Both are full cell lists: the re-testing / overwriting tile in row `gi`, PAIRED with the earlier
// tile that established the info being ignored (tagged `origin`, so it gets a darker border) -- for a
// dead letter, where it last showed gray (or the slot last ruled out); for an overwrite, the most
// recent prior guess that showed the green played over.
function wastedCells(
  guesses: string[],
  feedback: LetterFeedback[][],
  gi: number
): { dead: NoteCell[]; overwrite: NoteCell[] } {
  if (gi < 1) return { dead: [], overwrite: [] };
  const knownGreen = new Map<number, string>();
  const greenRow = new Map<number, number>();
  // Where each known-absent letter last showed gray, and where each ruled-out letter@position last
  // showed yellow: the origin tile the "re-tested dead letters" note points back to.
  const absentCell = new Map<string, NoteCell>();
  const wrongPosCell = new Map<string, NoteCell>();
  const dead: NoteCell[] = [];
  const overwrite: NoteCell[] = [];
  for (let i = 0; i <= gi; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    if (i === gi) {
      for (let p = 0; p < word.length; p++) {
        if (isSkippable(row[p])) continue;
        const c = word[p];
        if (knownGreen.has(p) && knownGreen.get(p) !== c) {
          overwrite.push({ row: gi, col: p });
          const orow = greenRow.get(p);
          if (orow !== undefined)
            overwrite.push({ row: orow, col: p, origin: true });
        }
        // A ruled-out position is the more specific evidence, so prefer its tile as the origin;
        // otherwise fall back to where the letter last showed gray.
        const origin = wrongPosCell.get(`${c}@${p}`) ?? absentCell.get(c);
        if (origin) {
          dead.push({ row: gi, col: p });
          dead.push({ ...origin, origin: true });
        }
      }
    }
    for (let p = 0; p < word.length; p++) {
      const c = word[p];
      const tile = row[p];
      if (isSkippable(tile)) continue;
      if (tile === "correct") {
        knownGreen.set(p, c);
        greenRow.set(p, i);
      } else if (tile === "misplaced") {
        wrongPosCell.set(`${c}@${p}`, { row: i, col: p });
      } else {
        const presentElsewhere = word
          .split("")
          .some(
            (ch, q) =>
              ch === c && (row[q] === "correct" || row[q] === "misplaced")
          );
        if (!presentElsewhere) absentCell.set(c, { row: i, col: p });
      }
    }
  }
  return { dead, overwrite };
}

// Greens on row `gi` that were ALREADY locked green on an earlier guess -- the frame CARRIED into this
// guess, as opposed to a green freshly placed here. The score's heldGreen counts every green on the
// row in its "green mass", but the note's label is "held your locked letters": a letter placed green
// for the FIRST time on `gi` (a deduction or a cold placement, each already highlighted by its own
// note) is NOT a held letter, and showing it here would contradict that note on the very same tile. A
// letter counts as held once it has shown green on any earlier guess. Tracked by letter, not position,
// so the exclusion of a letter's first green is total and can never overlap deduction/coldPlacement.
function heldGreenCols(
  guesses: string[],
  feedback: LetterFeedback[][],
  gi: number
): number[] {
  const wasGreen = new Set<string>();
  for (let i = 0; i < gi; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "correct" || row[p] === "gramCorrect") wasGreen.add(word[p]);
    }
  }
  const word = guesses[gi] ?? "";
  const row = feedback[gi] ?? [];
  const cols: number[] = [];
  for (let p = 0; p < word.length; p++) {
    if (
      (row[p] === "correct" || row[p] === "gramCorrect") &&
      wasGreen.has(word[p])
    )
      cols.push(p);
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
      return wastedCells(guesses, feedback, gi).dead;
    case "wasteGreen":
      return wastedCells(guesses, feedback, gi).overwrite;
    case "heldGreen":
      return onGuessRow(heldGreenCols(guesses, feedback, gi));
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
