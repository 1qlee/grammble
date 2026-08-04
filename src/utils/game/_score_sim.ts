import { decomposeScore } from "./score";
import { computeFeedback } from "./feedback";
import { getAnswerList } from "./answer-list";
import { getGuessSet } from "./word-list";
import type { LetterFeedback } from "./types";

// Dev-only Monte Carlo calibration harness for the running-ledger scoring model. Plays real
// 6-letter games with two player archetypes (good = full elimination, sloppy = green-only +
// short guesses) and reports the score distribution bucketed by guess count, plus the Moderate
// overlap check (a great slow win vs a sloppy fast win). Run: pnpm tsx src/utils/game/_score_sim.ts

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(1234567);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

function distinct(w: string): number {
  return new Set(w.split("")).size;
}

function feedbackKey(f: LetterFeedback[]): string {
  return f.join(",");
}

// A candidate hidden word is still possible if the guess would have produced the same feedback
// against it as it did against the true answer.
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

// Green positions the feedback pins down, as a map index -> letter (for the sloppy green-only filter).
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

function playGood(answer: string, gram: string, pool6: string[]): Sim {
  let cands = pool6.slice();
  const guesses: string[] = [];
  const feedback: LetterFeedback[][] = [];
  for (let turn = 0; turn < 6; turn++) {
    let guess: string;
    if (turn === 0) {
      // Opener: the consistent word testing the most distinct letters (a strong opener).
      guess = cands.reduce((a, b) => (distinct(b) > distinct(a) ? b : a));
    } else {
      guess = pick(cands);
    }
    guesses.push(guess);
    const f = computeFeedback(guess, answer, gram);
    feedback.push(f);
    if (guess === answer) return { guesses, feedback, won: true };
    cands = cands.filter((c) => c !== guess && consistent(guess, f, c, gram));
    if (cands.length === 0) cands = pool6.filter((c) => !guesses.includes(c));
  }
  return { guesses, feedback, won: guesses[guesses.length - 1] === answer };
}

function playSloppy(answer: string, gram: string, valid: string[]): Sim {
  const guesses: string[] = [];
  const feedback: LetterFeedback[][] = [];
  const greens = new Map<number, string>();
  for (let turn = 0; turn < 6; turn++) {
    // Green-only filter: keep words matching known greens; ignore yellows/grays entirely.
    let choices = valid.filter(
      (w) => !guesses.includes(w) && [...greens].every(([i, c]) => w[i] === c)
    );
    if (choices.length === 0)
      choices = valid.filter((w) => !guesses.includes(w));
    // 30% of the time grab a short word even when a full-length one is available (sloppy).
    if (rng() < 0.3) {
      const shorts = choices.filter((w) => w.length < 6);
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

// Answer-length candidates still consistent with the feedback entering each guess -- the same signal
// candidatePoolByGuess computes server-side, recreated here from the trial's own guesses/feedback so
// the sim exercises the exploration relief. universe6 is the answer-length gram words (the pool a
// player reasons over); the true answer is always among them.
function poolByGuessSim(
  guesses: string[],
  feedback: LetterFeedback[][],
  gram: string,
  universe6: string[]
): number[] {
  let cands = universe6.slice();
  const out: number[] = [];
  for (let i = 0; i < guesses.length; i++) {
    out.push(cands.length);
    cands = cands.filter((c) => consistent(guesses[i], feedback[i], c, gram));
  }
  return out;
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

function report(label: string, scores: number[]) {
  const s = scores.slice().sort((a, b) => a - b);
  const med = pct(s, 50);
  console.log(
    `${label.padEnd(16)} n=${String(s.length).padStart(4)}  ` +
      `p10=${pct(s, 10)}  med=${med}  p90=${pct(s, 90)}  min=${s[0]}  max=${s[s.length - 1]}`
  );
}

async function main() {
  const mode = "SIX" as const;
  const answers = await getAnswerList(mode);
  const guessSet = await getGuessSet(mode);
  const guessArr = [...guessSet];

  // Enumerate grams that have a decent answer pool.
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

  const goodByN: Record<number, number[]> = {};
  const sloppyByN: Record<number, number[]> = {};
  const goodLoss: number[] = [];
  const sloppyLoss: number[] = [];
  // Skill component (score minus frame) per archetype, all buckets pooled: shows how much room the
  // skill axis has to lift a good slow game and sink a sloppy one, which is what drives the overlap.
  const goodSkill: number[] = [];
  const sloppySkill: number[] = [];

  const TRIALS = 4000;
  for (let t = 0; t < TRIALS; t++) {
    const gram = pick(grams);
    const pool6 = answers.filter((w) => w.includes(gram));
    if (pool6.length < 4) continue;
    const validGuesses = guessArr.filter(
      (w) => w.length >= 4 && w.length <= 6 && w.includes(gram)
    );
    if (validGuesses.length < 6) continue;
    const answer = pick(pool6);
    // The pool a player reasons over: answer-length gram words (the answer always among them).
    const universe6 = validGuesses.filter((w) => w.length === 6);
    if (!universe6.includes(answer)) universe6.push(answer);

    for (const [play, byN, loss, skills] of [
      [playGood(answer, gram, pool6), goodByN, goodLoss, goodSkill] as const,
      [
        playSloppy(answer, gram, validGuesses),
        sloppyByN,
        sloppyLoss,
        sloppySkill,
      ] as const,
    ]) {
      const breakdown = decomposeScore({
        guesses: play.guesses,
        feedback: play.feedback,
        won: play.won,
        wordLength: answer.length,
        poolByGuess: poolByGuessSim(
          play.guesses,
          play.feedback,
          gram,
          universe6
        ),
      });
      skills.push(breakdown.skill);
      if (play.won) (byN[play.guesses.length] ??= []).push(breakdown.total);
      else loss.push(breakdown.total);
    }
  }

  console.log("=== GOOD player (full elimination) ===");
  for (let k = 1; k <= 6; k++) if (goodByN[k]) report(`win-${k}`, goodByN[k]);
  report("loss", goodLoss);
  console.log("=== SLOPPY player (green-only + shorts) ===");
  for (let k = 1; k <= 6; k++)
    if (sloppyByN[k]) report(`win-${k}`, sloppyByN[k]);
  report("loss", sloppyLoss);
  console.log("=== Skill spread (all buckets pooled) ===");
  report("good-skill", goodSkill);
  report("sloppy-skill", sloppySkill);

  const great5 = (goodByN[5] ?? []).slice().sort((a, b) => a - b);
  const sloppy3 = (sloppyByN[3] ?? []).slice().sort((a, b) => a - b);
  console.log("=== Moderate overlap check ===");
  console.log(
    `great-5 p90=${pct(great5, 90)} (max ${great5[great5.length - 1]}) vs ` +
      `sloppy-3 p10=${pct(sloppy3, 10)} (min ${sloppy3[0]})`
  );
}

main();
