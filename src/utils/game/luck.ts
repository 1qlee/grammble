import { computeFeedback } from "./feedback";
import { getAnswerList } from "./answer-list";
import type { LetterFeedback } from "./types";
import type { GameMode } from "./constants";
import type { LuckGuess, LuckResult, LuckTier } from "./recap";

// SERVER-ONLY. Measures how the board treated the player, independently of the score. Luck is
// "expected vs actual field collapse": for each guess, partition the still-possible ANSWERS by the
// feedback that guess would produce; under a uniform-random answer the expected surviving group has
// size E = sum(n_j^2)/N; the real answer landed in a group of size A. The luck of that guess is
// log2(E/A) bits -- positive when the field collapsed MORE than the guess statistically earned.
//
// This is orthogonal to skill by construction: a stronger guess lowers E (that is skill, not
// counted here), and luck is only the deviation of the realised A from E. It reasons over the real
// ANSWER pool (not the guess pool), because a guessable word that is not a real answer was never
// the hidden word and must not dilute the expectation -- so this loads getAnswerList and must not
// be imported by the client. The result never feeds computePuzzleScore; it is pure end-of-game
// colour (see recap.ts LuckResult).

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

// Per-mode fortune tier boundaries, in luck bits, from a Monte Carlo over each mode's real lists
// (see _luck_probe.ts). The four cutoffs are the pooled distribution's [p10, p30, p70, p90]; a
// game's total bits fall into one of five tiers: below p10 very-unlucky, below p30 unlucky, up to
// p70 average, up to p90 lucky, above very-lucky. Bits do NOT scale uniformly with pool size -- a
// larger answer pool partitions finer and yields a TIGHTER distribution (EIGHT's p90 is below SIX's)
// -- so every mode needs its own boundaries. These are deliberately coarse: the cutoffs rest on a
// synthetic archetype distribution, which is honest for a "were you lucky" label but would not be
// for a precise per-player percentile (there is no real playerbase to rank against). Keep `bits`
// around so a genuine percentile can be added later, from logged games, if a playerbase appears.
const LUCK_TIERS: Record<GameMode, readonly [number, number, number, number]> =
  {
    SIX: [-1.13, -0.21, 1.2, 2.3],
    SEVEN: [-0.98, -0.19, 1.0, 2.01],
    EIGHT: [-0.89, -0.15, 0.82, 1.74],
  };

function tierFor(bits: number, mode: GameMode): LuckTier {
  const [p10, p30, p70, p90] = LUCK_TIERS[mode];
  if (bits < p10) return "very-unlucky";
  if (bits < p30) return "unlucky";
  if (bits <= p70) return "average";
  if (bits <= p90) return "lucky";
  return "very-lucky";
}

/**
 * Splits a finished game's luck into per-guess bits over the real answer pool. `narrowingBits` is
 * the luck of how the field collapsed (every guess but the winning stab); `finishBits` is the luck
 * of the winning guess itself (winning from a wide field is lucky, from a deduced field is not).
 * Their sum is `bits`, which the per-mode boundaries sort into one of five fortune tiers. Reasons
 * over answers that contain the gram (the answer is always one of them); guesses that cannot be
 * scored against a candidate simply drop it. An empty pool yields 0 bits, which reads as the
 * "average" tier, so the recap always has something to show.
 */
export async function computeLuck(input: {
  mode: GameMode;
  gram: string;
  answer: string;
  guesses: string[];
  feedback: LetterFeedback[][];
  won: boolean;
}): Promise<LuckResult> {
  const gram = input.gram.toUpperCase();
  const answer = input.answer.toUpperCase();
  const guesses = input.guesses.filter((g) => g.length > 0);

  const list = await getAnswerList(input.mode);
  const pool = new Set<string>();
  for (const w of list) {
    const up = w.toUpperCase();
    if (up.includes(gram)) pool.add(up);
  }
  if (answer.includes(gram)) pool.add(answer);

  let survivors = [...pool];
  let bits = 0;
  let narrowingBits = 0;
  let finishBits = 0;
  const perGuess: LuckGuess[] = [];

  for (let i = 0; i < guesses.length; i++) {
    const fb = input.feedback[i];
    if (!fb) break;
    const g = guesses[i].toUpperCase();
    const before = survivors.length;
    const isWin = input.won && i === guesses.length - 1;

    // Partition the surviving answers by the feedback g would produce against each.
    const groups = new Map<string, number>();
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
      total++;
    }

    let sumSq = 0;
    for (const n of groups.values()) sumSq += n * n;
    const expected = total > 0 ? sumSq / total : 1;
    const actual = groups.get(feedbackKey(fb)) ?? 1;
    const lb = Math.log2(expected / Math.max(1, actual));

    bits += lb;
    if (isWin) finishBits += lb;
    else narrowingBits += lb;

    perGuess.push({ guess: g, before, expected, actual, bits: lb, isWin });

    survivors = survivors.filter((c) => c !== g && consistent(g, fb, c, gram));
  }

  return {
    bits,
    narrowingBits,
    finishBits,
    tier: tierFor(bits, input.mode),
    perGuess,
  };
}
