import { GRAM_LENGTH } from "~/utils/game/constants";
import type { LetterFeedback } from "~/utils/game/types";
import {
  type Availability,
  freshGramPositionReachable,
  guessWord,
  letterProbeable,
} from "~/utils/game/availability";

// Rule-based gameplay analysis. Derives human-readable observations about a
// finished game from the guesses + feedback the client already holds, so no
// server round-trip or answer word is needed. This mirrors the signals the
// server-only scoring engine (score.ts) charges and credits, but surfaces WHERE
// each one happened instead of collapsing them into a number. It deliberately
// does NOT import score.ts or its tuned weights: the analysis explains play
// quality, it does not recompute the score.

export type ObservationType =
  | "deduction"
  | "gramTriangulation"
  | "cleanFinish"
  | "efficientWin"
  | "broadTesting"
  | "reusedAbsent"
  | "overwroteGreen"
  | "reusedWrongSpot"
  | "neglectedLetter"
  | "gramStuck"
  | "shortGuesses";

export type ObservationPolarity = "positive" | "negative";

export interface Observation {
  type: ObservationType;
  polarity: ObservationPolarity;
  // Ranking priority; higher observations are shown first and win the top-N cut.
  weight: number;
  // How many times the pattern occurred across the game.
  count: number;
  // Representative instance detail for the phrase templates.
  letter?: string;
  guessNumber?: number;
}

export type SummaryBucket =
  | "ace"
  | "greatWin"
  | "solidWin"
  | "scrappyWin"
  | "closeLoss"
  | "toughLoss";

export interface GameAnalysis {
  outcome: "won" | "lost";
  guessCount: number;
  summary: SummaryBucket;
  positives: Observation[];
  negatives: Observation[];
  // Stable per-game value used to vary phrasing deterministically.
  seed: string;
}

const MAX_PER_SIDE = 3;

const isGreen = (t: LetterFeedback | undefined) => t === "correct";
const isYellow = (t: LetterFeedback | undefined) => t === "misplaced";
const isGramTile = (t: LetterFeedback | undefined) =>
  t === "gramCorrect" || t === "gramMisplaced";

type Instance = { letter?: string; guessNumber: number };

/**
 * Wasted moves, split by kind: replaying a known-absent letter, overwriting a
 * confirmed green, and re-placing a letter in a position already ruled out for
 * it. Mirrors countWastedMoves in score.ts, but records each instance's letter
 * and guess. Gram tiles never feed letter-level tracking (the gram is a unit).
 */
function findWastedMoves(words: string[], feedback: LetterFeedback[][]) {
  const knownGreen = new Map<number, string>();
  const absent = new Set<string>();
  const knownWrongPos = new Set<string>();
  const reusedAbsent: Instance[] = [];
  const overwroteGreen: Instance[] = [];
  const reusedWrongSpot: Instance[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const row = feedback[i] ?? [];

    if (i > 0) {
      for (let p = 0; p < word.length; p++) {
        const tile = row[p];
        if (isGramTile(tile) || tile === "blank") continue;
        const c = word[p];
        if (knownGreen.has(p) && knownGreen.get(p) !== c)
          overwroteGreen.push({ letter: c, guessNumber: i + 1 });
        if (absent.has(c)) reusedAbsent.push({ letter: c, guessNumber: i + 1 });
        if (knownWrongPos.has(`${c}@${p}`))
          reusedWrongSpot.push({ letter: c, guessNumber: i + 1 });
      }
    }

    for (let p = 0; p < word.length; p++) {
      const c = word[p];
      const tile = row[p];
      if (!tile || isGramTile(tile) || tile === "blank") continue;
      if (isGreen(tile)) {
        knownGreen.set(p, c);
      } else if (isYellow(tile)) {
        knownWrongPos.add(`${c}@${p}`);
      } else {
        const presentElsewhere = word
          .split("")
          .some((ch, q) => ch === c && (isGreen(row[q]) || isYellow(row[q])));
        if (!presentElsewhere) absent.add(c);
      }
    }
  }

  return { reusedAbsent, overwroteGreen, reusedWrongSpot };
}

/**
 * Letters known present (shown yellow) and not yet placed green that a later,
 * non-winning guess dropped entirely. Mirrors countNeglectedLetters in score.ts.
 */
function findNeglectedLetters(
  words: string[],
  feedback: LetterFeedback[][],
  probePool?: string[]
) {
  const knownPresent = new Set<string>();
  const placed = new Set<string>();
  const played = new Set<string>();
  const out: Instance[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const row = feedback[i] ?? [];
    const isWinningGuess = i === words.length - 1;

    if (i > 0 && !isWinningGuess) {
      for (const c of knownPresent) {
        if (placed.has(c) || word.includes(c)) continue;
        // Forced omission is not neglect: skip when no unplayed, non-answer word contains the letter.
        if (!letterProbeable(probePool, played, c)) continue;
        out.push({ letter: c, guessNumber: i + 1 });
      }
    }

    for (let p = 0; p < word.length; p++) {
      const tile = row[p];
      if (tile === "correct") placed.add(word[p]);
      else if (tile === "misplaced") knownPresent.add(word[p]);
    }
    played.add(guessWord(word));
  }

  return out;
}

/** Start index of the gram within each feedback row (-1 if somehow gram-less). */
function gramStartByGuess(feedback: LetterFeedback[][]): number[] {
  return feedback.map((row) => row.findIndex((t) => isGramTile(t)));
}

/** Re-placing the gram at a start already proven wrong. Mirrors countGramStagnation. */
function findGramStuck(
  gramStarts: number[],
  feedback: LetterFeedback[][],
  words: string[] = [],
  avail?: Availability
) {
  const knownWrong = new Set<number>();
  const played = new Set<string>();
  const out: Instance[] = [];

  for (let i = 0; i < feedback.length; i++) {
    const start = gramStarts[i];
    if (start >= 0 && feedback[i][start] === "gramMisplaced") {
      // Forced re-test is not stagnation: skip when no unplayed word could reach a fresh position.
      if (knownWrong.has(start) && freshGramPositionReachable(avail, played, knownWrong)) {
        out.push({ guessNumber: i + 1 });
      }
      knownWrong.add(start);
    }
    if (words[i] !== undefined) played.add(guessWord(words[i]));
  }

  return out;
}

/** Placements of a letter that was previously seen only as a yellow. Mirrors countDeductions. */
function findDeductions(words: string[], feedback: LetterFeedback[][]) {
  const everYellow = new Set<string>();
  const counted = new Set<string>();
  const out: Instance[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      const c = word[p];
      if (row[p] === "correct" && everYellow.has(c) && !counted.has(c)) {
        out.push({ letter: c, guessNumber: i + 1 });
        counted.add(c);
      }
    }
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "misplaced") everYellow.add(word[p]);
    }
  }

  return out;
}

/**
 * Distinct wrong gram positions eliminated AFTER the opener, before the gram is first placed.
 * Mirrors score.ts gramDeductionsByGuess: the opener's own wrong gram bet is recorded (so a later
 * re-bet reads as stuck) but not counted as triangulation, since it is already graded by openerGram.
 */
function countGramDeductions(
  gramStarts: number[],
  feedback: LetterFeedback[][],
): number {
  const wrong = new Set<number>();
  let credited = 0;
  for (let i = 0; i < feedback.length; i++) {
    const start = gramStarts[i];
    if (start < 0) continue;
    if (feedback[i][start] === "gramCorrect") return credited;
    if (feedback[i][start] === "gramMisplaced" && !wrong.has(start)) {
      if (i > 0) credited++;
      wrong.add(start);
    }
  }
  return 0;
}

/**
 * Distinct non-gram letters tested before the finish. Mirrors score.ts countTestedLetters: the
 * winning guess is excluded (it adds no new testing), but a LOSS has no winning guess, so on a
 * loss every guess counts including the last.
 */
function countTestedLetters(
  words: string[],
  feedback: LetterFeedback[][],
  won: boolean,
): number {
  const tested = new Set<string>();
  const upTo = won ? words.length - 1 : words.length;
  for (let i = 0; i < upTo; i++) {
    const word = words[i];
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      if (isGramTile(row[p]) || row[p] === "blank") continue;
      tested.add(word[p]);
    }
  }
  return tested.size;
}

/** Board certainty (gram + distinct non-gram letters known) after guess `idx`, 0..1. */
function certaintyThrough(
  idx: number,
  words: string[],
  feedback: LetterFeedback[][],
  wordLength: number,
): number {
  const known = new Set<string>();
  for (let i = 0; i <= idx; i++) {
    const word = words[i];
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      const tile = row[p];
      if (tile === "correct" || tile === "misplaced") known.add(word[p]);
    }
  }
  return Math.min(1, (GRAM_LENGTH + known.size) / wordLength);
}

/** Best fraction of the non-gram answer ever identified, 0..1. Drives loss framing. */
function bestCoverage(
  words: string[],
  feedback: LetterFeedback[][],
  slots: number,
): number {
  const known = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      const tile = row[p];
      if (tile === "correct" || tile === "misplaced") known.add(word[p]);
    }
  }
  return Math.min(1, known.size / slots);
}

function obs(
  type: ObservationType,
  polarity: ObservationPolarity,
  weight: number,
  count: number,
  first?: Instance,
): Observation {
  return {
    type,
    polarity,
    weight,
    count,
    letter: first?.letter?.toUpperCase(),
    guessNumber: first?.guessNumber,
  };
}

function summaryBucket(
  won: boolean,
  n: number,
  coverage: number,
): SummaryBucket {
  if (!won) return coverage >= 0.6 ? "closeLoss" : "toughLoss";
  if (n === 1) return "ace";
  if (n <= 3) return "greatWin";
  if (n === 4) return "solidWin";
  return "scrappyWin";
}

/**
 * Analyze a finished game into ranked positive and negative observations plus a
 * summary bucket. Returns null when there is nothing to analyze (no guesses).
 * `seedSource` should be stable per game (e.g. date + mode) so phrasing does not
 * change when the dialog is reopened.
 */
export function analyzeGame(input: {
  guesses: string[];
  feedback: LetterFeedback[][];
  won: boolean;
  wordLength: number;
  seedSource?: string;
  // The gram's valid guess words with the answer removed, so a forced omission / gram re-test is not
  // called out as a mistake. Absent -> every observation stands (matches the score's own default).
  probePool?: string[];
  gram?: string;
}): GameAnalysis | null {
  const { feedback, won, wordLength, gram, probePool } = input;
  const words = input.guesses.filter((g) => g.length > 0);
  if (words.length === 0 || feedback.length === 0) return null;

  const n = words.length;
  const slots = Math.max(1, wordLength - GRAM_LENGTH);
  const gramStarts = gramStartByGuess(feedback);
  const availability: Availability = { probePool, gram, wordLength };

  const positives: Observation[] = [];
  const negatives: Observation[] = [];

  // Positives.
  const deductions = findDeductions(words, feedback);
  if (deductions.length > 0)
    positives.push(
      obs("deduction", "positive", 6, deductions.length, deductions[0]),
    );

  const gramDeductions = countGramDeductions(gramStarts, feedback);
  if (gramDeductions > 0)
    positives.push(obs("gramTriangulation", "positive", 6, gramDeductions));

  if (won && n >= 3 && certaintyThrough(n - 2, words, feedback, wordLength) >= 0.75)
    positives.push(obs("cleanFinish", "positive", 5, 1));

  if (won && n >= 2 && n <= 3)
    positives.push(obs("efficientWin", "positive", 4, 1));

  const tested = countTestedLetters(words, feedback, won);
  if (tested >= 6) positives.push(obs("broadTesting", "positive", 3, tested));

  // Negatives.
  const { reusedAbsent, overwroteGreen, reusedWrongSpot } = findWastedMoves(
    words,
    feedback,
  );
  if (overwroteGreen.length > 0)
    negatives.push(
      obs("overwroteGreen", "negative", 5, overwroteGreen.length, overwroteGreen[0]),
    );
  if (reusedAbsent.length > 0)
    negatives.push(
      obs("reusedAbsent", "negative", 4, reusedAbsent.length, reusedAbsent[0]),
    );
  if (reusedWrongSpot.length > 0)
    negatives.push(
      obs("reusedWrongSpot", "negative", 4, reusedWrongSpot.length, reusedWrongSpot[0]),
    );

  const gramStuck = findGramStuck(gramStarts, feedback, words, availability);
  if (gramStuck.length > 0)
    negatives.push(obs("gramStuck", "negative", 3, gramStuck.length, gramStuck[0]));

  const neglected = findNeglectedLetters(words, feedback, probePool);
  if (neglected.length > 0)
    negatives.push(
      obs("neglectedLetter", "negative", 3, neglected.length, neglected[0]),
    );

  const shortCount = words.filter((w) => w.length < wordLength).length;
  if (shortCount >= 2)
    negatives.push(obs("shortGuesses", "negative", 2, shortCount));

  const byRank = (a: Observation, b: Observation) =>
    b.weight - a.weight || b.count - a.count;

  return {
    outcome: won ? "won" : "lost",
    guessCount: n,
    summary: summaryBucket(won, n, bestCoverage(words, feedback, slots)),
    positives: positives.sort(byRank).slice(0, MAX_PER_SIDE),
    negatives: negatives.sort(byRank).slice(0, MAX_PER_SIDE),
    seed: input.seedSource ?? words.join("-"),
  };
}
