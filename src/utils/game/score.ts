import { GRAM_LENGTH, MIN_GUESS_LENGTH } from "~/utils/game/constants";
import type { LetterFeedback } from "~/utils/game/types";
import {
  type Availability,
  freshGramPositionReachable,
  guessWord,
  letterProbeable,
} from "~/utils/game/availability";
import type {
  FrameLine,
  ScoreBreakdown,
  ScoreContribution,
} from "~/utils/game/recap";

// SERVER-ONLY. Imported only by the tRPC router so the scoring algorithm never
// ships to the client bundle. Do not import this from client components/hooks.

// Points per unit of a skill component weight. Every weight below (BREADTH_WEIGHT,
// DEDUCTION_WEIGHT, ...) is multiplied by PT when converted into score points, so PT is the
// single global scale of the skill texture around the frame. Larger = quality swings the
// score more relative to the guess-count baseline.
const PT = 37;

// The score is a running ledger, not a guess-count table. It starts from the OPENER'S OWN GRADE --
// see gradeOpener: what the opener was worth before any feedback existed -- and then each guess
// AFTER the opener pays an ESCALATING turn cost, the visible "cost of taking another turn." Rather
// than a flat charge, the k-th guess (k>=2) costs TURN_COST_BASE + TURN_COST_STEP*(k-2), so a late
// guess reads as more struggle than an early probe. That turn cost is the only place guess count
// enters the score: a fast clean win keeps most of the base, a slow one erodes it turn by turn (and
// faster near the tail), yet the skill points a strong slow game earns can still overtake a sloppy
// fast one (Moderate). Solving banks SOLVE_BONUS and ends the ledger; a loss pays the turn costs but
// never banks the bonus, so losses trend below wins without a hard cap beneath them. A 1-guess win
// short-circuits to a flat 100 (the opener WAS the answer -- a perfect game).
//
// frameBase = gradeOpener(opener) - turnCostFor(guesses) + (won ? SOLVE_BONUS : 0)
//
// This is still a term in the guess count -- Moderate influence mathematically requires one -- but
// it is a per-turn cost you can narrate ("another turn spent"), not an opaque band the score is
// clamped into. Skill points then accumulate on top. Luck no longer touches the score at all: how
// the board fell is measured separately as a fortune readout (see luck.ts).
// The opener is graded, not gifted. Everything a player controls on guess 1 -- where they bet the
// gram, how many distinct letters they spent, whether they used the whole word -- is knowable
// before any feedback exists, so the starting base IS that grade rather than a flat stake. The
// floor is what a wasteful opener still starts with; a flawless one earns the full pot on top:
//
//   openerBase = OPENER_FLOOR + gram-placement grade + distinct-letter grade + full-length grade
//               (60)          + (<=5)                + (<=6)                 + (<=2)          = 73
//
// The gram-placement grade is capped at 5 (down from 10) on purpose. Betting the gram on its likeliest
// slot is a PRIOR-based guess, not demonstrated play -- you are rewarded before any feedback exists --
// so it should not dominate the base. The points it gave up were moved into the post-opener skill
// credits (breadth, deductions, triangulation, held greens), which reward what the player actually
// did with their later guesses. Net effect: a game won on a lucky opening bet scores lower, while a
// game that worked the board scores higher. These three opener terms are charged HERE and nowhere
// else: breadth/length skip the opener (see their notes), so a good opening is paid exactly once.
const OPENER_FLOOR = 60;
const OPENER_GRAM_MAX = 5;
const OPENER_LETTERS_MAX = 6;
const OPENER_LENGTH_MAX = 2;
// The turn cost is the main lever that makes guess count matter. Its SHAPE is deliberate: the first
// guess after the opener is a cheap probe (TURN_COST_FIRST), and every guess beyond that costs a
// steady TURN_COST_LATER. This is NOT the old escalating quadratic -- that shape could not satisfy
// the two ends at once. A cheap first follow-up keeps a 2-guess win high (a clean solve on the
// second try is excellent and should read near the 90s), while a flat, non-trivial per-guess cost
// after that still pulls each additional guess down meaningfully. Totals are 0,3,15,27,39,51 for
// n=1..6: a 2-guess pays almost nothing, a mid-count win is clearly docked, yet the tail does not
// explode (which an escalating curve does, cratering long wins below losses). Guess count dominates
// the score; skill is texture on top, and turn cost never reorders games WITHIN a guess count.
const TURN_COST_FIRST = 3;
const TURN_COST_LATER = 12;
const SOLVE_BONUS = 22;

// Fraction of a non-winning guess's turn cost refunded when that guess kept GAINING INFORMATION at a
// point where the player could not yet see the answer (see the strong-play-relief block in
// accumulateScore). Half, not full: gathering a clue when you are stuck should hurt LESS than
// deducing the answer outright, but never be free -- a forced extra guess stays clearly costlier
// than solving one turn sooner, so guess count still dominates and Moderate holds.
const EXPLORATION_RELIEF = 0.5;

// The candidate pool (answer-length words still consistent with the feedback) at or below which the
// player is treated as "in the endgame": few possible answers remain, so a further strong guess is
// clue-gathering toward a word they cannot yet see, not sloppy wheel-spinning on a wide-open field.
// This generalizes the pool==1 "only the answer fits" case to its close neighbours (2, 3, ... left),
// which is where a good player's late narrowing guesses actually sit -- pool==1 alone is too narrow
// because a player who reaches it usually just plays the answer. Fast wins are unaffected: their
// non-winning guesses sit at a wide pool, above this line.
const STUCK_POOL = 6;

// Per-guess share of the win turn cost: the k-th guess (0-indexed) costs nothing on the opener,
// TURN_COST_FIRST on the first follow-up, and TURN_COST_LATER on every guess after. Summed across
// a win's guesses this equals turnCostFor(n); it exists so exploration relief can refund a slice of
// the SPECIFIC guess it forgives rather than the whole-game total.
function perGuessTurnCost(i: number): number {
  if (i < 1) return 0;
  return i === 1 ? TURN_COST_FIRST : TURN_COST_LATER;
}

// Losses do NOT ride the win turn cost (its tail would crater every loss to 0) and never bank the
// solve bonus. Instead a loss pays one flat LOSS_TURN_COST -- a loss is always a full MAX_GUESSES
// game, so there is no per-turn count to escalate over -- and is clamped to LOSS_CAP, a ceiling that
// sits below any real win. What moves a loss within [0, LOSS_CAP] is the skill ledger: breadth,
// deductions, triangulation and held greens lift it, waste (now capped) lowers it, so a loss score
// is gameplay-dependent -- a broad, exploratory loss lands well above a lazy one -- without ever
// reaching a win's range.
const LOSS_TURN_COST = 35;
const LOSS_CAP = 50;

// Total turn cost for an n-guess WIN: the opener (k=1) is free, the first follow-up costs
// TURN_COST_FIRST, and each guess beyond that adds a flat TURN_COST_LATER. Returns 0 for a 1-guess
// game (special-cased to a perfect 100). Losses do not use this -- they run through the loss branch
// in accumulateScore, which applies a gentler flat cost and a hard ceiling instead.
function turnCostFor(n: number): number {
  if (n < 2) return 0;
  return TURN_COST_FIRST + TURN_COST_LATER * (n - 2);
}

// Every point value that reaches the recap is quantized to a tenth: the ledger is read, not just
// summed, and a raw float would render as +2.8571428571428577. Applied at emission so the stored
// lines and the displayed lines are the same numbers.
const round1 = (x: number) => Math.round(x * 10) / 10;

// Rounds each value to an integer while forcing the results to sum to `target` (itself the rounded
// sum). Independent Math.round per element does not preserve the sum -- [1.4, 1.4] rounds to 1+1=2
// but the whole rounds 2.8 -> 3 -- which would break the recap invariant that the per-guess skill
// deltas add up to the whole-game skill. Largest-remainder apportionment fixes this: floor every
// value, then hand the leftover +1s to the elements with the biggest fractional part. Works for
// signed values (penalties are negative); `need` is always in 0..n since target >= sum of floors.
function distributeRounding(values: number[], target: number): number[] {
  const floors = values.map((v) => Math.floor(v));
  const base = floors.reduce((s, f) => s + f, 0);
  let need = target - base;
  const order = values
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < order.length && need > 0; k++, need--) out[order[k].i]++;
  return out;
}

/**
 * Grades the opener into the lines that make up the starting base. Judged only on the opener
 * itself, so the base a player starts from never moves because of something they did later:
 *
 *  - openerGram: did they bet the gram on its likeliest slot? Scored RELATIVE to the best slot
 *    available, so full marks mean "the most probable spot", not "a spot that happened to be
 *    common". A player who reads ER as a word ending and opens FLOWER earns this outright, whether
 *    or not today's answer actually ends in ER.
 *  - openerLetters: distinct non-gram letters spent. Repeating a letter wastes a slot and tests
 *    less of the alphabet, so it scores strictly lower than a repeat-free opener of the same length.
 *  - openerLength: full-length guesses see more of the word. Scales down to nothing at the shortest
 *    guess the game allows.
 *
 * `fractions` is the per-position prior from gramPlacementDistribution; with no prior (or no gram
 * found in the opener) the gram grade is zero and the rest still stand.
 */
function gradeOpener(
  opener: string,
  openerGramStart: number,
  fractions: number[],
  wordLength: number
): FrameLine[] {
  const lines: FrameLine[] = [{ key: "openerFloor", points: OPENER_FLOOR }];

  const bestFrac = fractions.length > 0 ? Math.max(...fractions) : 0;
  if (openerGramStart >= 0 && bestFrac > 0) {
    const frac = Math.max(0, Math.min(1, fractions[openerGramStart] ?? 0));
    lines.push({
      key: "openerGram",
      points: round1(OPENER_GRAM_MAX * (frac / bestFrac)),
      max: OPENER_GRAM_MAX,
    });
  }

  // Non-gram slots are the ones the player actually chose letters for; the gram itself is a given.
  const gramEnd = openerGramStart >= 0 ? openerGramStart + GRAM_LENGTH : -1;
  const chosen = new Set<string>();
  for (let p = 0; p < opener.length; p++) {
    if (openerGramStart >= 0 && p >= openerGramStart && p < gramEnd) continue;
    // Offset blank columns on a slid opener are not chosen letters.
    if (opener[p] === " ") continue;
    chosen.add(opener[p]);
  }
  const slots = Math.max(1, wordLength - GRAM_LENGTH);
  const distinct = Math.min(chosen.size, slots);
  lines.push({
    key: "openerLetters",
    points: round1(OPENER_LETTERS_MAX * (distinct / slots)),
    max: OPENER_LETTERS_MAX,
  });

  const spread = Math.max(1, wordLength - MIN_GUESS_LENGTH);
  // Count real letters, not blank offset padding, for the length grade.
  const openerLetters = opener.replace(/ /g, "").length;
  const deficit = Math.max(0, Math.min(spread, wordLength - openerLetters));
  lines.push({
    key: "openerLength",
    points: round1(OPENER_LENGTH_MAX * (1 - deficit / spread)),
    max: OPENER_LENGTH_MAX,
  });

  return lines.filter((l) => Math.abs(l.points) >= 0.05);
}

// Buffed 25% (from 0.08), a gentler bump than the other clean-play penalties (length, neglect,
// gramStagnation), which carry 50% to keep skill errors biting after the skill BONUSES were reverted
// to baseline. Waste takes only half that buff: capped at WASTE_CAP, a full 50% bit hard enough to
// overshadow the other penalties, so it lands between baseline and the rest.
const WASTE_WEIGHT = 0.1;
// Max total waste CHARGES per game (a count, like NEGLECT_CAP), so a long game cannot stack an
// unbounded waste penalty. This matters most on losses: without it, six full-length guesses reusing
// letters as the field narrows pile up so much waste that a broad, well-explored loss scores BELOW
// a lazy short-guess loss -- the penalty swamps the breadth/deduction credit that should separate
// them. Capping waste (mirroring the neglect cap) keeps the penalty a nudge, not a collapse.
const WASTE_CAP = 5;

// Penalty per letter that a guess falls short of the full word length, summed across every
// guess -- but only for a short guess that did NO new testing (see deficitByGuess). An
// under-committing short guess that merely re-treads known letters is charged; a short guess
// that still introduced a fresh letter did real work and is waived. A short guess that placed
// no fresh letter but locked in deduced ones (yellow -> green) has its charge reduced by one
// letter per deduction, so positional work shrinks the shortfall it is charged for (applied at
// the call site). The winning guess is always full length, so it never contributes. Charged as a
// skill error (PT * weight per missing letter). Buffed 50% (from 0.11) with the other penalties.
const LENGTH_WEIGHT = 0.165;

// Premium for converting a yellow into a correctly placed green: you had to deduce
// the position, which is skill, not luck. A letter handed to you as a green earns
// no premium; placing a letter you only knew as a yellow does. This is what lets a
// yellow-built solve edge the green-built one at the same guess count. The credit is
// scaled by coverage held going into the win, so a yellow placed when you had found a
// lot counts nearly fully, while a lone yellow (little else known) barely moves the
// score -- otherwise a single yellow in an otherwise-empty board would overpay.
const DEDUCTION_WEIGHT = 0.06;
// Max total deduction CHARGES per game (a count, like NEGLECT_CAP / WASTE_CAP). Deduction is the
// only positive credit that would otherwise scale linearly and unbounded with letters placed: a
// yellow-heavy solve that hoards every letter as a misplaced tile and then dumps them all green on
// the winning guess earns one deduction PER letter at once, at full board knowledge -- e.g. five
// letters in a 7-length answer stacked to +16, dwarfing every other skill term and dragging a mid-
// count win to ~100. Capping the count holds deduction's ceiling near breadth's (CAP * PT * WEIGHT
// ~= 3 * 37 * 0.06 ~= 6.7, matching breadth's 37 * 0.18 ~= 6.7), so placing a batch of deduced
// letters still reads as strong play without eclipsing the whole ledger. Placing letters green
// early is no longer punished relative to hoarding.
const DEDUCTION_CAP = 3;

// Premium for a COLD placement: a green placed on a letter that was never seen as a yellow first --
// the player guessed the letter AND its exact spot with no prior misplaced clue to reason from. That
// is real progress (a freshly locked position), but not the positional deduction the yellow -> green
// premium rewards, so it pays 20% less per letter. It draws from its OWN budget rather than sharing
// deduction's, so a game that already spent its deduction cap can still be credited for placing new
// greens on the winning guess -- the case this exists for. Like deduction it is scaled by coverage
// held going in (a cold green on a near-empty board is closer to a lucky guess than to skill) and
// capped at a count of charges so a final-guess batch of fresh greens cannot stack unbounded.
const COLD_PLACEMENT_WEIGHT = DEDUCTION_WEIGHT * 0.8;
const COLD_PLACEMENT_CAP = DEDUCTION_CAP;

// Penalty for neglecting a known letter: once a letter has shown up (yellow) and has not
// yet been placed green, omitting it entirely from a later non-winning guess wastes the
// clue -- the player learned the letter is in the answer and then did not work it toward
// placement. Charged once per omission per guess, mirroring the letter-waste and gram-
// stagnation penalties for the opposite failure (repeating dead information). Kept modest:
// there can be good reasons to spend a guess elsewhere, so this nudges rather than dominates.
// Capped so a long, sloppy game cannot stack an unbounded penalty and collapse to the floor
// with no variance; by this point the guess-count base has already captured the struggle.
// Buffed 50% (from 0.04) with the other clean-play penalties.
const NEGLECT_WEIGHT = 0.06;
const NEGLECT_CAP = 3;

// Premium for deducing the GRAM's position: the gram's letters are given, but WHERE it
// sits in the answer is not. Each guess that places the gram in a fresh wrong spot (a
// gramMisplaced tile) eliminates one candidate position; converting that search into the
// final correct placement is a core skill of the game. Credited per distinct wrong
// gram-position eliminated before the gram is first placed correctly. A gram that lands
// correctly with no prior probing (cold or lucky) earns nothing, mirroring the letter
// deduction premium.
//
// This is the POSITIONAL sibling of the letter-deduction premium and is now weighted at parity
// with it (was 0.1). The old premium stacked three separate boosts -- a higher weight, no
// coverage damping, and no count cap -- which made its ceiling ~2x every other reward and let it
// dominate a mid-count win. Matching DEDUCTION_WEIGHT removes the weight boost; the cap below
// removes the unbounded tail. It stays effectively a touch stronger than letter deduction anyway,
// since it (deliberately) skips the coverage scaling that damps a lone early letter clue: where
// the gram sits is an independent search axis, so an elimination is real work on a full or empty
// board. It just no longer gets a headline weight on top of that.
const GRAM_DEDUCTION_WEIGHT = 0.06;
// Max distinct wrong gram positions credited per game (a count cap, like DEDUCTION_CAP / WASTE_CAP
// / NEGLECT_CAP). gramDeduction scales linearly with positions eliminated and would otherwise be
// unbounded -- exactly the failure mode DEDUCTION_CAP exists to stop, and worse across modes: a
// 6-letter answer has 5 gram slots, a 7-letter 6, an 8-letter 7, so longer modes could farm more
// triangulation credit for the same skill. Capping the count holds its ceiling near the other
// rewards (CAP * PT * WEIGHT ~= 3 * 37 * 0.06 ~= 6.7) and normalizes it across word lengths.
const GRAM_DEDUCTION_CAP = 3;

// Penalty for re-placing the gram at a start already proven wrong (a repeated gramMisplaced
// at the same position). That probe learns nothing new about the gram -- the position was
// already ruled out -- so a player who parks the gram on a known-wrong spot instead of
// testing a fresh one is charged, mirroring the letter-waste penalty for a repeated gray.
// Kept just under WASTE_WEIGHT: forgoing gram-position info is a shade softer than actively
// re-testing a known-absent letter. Keeping a CONFIRMED-correct gram fixed is never charged
// (a correct start is never in the known-wrong set), so efficient letter play is untouched.
// Buffed 50% (from 0.06) with the other penalties; still under WASTE_WEIGHT (0.09 < 0.12).
const GRAM_STAGNATION_WEIGHT = 0.09;

// Credit for carrying a locked frame THROUGH the middle guesses: the average fraction of
// the board (gram + placed greens) held green across guesses 1..n-2. This rewards a solve that
// pinned a block early and kept it in place to the finish -- the "lock a frame, hold it" pattern
// (e.g. locking IGATE on move one and holding it, or SION across LESION). Yellow does not count
// here (that is the deduction premium's job); this is specifically about maintaining CONFIRMED
// positions. The gram counts, since holding a confirmed-correct gram fixed is good play and never
// penalized (see GRAM_STAGNATION_WEIGHT). Only applies to 3+ guess wins -- a 2-guess has no middle
// guess to hold a frame across, so the loop over guesses 1..n-2 simply never runs for it.
const HELD_GREEN_WEIGHT = 0.12;

// Credit for the breadth of the player's information gathering: the distinct non-gram letters
// TESTED before the win, counting a letter whether it came back present or absent. Testing many
// distinct letters narrows the pool of possibilities, and doing so is skill even when a guess
// finds nothing -- a player with no leads who spreads across fresh letters has played well and
// should not sit near the floor. Counting tested (not just absent) letters is deliberate: an
// absent-only credit would perversely reward the guess that found LESS, since a found letter
// leaves the absent set, so a broad whiff could outscore a guess that placed letters. Founds are
// additionally rewarded by coverage/knowledge, so finding still beats mere testing.
//
// The credit RAMPS rather than scaling linearly: a guess earns nothing until it has tested
// BREADTH_RAMP_LO distinct letters and reaches the full BREADTH_WEIGHT at BREADTH_RAMP_HI, then
// saturates. A flat per-letter credit could not open a real gap between a narrow guess and a
// broad one (they differ by only a couple of distinct letters), and lifting the broad guess that
// way dragged the narrow one up with it. The ramp instead pays a repeat-heavy guess almost
// nothing while paying a broad guess in full -- the carrot that discourages duplicate-heavy
// guesses without a direct penalty. Saturating past BREADTH_RAMP_HI stops a very wide guess from
// farming credit. Only the non-winning guesses count (the winning guess adds no new testing).
const BREADTH_WEIGHT = 0.18;
const BREADTH_RAMP_LO = 4;
const BREADTH_RAMP_HI = 7;

const isGreen = (s: LetterFeedback | undefined) =>
  s === "correct" || s === "gramCorrect";
const isYellow = (s: LetterFeedback | undefined) =>
  s === "misplaced" || s === "gramMisplaced";

// Offset padding on a slid short guess: leading blank tiles are spaces in the
// stored guess string. They are not letters, so length-based grading counts
// real letters only.
const countBlanks = (word: string) => word.length - word.replace(/ /g, "").length;

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
  slots: number
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
 * The gram's start position within each guess, read from the feedback row (the index of
 * the first gramCorrect/gramMisplaced tile). Every valid guess contains the gram exactly
 * once in its feedback, so this is well defined; -1 only if a row is somehow gram-less.
 */
function gramStartByGuess(feedback: LetterFeedback[][]): number[] {
  return feedback.map((row) =>
    row.findIndex((t) => t === "gramCorrect" || t === "gramMisplaced")
  );
}

/**
 * Counts distinct non-gram letters tested before the finish: the breadth of the player's
 * information gathering. A letter counts whether it came back present (green/yellow) or absent
 * (gray) -- resolving a letter's status narrows the field either way. Gram tiles are excluded (the
 * gram is given, not tested). The WINNING guess is excluded since it adds no new testing, but a
 * LOSS has no winning guess, so on a loss every guess counts (including the last -- it is a real
 * probe, not a solve). Counting tested rather than only-absent letters is deliberate: a found
 * letter leaves the absent set, so an absent-only count would reward the guess that found less.
 */
function countTestedLetters(
  guesses: string[],
  feedback: LetterFeedback[][],
  won: boolean
): number {
  const tested = new Set<string>();

  // Exclude the winning guess on a win; on a loss there is none, so count every guess.
  const upTo = won ? guesses.length - 1 : guesses.length;
  for (let i = 0; i < upTo; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      const tile = row[p];
      if (tile === "gramCorrect" || tile === "gramMisplaced" || tile === "blank")
        continue;
      tested.add(word[p]);
    }
  }

  return tested.size;
}

/**
 * Per-guess chargeable length deficit: how many letters short of full each guess was, but
 * ZERO for any short guess that still introduced a non-gram letter never tried before. A
 * short guess that does real testing (isolating the last unknown letter, probing a fresh
 * letter cheaply) is doing the game's work, not under-committing, so its shortfall is waived;
 * only a short guess that merely re-treads already-tested letters is charged. Gram tiles are
 * not counted as tested letters (the gram is given). The winning guess is always full length,
 * so it never contributes.
 */
function deficitByGuess(
  guesses: string[],
  feedback: LetterFeedback[][],
  wordLength: number
): number[] {
  const tested = new Set<string>();
  const out: number[] = [];

  for (let i = 0; i < guesses.length; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];
    // Blank columns (offset padding on a slid short guess) are not letters, so
    // the shortfall is measured against the real letter count, not the padded
    // string length.
    const letterCount = word.length - countBlanks(word);
    const short = Math.max(0, wordLength - letterCount);

    let introducedNew = false;
    const letters: string[] = [];
    for (let p = 0; p < word.length; p++) {
      const tile = row[p];
      if (tile === "gramCorrect" || tile === "gramMisplaced" || tile === "blank")
        continue;
      const c = word[p];
      if (!tested.has(c)) introducedNew = true;
      letters.push(c);
    }

    out.push(short > 0 && !introducedNew ? short : 0);
    for (const c of letters) tested.add(c);
  }

  return out;
}

// --- Per-guess variants of the counting helpers above ---------------------------------------
// Each returns a number[] indexed by guess, summing to the matching scalar helper. decomposeScore
// uses these to attribute every point contribution to the guess that caused it, so the per-guess
// skill deltas sum exactly to the whole-game sum. Kept separate from the scalars (which
// computePuzzleScore relies on) so the tuned score is never touched.

function deductionsByGuess(
  guesses: string[],
  feedback: LetterFeedback[][]
): number[] {
  const everYellow = new Set<string>();
  const counted = new Set<string>();
  const out = guesses.map(() => 0);
  for (let i = 0; i < guesses.length; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      const c = word[p];
      if (row[p] === "correct" && everYellow.has(c) && !counted.has(c)) {
        out[i]++;
        counted.add(c);
      }
    }
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "misplaced") everYellow.add(word[p]);
    }
  }
  return out;
}

// Cold placements per guess: a letter placed green (correct) that had NEVER shown up as a yellow
// before -- a fresh position locked with no prior misplaced clue to deduce from. This is the mirror
// image of deductionsByGuess (same walk, inverted everYellow test), and the two are mutually exclusive
// per letter: a green is a deduction exactly when the letter was yellow first, and cold otherwise.
// Gram tiles are excluded (gramCorrect is not "correct" here) -- where the gram sits is scored by
// gramDeduction, not as a letter placement. Each distinct letter is counted at most once (its first
// green), so re-placing an already-locked letter earns nothing.
function coldPlacementsByGuess(
  guesses: string[],
  feedback: LetterFeedback[][]
): number[] {
  const everYellow = new Set<string>();
  const counted = new Set<string>();
  const out = guesses.map(() => 0);
  for (let i = 0; i < guesses.length; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      const c = word[p];
      if (row[p] === "correct" && !everYellow.has(c) && !counted.has(c)) {
        out[i]++;
        counted.add(c);
      }
    }
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "misplaced") everYellow.add(word[p]);
    }
  }
  return out;
}

function gramDeductionsByGuess(
  gramStarts: number[],
  feedback: LetterFeedback[][]
): number[] {
  const wrong = new Set<number>();
  const tmp = gramStarts.map(() => 0);
  for (let i = 0; i < feedback.length; i++) {
    const start = gramStarts[i];
    if (start < 0) continue;
    // Commit the accumulated eliminations once the gram is first placed correctly.
    if (feedback[i][start] === "gramCorrect") return tmp;
    if (feedback[i][start] === "gramMisplaced" && !wrong.has(start)) {
      // The OPENER's wrong gram bet is recorded (so a later re-bet of the same spot is stagnation)
      // but NOT credited: the opener's gram placement is already graded by openerGram, and crediting
      // it here too would double-count it -- exactly why breadth and length also skip the opener.
      // Triangulation credit is for eliminations the player probed AFTER the opener; a sloppy opener
      // that merely bet the gram wrong and then solved did no deliberate triangulation.
      if (i > 0) tmp[i]++;
      wrong.add(start);
    }
  }
  // Never placed correctly (e.g. a loss): no credit, mirroring the scalar helper.
  return gramStarts.map(() => 0);
}

function gramStagnationByGuess(
  gramStarts: number[],
  feedback: LetterFeedback[][],
  guesses: string[] = [],
  avail?: Availability
): number[] {
  const knownWrong = new Set<number>();
  const played = new Set<string>();
  const out = gramStarts.map(() => 0);
  for (let i = 0; i < feedback.length; i++) {
    const start = gramStarts[i];
    if (start >= 0 && feedback[i][start] === "gramMisplaced") {
      // Charged only when the gram was re-parked on a known-wrong spot AND a fresh position was
      // still reachable with an unplayed word; if every reachable spot was already ruled out, the
      // re-test was forced. `knownWrong`/`played` here are the player's knowledge entering guess i.
      if (knownWrong.has(start) && freshGramPositionReachable(avail, played, knownWrong)) {
        out[i]++;
      }
      knownWrong.add(start);
    }
    if (guesses[i] !== undefined) played.add(guessWord(guesses[i]));
  }
  return out;
}

function neglectByGuess(
  guesses: string[],
  feedback: LetterFeedback[][],
  won: boolean,
  probePool?: string[]
): number[] {
  const knownPresent = new Set<string>();
  const placed = new Set<string>();
  const played = new Set<string>();
  const out = guesses.map(() => 0);
  for (let i = 0; i < guesses.length; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];
    // The winning guess placed the answer, so omitting a known letter there is not neglect. A LOSS
    // has no winning guess, so its final guess is a non-winning guess like any other and its
    // omissions do count (mirrors the breadth helpers' win/loss boundary).
    const isWinningGuess = won && i === guesses.length - 1;
    if (i > 0 && !isWinningGuess) {
      for (const c of knownPresent) {
        if (placed.has(c) || word.includes(c)) continue;
        // Only charge the omission if the player could actually have used the letter this turn: some
        // unplayed, non-answer valid word contains it. If the only remaining word with it is the
        // answer (or all others are already played), the omission was forced, not a choice.
        if (!letterProbeable(probePool, played, c)) continue;
        out[i]++;
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

function newTestedByGuess(
  guesses: string[],
  feedback: LetterFeedback[][],
  won: boolean
): number[] {
  const tested = new Set<string>();
  const out = guesses.map(() => 0);
  // Mirror countTestedLetters: skip the winning guess on a win, count every guess on a loss.
  const upTo = won ? guesses.length - 1 : guesses.length;
  for (let i = 0; i < upTo; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      const tile = row[p];
      if (tile === "gramCorrect" || tile === "gramMisplaced" || tile === "blank")
        continue;
      const c = word[p];
      if (!tested.has(c)) {
        tested.add(c);
        out[i]++;
      }
    }
  }
  return out;
}

function wastedByGuess(
  guesses: string[],
  feedback: LetterFeedback[][]
): number[] {
  const knownGreen = new Map<number, string>();
  const absentLetters = new Set<string>();
  const knownWrongPos = new Set<string>();
  const out = guesses.map(() => 0);

  for (let i = 0; i < guesses.length; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];

    if (i > 0) {
      for (let p = 0; p < word.length; p++) {
        const tile = row[p];
        if (tile === "gramCorrect" || tile === "gramMisplaced" || tile === "blank")
          continue;
        const c = word[p];
        if (knownGreen.has(p) && knownGreen.get(p) !== c) out[i]++;
        if (absentLetters.has(c)) out[i]++;
        if (knownWrongPos.has(`${c}@${p}`)) out[i]++;
      }
    }

    for (let p = 0; p < word.length; p++) {
      const c = word[p];
      const tile = row[p];
      if (!tile) continue;
      if (tile === "gramCorrect" || tile === "gramMisplaced" || tile === "blank")
        continue;
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

  return out;
}

/**
 * Grammble scoring: opener-anchored and additive. The score is built as
 *
 *     total = clamp0to100( frame + skill )
 *
 * where `frame` is a running-ledger baseline (the GRADED OPENER minus an escalating turn cost
 * across the guesses after the opener, plus SOLVE_BONUS on a win) and `skill` is the sum of point
 * contributions accumulated guess by guess. This replaces the older guess-count band table: guess
 * count now enters ONLY as a per-turn cost -- the narratable "cost of another turn," steeper for
 * later guesses -- rather than a lookup, so strong play in a slow game can out-earn sloppy play in a
 * fast one while faster wins still keep more of the base (Moderate).
 *
 * The score measures only what the player controls. How the board happened to fall -- whether the
 * answer's letters turned up, whether the field collapsed kindly -- is LUCK, and luck no longer
 * feeds the score at all; it is measured separately as a standalone fortune readout (see luck.ts).
 *
 * FRAME (the opening position, then the cost of playing it out):
 *  - the opener is graded on its own merits -- gram bet, distinct letters, length -- and that grade
 *    is the starting base (see gradeOpener). A good bet scores even when today's answer sits
 *    elsewhere, because it is paid from the prior, not from the outcome.
 *  - minus an escalating turn cost per guess after the opener; plus SOLVE_BONUS on a win.
 *
 * SKILL (decision quality after the opener, controllable) -- the whole of the accumulator:
 *  - breadth: distinct non-gram letters tested before the finish (ramped), split by who tested
 *    them, EXCLUDING the opener (its letters are graded into the frame).
 *  - deduction: a yellow reasoned into a green, scaled by how much was known.
 *  - gramDeduction: distinct wrong gram positions eliminated (triangulation).
 *  - heldGreen: the average green frame carried across the middle guesses.
 *  - minus waste, unproductive length, neglect, and gram stagnation (skill errors).
 *
 * A 1-guess win is a perfect 100. Losses run through the SAME accumulator: they pay every turn
 * cost but never bank SOLVE_BONUS, so a well-played loss can climb while a hollow one sinks; losses
 * trend below wins without being hard-capped beneath them. `gramPositionFractions` carries the
 * per-position prior (see gramPlacementDistribution); when omitted the opener's gram grade is zero
 * and the rest of its grade still stands.
 */
interface ScoreParams {
  guesses: string[];
  feedback: LetterFeedback[][];
  won: boolean;
  wordLength: number;
  gramPositionFractions?: number[];
  // The gram's valid guess words with the answer removed. When present, the "forced"-penalty checks
  // (neglect, gram stagnation) waive a charge the player could not have avoided. Absent -> every
  // charge stands (prior behavior), so old callers, tests, and the sim are unaffected. The router
  // builds this; `gram` lets the stagnation check know where the gram sits in each pool word.
  probePool?: string[];
  gram?: string;
  // Answer-length candidates still consistent with the feedback ENTERING each guess (poolByGuess[i]
  // = words that could still be the answer before guess i was played, the answer among them). When
  // poolByGuess[i] === 1 only the answer fits, so a further non-winning guess is forced clue-gathering
  // and earns exploration relief (see the block in accumulateScore). The router computes this from the
  // solver; absent -> relief never fires, so old callers, tests, and the sim are unaffected.
  poolByGuess?: number[];
}

/**
 * The single scoring pass. Both computePuzzleScore (returns .total) and decomposeScore (returns
 * the whole breakdown) delegate here, so total === frame + skill holds by construction and the two
 * can never drift. Every credit/penalty is added through `add`, tagged to the guess that caused it,
 * so per-guess deltas sum exactly to the whole-game skill total.
 */
function accumulateScore(params: ScoreParams): ScoreBreakdown {
  const { feedback, won, wordLength } = params;
  const fractions = params.gramPositionFractions ?? [];
  const guesses = params.guesses.filter((g) => g.length > 0);
  const n = guesses.length;

  if (n === 0) {
    return {
      total: 0,
      frame: 0,
      frameLines: [],
      skill: 0,
      contributions: [],
      perGuess: [],
    };
  }

  let skillSum = 0;
  const items: ScoreContribution[] = [];
  const perSkill = new Array(n).fill(0);
  const perItems: ScoreContribution[][] = Array.from({ length: n }, () => []);
  // Every point the accumulator adds is skill now: luck no longer feeds the score (it is a separate
  // fortune readout, see luck.ts). `key` identifies the component for the recap; `gi` tags it to the
  // guess that caused it so per-guess deltas sum to the whole-game skill total.
  const add = (key: string, points: number, gi: number) => {
    const g = Math.max(0, Math.min(n - 1, gi));
    skillSum += points;
    perSkill[g] += points;
    if (Math.abs(points) >= 0.05) {
      const c = { key, points: round1(points) };
      items.push(c);
      perItems[g].push(c);
    }
  };

  // finalize takes the itemized frame ledger (parts summing to the running-ledger baseline) rather
  // than a bare number, so the breakdown can surface HOW the base was built, not just its total.
  // maxTotal is the upper clamp: 100 for wins, LOSS_CAP for losses (a loss can never reach a win's
  // range, so its own ceiling sits below 100).
  const finalize = (frameParts: FrameLine[], maxTotal = 100): ScoreBreakdown => {
    const frameBase = frameParts.reduce((s, p) => s + p.points, 0);
    const skill = Math.round(skillSum);
    // The final score always rounds UP (never down): the player keeps the fractional part of a
    // strong game rather than losing it. Taking the max against the summed integer part keeps the
    // rounding line non-negative -- rounding the raw sum alone could land just under the rounded
    // skill sum and read as a downward nudge. The outer ceil is what makes the score a whole
    // number: frameBase is itself fractional now that the opener is graded rather than flat, so
    // neither candidate can be assumed integral. Clamped to 0..maxTotal as the hard score bounds.
    const total = Math.max(
      0,
      Math.min(
        maxTotal,
        Math.ceil(Math.max(frameBase + skill, frameBase + skillSum))
      )
    );
    // frame absorbs the rounding and the 0..100 clamp so frame + skill always reconciles to total.
    const frame = total - skill;
    // The rounding residual becomes its own ledger line so the lines still sum to `frame`. By the
    // max() above it is non-negative and under +1 in the normal range (only the rare 100-clamp can
    // push it lower).
    // round1 here is float hygiene, not a fudge: every frame part is already a tenth, so the
    // residual is exactly representable to a tenth and this only sheds the 68 - 67.4 = 0.599...9
    // noise before it reaches the ledger.
    const rounding = round1(frame - frameBase);
    const frameLines =
      rounding !== 0
        ? [...frameParts, { key: "rounding", points: rounding }]
        : frameParts;
    items.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
    // Apportioned so the per-guess deltas sum to `skill` exactly (see distributeRounding); a plain
    // per-guess Math.round would not, breaking the recap's "deltas add up to skill" invariant.
    const skillDeltas = distributeRounding(perSkill, skill);
    const perGuess = perItems.map((its, i) => ({
      guessIndex: i,
      skillDelta: skillDeltas[i],
      items: [...its].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)),
    }));
    return { total, frame, frameLines, skill, contributions: items, perGuess };
  };

  // A 1-guess win is a perfect game: the whole score is frame, with no skill texture.
  if (won && n === 1) return finalize([{ key: "perfect", points: 100 }]);

  const slots = Math.max(1, wordLength - GRAM_LENGTH);
  const coverage = coverageByGuess(guesses, feedback, slots);
  const gramStarts = gramStartByGuess(feedback);

  // Non-winning guesses are where information is gathered: for a win, the opener through the guess
  // before the finish (0..n-2); for a loss, every guess (0..n-1). coverage is cumulative, so its
  // value at lastNonWin is the pre-finish snapshot; heldGreen averages the frame across 1..lastNonWin.
  const lastNonWin = won ? n - 2 : n - 1;

  // The opener's gram bet is graded into the base (gradeOpener), not credited as skill. Later
  // placements are credited via triangulation/lock below.
  const openerGramStart = gramStarts[0];

  // breadth (skill): distinct non-gram letters tested, ramped, split across the guesses that
  // introduced each new letter. The OPENER IS EXCLUDED from the split -- its letters are graded
  // into the base instead -- but it still counts toward the ramp, because the ramp measures how
  // much of the alphabet the game as a whole covered, and a letter is no less covered for having
  // been played first. What the opener introduced is therefore never paid here.
  const tested = countTestedLetters(guesses, feedback, won);
  const breadthRamp = Math.max(
    0,
    Math.min(
      1,
      (tested - BREADTH_RAMP_LO) / (BREADTH_RAMP_HI - BREADTH_RAMP_LO)
    )
  );
  const breadthPoints = PT * BREADTH_WEIGHT * breadthRamp;
  const newTested = newTestedByGuess(guesses, feedback, won);
  // The opener still gates the ramp (it covers letters like any guess), but its letters are paid in
  // the frame, not here, so the pot is split over the NON-OPENER new testing only. Dividing by that
  // non-opener total -- rather than the whole-game total with the opener's slice thrown away -- is
  // what removes the timing dependence: two games that test the same letters now pay the same
  // breadth regardless of how many of them the opener happened to introduce. The opener's own
  // breadth is rewarded once, in openerLetters.
  const nonOpenerNewTested = newTested.reduce(
    (s, x, i) => (i === 0 ? s : s + x),
    0
  );
  if (breadthPoints > 0 && nonOpenerNewTested > 0) {
    newTested.forEach((t, i) => {
      if (i === 0 || t === 0) return;
      add("breadth", breadthPoints * (t / nonOpenerNewTested), i);
    });
  }

  // deduction (skill): a yellow reasoned into a green, worth more the more was already known GOING
  // INTO that guess. Scaled by coverage[i-1] -- the letter knowledge held before the deduction was
  // made -- not by a single whole-game peak: a placement made once you had narrowed the field is
  // the deliberate deduction the premium is for, while pinning a lone early yellow on a near-empty
  // board is closer to a guess and is scaled down. (Deductions require a prior yellow, so i is
  // always >= 1 here and coverage[i-1] is defined; the ?? 0 only guards the impossible i === 0.)
  // Capped at DEDUCTION_CAP charges across the game (consumed in guess order, like neglect/waste) so
  // a final-guess batch of placed-at-once deduced letters cannot linearly stack past breadth's range.
  const deductions = deductionsByGuess(guesses, feedback);
  let deductionBudget = DEDUCTION_CAP;
  deductions.forEach((d, i) => {
    if (d <= 0 || deductionBudget <= 0) return;
    const charged = Math.min(d, deductionBudget);
    deductionBudget -= charged;
    const knownGoingIn = coverage[i - 1] ?? 0;
    add("deduction", PT * DEDUCTION_WEIGHT * charged * knownGoingIn, i);
  });

  // cold placement (skill): a fresh green with no prior yellow to reason from -- new locked ground,
  // credited at 0.8x the deduction premium per letter. It has its OWN budget so the winning guess's
  // new greens are still paid even when earlier deductions spent the deduction cap. Scaled by coverage
  // going in and skipping the opener (i === 0, graded into the frame), exactly like deduction.
  const coldPlacements = coldPlacementsByGuess(guesses, feedback);
  let coldBudget = COLD_PLACEMENT_CAP;
  coldPlacements.forEach((c, i) => {
    if (i === 0 || c <= 0 || coldBudget <= 0) return;
    const charged = Math.min(c, coldBudget);
    coldBudget -= charged;
    const knownGoingIn = coverage[i - 1] ?? 0;
    add("coldPlacement", PT * COLD_PLACEMENT_WEIGHT * charged * knownGoingIn, i);
  });

  // gram triangulation (skill): distinct wrong gram positions eliminated. Deliberately NOT scaled
  // by letter knowledge (unlike the deduction premium above): where the gram sits is a search axis
  // independent of which letters you have found, so eliminating a wrong gram position is real work
  // whether the letter board is full or empty. Each elimination is already a discrete, verifiable
  // narrowing (one of the few possible starts ruled out), so it does not need the "don't overpay a
  // lone clue" damping that a single ambiguous yellow does -- but it IS capped at GRAM_DEDUCTION_CAP
  // charges across the game (consumed in guess order, like deduction/waste/neglect), so a long game
  // cannot stack an unbounded positional credit and longer modes cannot farm more of it.
  let gramDeductionBudget = GRAM_DEDUCTION_CAP;
  gramDeductionsByGuess(gramStarts, feedback).forEach((d, i) => {
    if (d <= 0 || gramDeductionBudget <= 0) return;
    const charged = Math.min(d, gramDeductionBudget);
    gramDeductionBudget -= charged;
    add("gramDeduction", PT * GRAM_DEDUCTION_WEIGHT * charged, i);
  });

  // skill-error penalties: gram stagnation, waste, unproductive length, neglect (capped in order).
  // Stagnation and neglect waive charges the player could not have avoided (see Availability): a
  // re-parked gram is not charged when no unplayed word could reach a fresh position, and an omitted
  // known letter is not charged when no unplayed non-answer word contains it.
  const availability: Availability = {
    probePool: params.probePool,
    gram: params.gram,
    wordLength,
  };
  gramStagnationByGuess(gramStarts, feedback, guesses, availability).forEach(
    (s, i) => {
      if (s > 0) add("gramStagnation", -PT * GRAM_STAGNATION_WEIGHT * s, i);
    }
  );
  const waste = wastedByGuess(guesses, feedback);
  let wasteBudget = WASTE_CAP;
  waste.forEach((w, i) => {
    if (w <= 0 || wasteBudget <= 0) return;
    const charged = Math.min(w, wasteBudget);
    wasteBudget -= charged;
    add("waste", -PT * WASTE_WEIGHT * charged, i);
  });
  deficitByGuess(guesses, feedback, wordLength).forEach((deficit, i) => {
    // The opener's length is graded into the base (openerLength); charging it here too would
    // punish a short opener twice.
    if (i === 0 || deficit <= 0) return;
    // A short guess that placed deduced letters (yellow -> green) did positional work, so forgive
    // one letter of the shortfall per deduction it made this guess: the same placements credited by
    // the deduction premium above. This only shrinks the charge (a short guess that deduced as many
    // letters as it fell short pays nothing); it never turns the penalty into a bonus.
    const chargeable = Math.max(0, deficit - deductions[i]);
    if (chargeable > 0) add("length", -PT * LENGTH_WEIGHT * chargeable, i);
  });
  let neglectBudget = NEGLECT_CAP;
  neglectByGuess(guesses, feedback, won, params.probePool).forEach((c, i) => {
    if (c <= 0 || neglectBudget <= 0) return;
    const charged = Math.min(c, neglectBudget);
    neglectBudget -= charged;
    add("neglect", -PT * NEGLECT_WEIGHT * charged, i);
  });

  // heldGreen (skill): the average green frame carried across the middle guesses (1..lastNonWin).
  // The guess that first drops the gram into its correct spot (all gram tiles green) reads as
  // FINDING the gram, not holding it -- the lock is new that turn. Everywhere else the frame is
  // genuinely being carried. A gram first placed on the opener (index 0) is graded into the base, so
  // its later middle guesses correctly hold it and never trip this.
  const gramFoundFirst = feedback.findIndex(
    (row) => row.filter((t) => t === "gramCorrect").length === GRAM_LENGTH
  );
  if (lastNonWin >= 1) {
    for (let i = 1; i <= lastNonWin; i++) {
      const row = feedback[i] ?? [];
      let greens = 0;
      for (let p = 0; p < row.length; p++) if (isGreen(row[p])) greens++;
      add(
        i === gramFoundFirst ? "foundGram" : "heldGreen",
        (PT * HELD_GREEN_WEIGHT * (greens / wordLength)) / lastNonWin,
        i
      );
    }
  }

  // strong-play relief (skill, wins only): a slow game should not harshly punish a player who kept
  // GAINING INFORMATION when they could not yet see the answer. Each NON-WINNING post-opener guess
  // that played STRONG -- introduced a new letter (newTested > 0) and re-tested no dead letter
  // (waste === 0) -- while the field had genuinely narrowed toward the endgame (poolByGuess <=
  // STUCK_POOL, i.e. only a handful of possible answers remained: the pool==1 "only the answer fits"
  // case AND its close neighbours) earns back half its turn cost. This lets continued strong play
  // counteract the guess-count penalty exactly where a stuck-but-sharp player would otherwise feel
  // over-docked, without rewarding wheel-spinning (a waste or no-new-letter guess earns nothing) and
  // without touching fast wins (their non-winning guesses sit at a wide-open pool, above the
  // threshold). It is the reward-side sibling of the neglect/stagnation waivers: don't punish a move a
  // sharp player had no better alternative to. Bounded at half the guess's turn cost, so a forced
  // extra guess still nets negative and guess count keeps leading. Needs the solver's per-guess pool
  // counts (the router supplies them); absent poolByGuess it never fires, so old callers, tests, and
  // the sim are unchanged unless they pass it.
  if (won && lastNonWin >= 1 && params.poolByGuess) {
    for (let i = 1; i <= lastNonWin; i++) {
      if (newTested[i] <= 0 || waste[i] > 0) continue;
      if ((params.poolByGuess[i] ?? Infinity) > STUCK_POOL) continue;
      add("exploration", EXPLORATION_RELIEF * perGuessTurnCost(i), i);
    }
  }

  // Luck no longer touches the score. The uncertainty drag, gram-lock relief, coverage and endgame
  // credits that used to live here were the "how the board fell" terms; they are gone from the score
  // and measured separately as a standalone fortune readout (see luck.ts). What the player controls
  // -- breadth, deductions, gram triangulation, held greens, and the clean-play penalties above --
  // is the whole of skill now. Per-guess coverage still scales the deduction premium.

  // Running-ledger base, itemized: the graded opener, then the outcome-specific tail. Skill (added
  // above) builds on top. The parts sum to the baseline and are surfaced so the recap can show the
  // derivation.
  const frameParts: FrameLine[] = gradeOpener(
    guesses[0] ?? "",
    openerGramStart,
    fractions,
    wordLength
  );
  if (won) {
    // Win: opener grade minus the (cheap-first, then flat) turn cost, plus the solve bonus. Clamped
    // to 100.
    if (n > 1) frameParts.push({ key: "turnCost", points: -turnCostFor(n) });
    frameParts.push({ key: "solveBonus", points: SOLVE_BONUS });
    return finalize(frameParts);
  }
  // Loss: no solve bonus and no escalating turn cost -- one flat LOSS_TURN_COST instead -- and a
  // ceiling of LOSS_CAP so a loss can never reach a win's range. Skill (breadth, deductions, held
  // greens, minus capped waste) is what moves the loss within [0, LOSS_CAP], making it gameplay-
  // dependent rather than a flat floor.
  frameParts.push({ key: "lossCost", points: -LOSS_TURN_COST });
  return finalize(frameParts, LOSS_CAP);
}

/**
 * Performance score out of 100, independent of game mode. Delegates to the single accumulator
 * (accumulateScore) and returns its total; see that function for the full model.
 */
export function computePuzzleScore(params: ScoreParams): number {
  return accumulateScore(params).total;
}

/**
 * Itemises a finished game's score into its frame ledger and its SKILL contributions (see recap.ts
 * ScoreBreakdown). Skill is decision quality (deductions, gram triangulation, broad testing, held
 * greens, minus clean-play errors); the graded opener and turn cost live in the frame. Luck is not
 * here -- how the board fell is a separate readout (see luck.ts computeLuck). The breakdown is
 * native: accumulateScore tags every point as it is added, so frame + skill === total by
 * construction, with `frame` carrying the opener grade, turn cost, solve bonus, and rounding/clamp.
 */
export function decomposeScore(params: ScoreParams): ScoreBreakdown {
  return accumulateScore(params);
}
