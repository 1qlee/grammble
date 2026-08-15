import { computeFeedback } from "./feedback";
import { getAnswerList } from "./answer-list";
import { getGuessSet } from "./word-list";
import type { LetterFeedback } from "./types";
import {
  GAME_MODES,
  GUESS_MAX_LENGTH_BY_MODE,
  GUESS_MIN_LENGTH_BY_MODE,
  WORD_LENGTH_BY_MODE,
  type GameMode,
} from "./constants";

// Dev-only prototype for a STANDALONE luck metric that does NOT touch the score. Luck here is
// "expected vs actual field collapse", holding the player's guesses fixed and varying only the
// hidden answer over the real answer pool:
//
//   For each guess, partition the still-possible ANSWERS by the feedback that guess would produce.
//   Under a uniform-random answer, the expected size of the surviving group is E = sum(n_j^2)/N.
//   The real answer actually landed in a group of size A. If A < E the board collapsed the field
//   MORE than your guess statistically deserved -> lucky. We score that as log2(E/A) bits, summed
//   over guesses. It is orthogonal to skill: a better guess lowers E (that is skill), luck is only
//   the deviation of the realised A from E.
//
// Calibrates every mode: for SIX/SEVEN/EIGHT it plays the three archetypes over that mode's real
// lists and prints the pooled distribution's tier boundaries [p10,p30,p70,p90] (paste into luck.ts
// LUCK_TIERS), plus two validity checks per mode:
//   1. good vs sloppy medians should be SIMILAR (luck is orthogonal to skill).
//   2. finish luck should correlate POSITIVELY with solvedWith (winning from many left = lucky).
// Bits do not scale uniformly with pool size, so each mode's boundaries differ; that is why the
// table is per mode rather than one shared curve.
//
// Run: pnpm tsx src/utils/game/_luck_probe.ts

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(987654321);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

function distinct(w: string): number {
  return new Set(w.split("")).size;
}

function feedbackKey(f: LetterFeedback[]): string {
  return f.join(",");
}

function consistent(
  guess: string,
  actual: LetterFeedback[],
  candidate: string,
  gram: string
): boolean {
  try {
    return (
      feedbackKey(computeFeedback(guess, candidate, gram)) ===
      feedbackKey(actual)
    );
  } catch {
    return false;
  }
}

// Informative non-gram tiles: greens weigh more than yellows (a placed letter narrows harder).
// The gram tiles are given every game, so they carry no clue and are excluded.
function clueYield(f: LetterFeedback[]): number {
  let y = 0;
  for (const t of f) {
    if (t === "correct") y += 1.5;
    else if (t === "misplaced") y += 1;
  }
  return y;
}

function greensOf(guess: string, f: LetterFeedback[]): Map<number, string> {
  const m = new Map<number, string>();
  f.forEach((t, i) => {
    if (t === "correct" || t === "gramCorrect") m.set(i, guess[i]);
  });
  return m;
}

interface Sim {
  guesses: string[];
  feedback: LetterFeedback[][];
  won: boolean;
}

function playGood(answer: string, gram: string, pool: string[]): Sim {
  let cands = pool.slice();
  const guesses: string[] = [];
  const feedback: LetterFeedback[][] = [];
  for (let turn = 0; turn < 6; turn++) {
    let guess: string;
    if (turn === 0) {
      guess = cands.reduce((a, b) => (distinct(b) > distinct(a) ? b : a));
    } else {
      guess = pick(cands);
    }
    guesses.push(guess);
    const f = computeFeedback(guess, answer, gram);
    feedback.push(f);
    if (guess === answer) return { guesses, feedback, won: true };
    cands = cands.filter((c) => c !== guess && consistent(guess, f, c, gram));
    if (cands.length === 0) cands = pool.filter((c) => !guesses.includes(c));
  }
  return { guesses, feedback, won: guesses[guesses.length - 1] === answer };
}

// A rusher: narrows loosely on greens, but from turn 2 on it STABS at a random full-length
// green-consistent word instead of probing. This wins from a wide field when it gets lucky (and
// wastes guesses when it does not), exercising the "finish luck" the careful archetypes never hit.
function playRusher(answer: string, gram: string, valid: string[]): Sim {
  const guesses: string[] = [];
  const feedback: LetterFeedback[][] = [];
  const greens = new Map<number, string>();
  for (let turn = 0; turn < 6; turn++) {
    let choices = valid.filter(
      (w) =>
        w.length === answer.length &&
        !guesses.includes(w) &&
        [...greens].every(([i, c]) => w[i] === c)
    );
    if (choices.length === 0)
      choices = valid.filter((w) => !guesses.includes(w));
    const guess = pick(choices);
    guesses.push(guess);
    const f = computeFeedback(guess, answer, gram);
    feedback.push(f);
    if (guess === answer) return { guesses, feedback, won: true };
    for (const [i, c] of greensOf(guess, f)) greens.set(i, c);
  }
  return { guesses, feedback, won: guesses[guesses.length - 1] === answer };
}

function playSloppy(
  answer: string,
  gram: string,
  valid: string[],
  wordLength: number
): Sim {
  const guesses: string[] = [];
  const feedback: LetterFeedback[][] = [];
  const greens = new Map<number, string>();
  for (let turn = 0; turn < 6; turn++) {
    let choices = valid.filter(
      (w) => !guesses.includes(w) && [...greens].every(([i, c]) => w[i] === c)
    );
    if (choices.length === 0)
      choices = valid.filter((w) => !guesses.includes(w));
    if (rng() < 0.3) {
      const shorts = choices.filter((w) => w.length < wordLength);
      if (shorts.length) choices = shorts;
    }
    const guess = pick(choices);
    guesses.push(guess);
    const f = computeFeedback(guess, answer, gram);
    feedback.push(f);
    if (guess === answer) return { guesses, feedback, won: true };
    for (const [i, c] of greensOf(guess, f)) greens.set(i, c);
  }
  return { guesses, feedback, won: guesses[guesses.length - 1] === answer };
}

interface PerGuessLuck {
  guess: string;
  before: number; // answers still possible entering this guess
  expected: number; // E = expected surviving group size under a uniform answer
  actual: number; // A = the group the real answer fell into
  bits: number; // log2(E/A): positive = luckier than the guess deserved
  clue: number; // actual clue yield minus expected clue yield
  isWin: boolean;
}

interface GameLuck {
  bits: number; // total luck across the game
  bitsExclWin: number; // narrowing luck only (excludes the final guessing-luck)
  clue: number; // total clue-yield luck
  solvedWith: number | null; // answers left entering the winning guess (null on loss)
  perGuess: PerGuessLuck[];
}

// The real answer prior for the day: full-length answers that contain the gram. Luck is measured
// against THIS set, because a guessable word that is not a real answer was never the hidden word
// and should not dilute the expectation.
function gameLuck(game: Sim, gram: string, answerPool: string[]): GameLuck {
  let survivors = answerPool.slice();
  let bits = 0;
  let bitsExclWin = 0;
  let clue = 0;
  let solvedWith: number | null = null;
  const perGuess: PerGuessLuck[] = [];

  for (let i = 0; i < game.guesses.length; i++) {
    const fb = game.feedback[i];
    if (!fb) break;
    const g = game.guesses[i].toUpperCase();
    const before = survivors.length;
    const isWin = game.won && i === game.guesses.length - 1;
    if (isWin) solvedWith = before;

    // Partition the surviving answers by the feedback g would produce against each.
    const groups = new Map<string, number>();
    let expClue = 0;
    let total = 0;
    for (const cand of survivors) {
      let f: LetterFeedback[];
      try {
        f = computeFeedback(g, cand, gram);
      } catch {
        continue;
      }
      const key = feedbackKey(f);
      groups.set(key, (groups.get(key) ?? 0) + 1);
      expClue += clueYield(f);
      total++;
    }
    let sumSq = 0;
    for (const n of groups.values()) sumSq += n * n;
    const expected = total > 0 ? sumSq / total : 1;
    const actual = groups.get(feedbackKey(fb)) ?? 1;
    const lb = Math.log2(expected / Math.max(1, actual));
    const clueDelta = clueYield(fb) - (total > 0 ? expClue / total : 0);

    bits += lb;
    if (!isWin) bitsExclWin += lb;
    clue += clueDelta;
    perGuess.push({
      guess: g,
      before,
      expected,
      actual,
      bits: lb,
      clue: clueDelta,
      isWin,
    });

    survivors = survivors.filter((c) => c !== g && consistent(g, fb, c, gram));
  }

  return { bits, bitsExclWin, clue, solvedWith, perGuess };
}

function pctl(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

const r2 = (x: number) => Math.round(x * 100) / 100;

function report(label: string, vals: number[]) {
  const s = vals.slice().sort((a, b) => a - b);
  console.log(
    `${label.padEnd(16)} n=${String(s.length).padStart(4)}  ` +
      `p10=${r2(pctl(s, 10))}  med=${r2(pctl(s, 50))}  p90=${r2(pctl(s, 90))}  ` +
      `min=${r2(s[0])}  max=${r2(s[s.length - 1])}`
  );
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

// The tier boundaries we bake into luck.ts: the bits at these percentiles split the five fortune
// tiers (very-unlucky <p10, unlucky <p30, average <=p70, lucky <=p90, very-lucky above). Printed
// per mode so the calibration table is a copy-paste of four numbers each.
const TIER_QUANTILES = [10, 30, 70, 90];

// Runs one mode: the same three archetypes over the mode's real answer/guess lists, returns the
// pooled luck distribution's tier boundaries plus the two validity checks (orthogonality: good ~=
// sloppy; finish luck correlates with solvedWith).
async function calibrate(mode: GameMode) {
  const answers = await getAnswerList(mode);
  const guessArr = [...(await getGuessSet(mode))];
  const wordLength = WORD_LENGTH_BY_MODE[mode];
  const minLen = GUESS_MIN_LENGTH_BY_MODE[mode];
  const maxLen = GUESS_MAX_LENGTH_BY_MODE[mode];

  const gramCount = new Map<string, number>();
  for (const w of answers) {
    const seen = new Set<string>();
    for (let i = 0; i < w.length - 1; i++) {
      const g = w.slice(i, i + 2);
      if (!seen.has(g)) {
        seen.add(g);
        gramCount.set(g, (gramCount.get(g) ?? 0) + 1);
      }
    }
  }
  const grams = [...gramCount.entries()]
    .filter(([, c]) => c >= 8)
    .map(([g]) => g);

  const goodBits: number[] = [];
  const sloppyBits: number[] = [];
  const rusherBits: number[] = [];
  const winFinishBits: number[] = [];
  const winSolvedWithLog: number[] = [];

  const TRIALS = 4000;
  for (let t = 0; t < TRIALS; t++) {
    const gram = pick(grams);
    const pool = answers.filter((w) => w.includes(gram));
    if (pool.length < 4) continue;
    const valid = guessArr.filter(
      (w) => w.length >= minLen && w.length <= maxLen && w.includes(gram)
    );
    if (valid.length < 6) continue;
    const answer = pick(pool);

    const good = playGood(answer, gram, pool);
    const sloppy = playSloppy(answer, gram, valid, wordLength);
    const rusher = playRusher(answer, gram, valid);
    const goodLuck = gameLuck(good, gram, pool);
    const sloppyLuck = gameLuck(sloppy, gram, pool);
    const rusherLuck = gameLuck(rusher, gram, pool);

    goodBits.push(goodLuck.bits);
    sloppyBits.push(sloppyLuck.bits);
    rusherBits.push(rusherLuck.bits);

    for (const [game, luck] of [
      [good, goodLuck] as const,
      [sloppy, sloppyLuck] as const,
      [rusher, rusherLuck] as const,
    ]) {
      if (game.won && luck.solvedWith != null) {
        winFinishBits.push(luck.bits - luck.bitsExclWin);
        winSolvedWithLog.push(Math.log2(luck.solvedWith));
      }
    }
  }

  const pooled = [...goodBits, ...sloppyBits, ...rusherBits].sort(
    (a, b) => a - b
  );
  const boundaries = TIER_QUANTILES.map((q) => r2(pctl(pooled, q)));

  console.log(`\n=== ${mode} (word length ${wordLength}) ===`);
  console.log(
    `  tier boundaries [p10,p30,p70,p90] = [${boundaries.join(", ")}]`
  );
  report("  good", goodBits);
  report("  sloppy", sloppyBits);
  report("  rusher", rusherBits);
  console.log(
    `  orthogonality: good med ${r2(
      pctl(
        goodBits.slice().sort((a, b) => a - b),
        50
      )
    )} ` +
      `vs sloppy med ${r2(
        pctl(
          sloppyBits.slice().sort((a, b) => a - b),
          50
        )
      )} (want ~equal)`
  );
  console.log(
    `  corr(FINISH luck, log2 solvedWith) = ${r2(
      pearson(winFinishBits, winSolvedWithLog)
    )} (want strongly positive)`
  );
  return boundaries;
}

async function main() {
  const table: Record<string, number[]> = {};
  for (const mode of GAME_MODES) table[mode] = await calibrate(mode);
  console.log("\n=== Paste into luck.ts LUCK_TIERS ===");
  for (const mode of GAME_MODES) {
    console.log(`  ${mode}: [${table[mode].join(", ")}],`);
  }
}

main();
