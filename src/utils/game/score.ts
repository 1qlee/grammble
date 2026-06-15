import { GRAM_LENGTH } from "~/utils/game/constants";
import type { LetterFeedback } from "~/utils/game/types";

// SERVER-ONLY. Imported only by the tRPC router so the scoring algorithm never
// ships to the client bundle. Do not import this from client components/hooks.

// Divisor that maps accumulated cost to the win range. Larger = more forgiving.
const UNCERTAINTY_DIVISOR = 2.5;
// Boundary of the loss range: losses scale into [0, WIN_FLOOR). It is also the score
// a cleanly played win lands at or above; only a loosely played long game dips under.
const WIN_FLOOR = 40;
// Hard minimum a WIN can score. Decoupled from WIN_FLOOR so a sloppy 6-guess win can
// fall below 40 (showing its real raw instead of all such games clamping to 40), yet
// never bottoms out completely -- winning still retains a baseline. A consequence is
// that a badly played win can now score below a strong loss, which is intended.
const WIN_MIN = 25;
const WASTE_WEIGHT = 0.08;

// Cost per letter that a guess falls short of the full word length, summed across
// every guess. A shorter-than-full guess tests fewer letters and under-commits, so
// the game (built around full-length words) charges for it. Tuned strong: ~4.4 score
// points per missing letter, enough that a deeper-deficit game cannot outscore a
// fuller one on information alone. The winning guess is always full length, so it
// never contributes.
const LENGTH_WEIGHT = 0.11;

// Loss-only length penalty. The loss scale (0..WIN_FLOOR) is too compressed for the
// flat win-side charge, which saturates to 0 and makes distinct losses tie. Instead
// the loss score is SCALED by a factor that slides from 1 (all full-length guesses)
// down to LOSS_LENGTH_FLOOR (every guess as short as allowed), driven by the average
// fraction of each guess left unfilled. Multiplying preserves variance and never
// drives a found-something loss to 0 on length alone.
const LOSS_LENGTH_SLOPE = 2.1;
const LOSS_LENGTH_FLOOR = 0.3;

// Base cost by number of guesses-to-win (index = guess count). Guess count is
// the primary axis: these are tuned so the best play at each count anchors the
// bands -- a 2-guess win runs 98 (all greens) down to 94 (no greens), a strong
// 3-guess hits 92, then 4/5/6-guess wins taper toward the WIN_FLOOR. A 1-guess
// win costs nothing (perfect 100).
const GUESS_BASE_COST = [0, 0, 0.15, 0.25, 0.42, 0.6, 0.83];

// Credit for the coverage held going into the winning guess: the more of the
// answer's letters you had identified before the finish, the higher the score.
// A yellow counts the same as a green here (knowing the letter is what matters),
// so a board full of greens or a board full of yellows both read as strong.
const KNOWLEDGE_WEIGHT = 0.1;

// Premium for converting a yellow into a correctly placed green: you had to deduce
// the position, which is skill, not luck. A letter handed to you as a green earns
// no premium; placing a letter you only knew as a yellow does. This is what lets a
// yellow-built solve edge the green-built one at the same guess count.
const DEDUCTION_WEIGHT = 0.06;

// Bonus for entering the WINNING guess highly constrained: the fewer positions
// still unknown going into the finish, the more the solve was earned by narrowing
// rather than luck. Squared so it rewards a near-locked board (1-2 unknowns) steeply
// and a loose one barely. Applied only for 3+ guess wins; the 2-guess ladder is
// already tuned by GUESS_BASE_COST and must not be shifted by this.
const ENDGAME_WEIGHT = 0.2;

// Credit per distinct letter proven absent before the win. Eliminating fresh letters
// narrows the field, which is real skill, but a gray identifies one of ~two dozen
// absent letters whereas a green/yellow pins one of the answer's own letters -- so a
// gray is worth a fraction of a found letter. Capped so the credit cannot be farmed
// by spraying wide guesses (the guess-count base cost already punishes that anyway).
const ELIM_WEIGHT = 0.01;
const ELIM_CAP = 6;

// Lateness weighting for the middle-guess uncertainty penalty. Early uncertainty
// is the luck zone (little has been revealed) and barely costs; uncertainty that
// persists into later guesses is the skill zone (it should have been deduced) and
// costs more. Indexed by middle-guess position (0 = earliest middle guess).
const POS_WEIGHT = [0.4, 0.7, 1.0, 1.2];

// Cap on the summed middle-guess penalty. Because stuck sums over every middle guess,
// a long game (5-6 guesses) that stays uncertain accumulates enough to blow past the
// WIN_FLOOR threshold on its own, collapsing every such game to 40 with no variance.
// Past this point you are already clearly struggling and guess count (base + ceiling)
// has captured that, so further uncertainty stops subtracting. A 3-guess maxes near
// 0.18 and a 4-guess near 0.49 of stuck, both under the cap, so only the long
// wandering games this is meant to spread are affected.
const STUCK_CAP = 0.7;

// Hard ceiling per guess count (index = guess count). Guess count stays the
// primary axis: the deduction premium can lift a solve to the top of its own band
// but never past it, so a brilliantly deduced 3-guess (max 92) can never outscore
// a 2-guess. Index 1 is the ace (100); 0 is unused.
const BAND_CEILING = [100, 100, 99, 92, 86, 75, 62];

const isGreen = (s: LetterFeedback | undefined) =>
  s === "correct" || s === "gramCorrect";
const isYellow = (s: LetterFeedback | undefined) =>
  s === "misplaced" || s === "gramMisplaced";

/**
 * Coverage after each guess as a fraction of the non-gram answer (0..1): how many
 * of the answer's distinct letters you have identified. Only "correct"/"misplaced"
 * tiles count -- gram tiles are given, not earned. A yellow counts the same as a
 * green (knowing the letter is present is what matters here; placing it is rewarded
 * separately by the deduction premium). Monotonic since known letters accumulate.
 */
function coverageByGuess(
  guesses: string[],
  feedback: LetterFeedback[][],
  slots: number,
): number[] {
  const knownLetters = new Set<string>();
  const out: number[] = [];

  for (let i = 0; i < guesses.length; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      const tile = row[p];
      if (tile === "correct" || tile === "misplaced") knownLetters.add(word[p]);
    }
    out.push(Math.min(1, knownLetters.size / slots));
  }

  return out;
}

/**
 * Positional certainty after each guess as a fraction of the whole answer (0..1):
 * how many of the word's positions are pinned down. The gram is given, so it always
 * counts as GRAM_LENGTH known positions from move one -- an all-gray opener is never
 * 0% certain. Each distinct non-gram letter found adds one. Unlike coverageByGuess
 * (which measures earned letters over the non-gram slots), this measures total board
 * lock-down over the full word, and drives the uncertainty penalty and endgame bonus.
 */
function certaintyByGuess(
  guesses: string[],
  feedback: LetterFeedback[][],
  wordLength: number,
): number[] {
  const knownLetters = new Set<string>();
  const out: number[] = [];

  for (let i = 0; i < guesses.length; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      const tile = row[p];
      if (tile === "correct" || tile === "misplaced") knownLetters.add(word[p]);
    }
    out.push(Math.min(1, (GRAM_LENGTH + knownLetters.size) / wordLength));
  }

  return out;
}

/**
 * Counts deductions: non-gram letters placed correctly (green) that the player had
 * previously seen only as a yellow in an earlier guess. These are placements that
 * had to be reasoned out rather than handed over, so they earn the deduction
 * premium. A letter that goes straight from unseen to green (cold) does not count.
 */
function countDeductions(
  guesses: string[],
  feedback: LetterFeedback[][],
): number {
  const everYellow = new Set<string>();
  const counted = new Set<string>();
  let deductions = 0;

  for (let i = 0; i < guesses.length; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];

    for (let p = 0; p < word.length; p++) {
      const c = word[p];
      if (row[p] === "correct" && everYellow.has(c) && !counted.has(c)) {
        deductions++;
        counted.add(c);
      }
    }

    // Record this guess's yellows after scoring greens, so only yellows from
    // strictly earlier guesses qualify a placement as a deduction.
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "misplaced") everYellow.add(word[p]);
    }
  }

  return deductions;
}

/**
 * Counts distinct letters proven absent before the winning guess: the eliminations
 * that narrowed the field. Only "absent" tiles count (grams are never gray, and a
 * present letter can never be gray), so this set never overlaps the found letters
 * credited by coverage/knowledge. The final winning guess is excluded since it adds
 * no eliminations.
 */
function countEliminations(
  guesses: string[],
  feedback: LetterFeedback[][],
): number {
  const eliminated = new Set<string>();

  for (let i = 0; i < guesses.length - 1; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "absent") eliminated.add(word[p]);
    }
  }

  return eliminated.size;
}

/**
 * Counts strictly dominated moves: placing a known-absent letter, re-placing a
 * known-misplaced letter in the same wrong position, or overwriting a confirmed
 * green slot. Gram tiles are excluded. The absent rule is lenient: a letter is
 * treated as known absent only when it never shows green or yellow within the
 * same guess, avoiding false positives on duplicate-letter guesses.
 */
function countWastedMoves(
  guesses: string[],
  feedback: LetterFeedback[][],
): number {
  const knownGreen = new Map<number, string>();
  const absentLetters = new Set<string>();
  const knownWrongPos = new Set<string>();
  let wasted = 0;

  for (let i = 0; i < guesses.length; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];

    if (i > 0) {
      for (let p = 0; p < word.length; p++) {
        const tile = row[p];
        if (tile === "gramCorrect" || tile === "gramMisplaced") continue;
        const c = word[p];
        if (knownGreen.has(p) && knownGreen.get(p) !== c) wasted++;
        if (absentLetters.has(c)) wasted++;
        if (knownWrongPos.has(`${c}@${p}`)) wasted++;
      }
    }

    for (let p = 0; p < word.length; p++) {
      const c = word[p];
      const tile = row[p];
      if (!tile) continue;
      if (isGreen(tile)) {
        knownGreen.set(p, c);
      } else if (isYellow(tile)) {
        knownWrongPos.add(`${c}@${p}`);
      } else {
        const presentElsewhere = word
          .split("")
          .some((ch, q) => ch === c && (isGreen(row[q]) || isYellow(row[q])));
        if (!presentElsewhere) absentLetters.add(c);
      }
    }
  }

  return wasted;
}

/**
 * Performance score out of 100, independent of game mode.
 *
 * Guess count is the primary axis (diminishing GUESS_BASE_COST), hard-capped per
 * count by BAND_CEILING so a win in fewer guesses always wins. Within a band, the
 * winning guess earns a KNOWLEDGE_WEIGHT credit for the coverage held going into it
 * (yellows count the same as greens), plus a DEDUCTION_WEIGHT premium for every
 * letter it places that was previously known only as a yellow: deducing placement
 * is skill, so a yellow-built solve edges the green-built one at the same count.
 * A 3+ guess win also earns an ENDGAME_WEIGHT bonus for entering the finish highly
 * constrained (few positions left unknown, gram included), so narrowing the board
 * to a near-certain solve is rewarded over a lucky finish. A small ELIM_WEIGHT credit
 * (capped) rewards each fresh letter proven absent before the win: eliminating
 * candidates is real narrowing, worth a fraction of finding a letter. Every guess
 * shorter than the full word is charged LENGTH_WEIGHT per missing letter, since a
 * short guess under-commits and tests fewer letters (the winning guess is always
 * full length and so is never charged).
 * The MIDDLE guesses (after the first, before the win) are charged the SQUARED
 * positional uncertainty going into them, weighted by lateness (POS_WEIGHT) so early
 * uncertainty is cheap (luck zone) and lingering late uncertainty is costly (skill
 * zone). That middle penalty is capped (STUCK_CAP) so a long wandering game cannot
 * accumulate enough to floor every such game to the same score with no variance.
 * Certainty counts the gram as known from move one, so an all-gray opener is not
 * treated as zero information. A forced last-letter hunt of STRO_E
 * (STROVE/STROBE/STROKE) where greens were already locked barely costs, while
 * wandering at low certainty does. A 1-guess win is a perfect 100.
 *
 * Losses score in [0, WIN_FLOOR), scaled by the best coverage reached and then by a
 * length factor (1 for full-length guesses down to LOSS_LENGTH_FLOOR for the shortest).
 * Length is multiplicative on losses, not the flat win-side charge, so the compressed
 * loss scale keeps distinct games distinct. Wins clamp to [WIN_MIN, ceiling]; a cleanly
 * played win stays at or above WIN_FLOOR, but a loosely played long game can dip below
 * it (and below a strong loss), which is intended so weak wins stay distinct instead of
 * piling on the floor. The full 0..100 range is reachable: 100 for an ace down to ~0
 * for a loss that learned almost nothing.
 */
export function computePuzzleScore(params: {
  guesses: string[];
  feedback: LetterFeedback[][];
  won: boolean;
  wordLength: number;
}): number {
  const { feedback, won, wordLength } = params;
  const guesses = params.guesses.filter((g) => g.length > 0);
  if (guesses.length === 0) return 0;

  const slots = Math.max(1, wordLength - GRAM_LENGTH);
  const coverage = coverageByGuess(guesses, feedback, slots);
  const certainty = certaintyByGuess(guesses, feedback, wordLength);
  const wasteCost = WASTE_WEIGHT * countWastedMoves(guesses, feedback);
  const lengthCost =
    LENGTH_WEIGHT *
    guesses.reduce((sum, g) => sum + Math.max(0, wordLength - g.length), 0);

  if (!won) {
    const bestCoverage = coverage.length > 0 ? Math.max(...coverage) : 0;
    // Scale (not subtract) the loss by guess length: the average fraction of each
    // guess left unfilled slides the factor from 1 down to LOSS_LENGTH_FLOOR. This
    // keeps distinct losses distinct instead of saturating them all to 0.
    const totalDeficit = guesses.reduce(
      (sum, g) => sum + Math.max(0, wordLength - g.length),
      0,
    );
    const avgDeficitFraction = totalDeficit / (guesses.length * wordLength);
    const lengthFactor = Math.max(
      LOSS_LENGTH_FLOOR,
      1 - LOSS_LENGTH_SLOPE * avgDeficitFraction,
    );
    const raw = Math.round(bestCoverage * WIN_FLOOR * lengthFactor - wasteCost);
    return Math.max(0, Math.min(WIN_FLOOR - 1, raw));
  }

  const n = guesses.length;
  const base = GUESS_BASE_COST[n] ?? GUESS_BASE_COST[GUESS_BASE_COST.length - 1];
  const ceiling = BAND_CEILING[n] ?? BAND_CEILING[BAND_CEILING.length - 1];

  // Charge only the middle guesses (after the first, before the win) for the
  // squared positional uncertainty going into them: certainty[0]..certainty[n-3].
  // Certainty counts the gram as known from move one, so an all-gray opener is not
  // treated as zero information. Lateness weighting makes early uncertainty cheap
  // and late uncertainty dear.
  let stuck = 0;
  for (let j = 0; j <= n - 3; j++) {
    const residual = 1 - certainty[j];
    const weight = POS_WEIGHT[Math.min(j, POS_WEIGHT.length - 1)];
    stuck += weight * residual * residual;
  }
  stuck = Math.min(stuck, STUCK_CAP);

  // Credit the coverage held going into the winning guess (index n-2), and reward
  // every placement that had to be deduced from a prior yellow.
  const knowledge = n >= 2 ? coverage[n - 2] : 1;
  const deductions = countDeductions(guesses, feedback);

  // Endgame bonus: how locked-down the board was going into the win (index n-2),
  // gram included. Only for 3+ guess wins, so it rewards constraint built across
  // intermediate guesses without disturbing the tuned 2-guess ladder.
  const endgame = n >= 3 ? ENDGAME_WEIGHT * certainty[n - 2] ** 2 : 0;

  // Credit the field narrowed by eliminating fresh letters before the win, capped.
  const elimination =
    ELIM_WEIGHT * Math.min(countEliminations(guesses, feedback), ELIM_CAP);

  const cost =
    base +
    stuck +
    wasteCost +
    lengthCost -
    KNOWLEDGE_WEIGHT * knowledge -
    DEDUCTION_WEIGHT * deductions -
    endgame -
    elimination;
  const raw = Math.round(100 * (1 - cost / UNCERTAINTY_DIVISOR));
  return Math.max(WIN_MIN, Math.min(ceiling, raw));
}
