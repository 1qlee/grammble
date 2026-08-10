import { GRAM_LENGTH, MAX_GUESSES, MIN_GUESS_LENGTH } from "~/utils/game/constants";
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
const PT = 48;

// The score is BASE + SKILL. The base is a pure GUESS-COUNT pedestal: a win at n guesses starts from
// winBaseFor(n) and nothing else -- no unconditional floor, no per-turn ledger, no solve bonus. The
// pedestal is high for a fast win and steps down WIN_BASE_STEP points per extra guess, so guess count
// still leads the score, but it deliberately tops out at 100 - SKILL_HEADROOM (NOT 100), reserving the
// top SKILL_HEADROOM points for what the player demonstrably did. Everything the player controls --
// the opener's gram bet, distinct letters and length (graded in gradeOpener), plus the post-opener
// skill ledger -- stacks on top of that pedestal and is the ONLY thing that fills the reserved
// headroom. A skill-less fast win therefore sits at its pedestal while a well-played one climbs toward
// 100, and because the per-guess step is smaller than the headroom, a strong slow game can overtake a
// weak faster one (Moderate). A 1-guess win short-circuits to a flat 100 (the opener WAS the answer --
// a perfect game). Luck never touches the score: how the board fell is a separate fortune readout
// (see luck.ts).
//
//   total(win)  = clamp0to100( winBaseFor(n) + openerGrade + postOpenerSkill )
//   total(loss) = clamp0toLOSS_CAP( LOSS_BASE + openerGrade + postOpenerSkill )
//
// Why a pedestal instead of the old flat-floor-minus-turn-cost ledger: the old OPENER_FLOOR handed 60
// of 100 to every game unconditionally, and the low first-guess turn cost let almost every fast win
// pin against the 100 ceiling, so skill had nowhere to move. Here the pedestal varies with the one
// thing a win earns by outcome (speed), and the reserved headroom guarantees skill a place to land at
// every guess count.
// A win's base is a flat SOLVE credit plus a SPEED bonus for finishing early. WIN_SOLVE_BASE is what
// any win starts from regardless of speed (it is also the slowest win's whole base, at n ===
// MAX_GUESSES, where no speed is banked). The speed bonus then rewards guesses saved,
// g = MAX_GUESSES - n, on a PROGRESSIVE curve: each guess saved is worth more than the last (the
// increments grow), so an elite fast solve pops toward 100 while the slow end stays low -- which also
// leaves more of the reserved headroom for skill at the higher guess counts, where a player actually
// has the turns to demonstrate it. The fastest win (n === 2) banks the whole SPEED_INCREMENTS sum, so
// its base is WIN_SOLVE_BASE + sum(SPEED_INCREMENTS); the opener grade and skill fill the rest up to
// 100. A 1-guess win short-circuits to a flat 100 before any of this.
// Held at 22 (LOSS_BASE 14 stays below it). The fastest win's base is WIN_SOLVE_BASE + sum(SPEED) = 70,
// so a perfect 2-guess (base 70 + opener 20 + max 2-guess skill 9) lands exactly at 99 -- 100 is
// reserved exclusively for the perfect 1-guess.
const WIN_SOLVE_BASE = 22;
// Per-guess-saved speed increments, indexed by the guess-saved count minus one: the 1st guess saved
// (n === MAX_GUESSES - 1) is worth SPEED_INCREMENTS[0], the last (n === 2) worth the final entry.
// Progressive here (6, 10, 14, 18, summing to a 48-point max bonus at n === 2). Dialed back from a
// 60-point max to make room for the opener's raised 20-point ceiling while keeping the 99 cap on a
// 2-guess. For a LINEAR speed reward instead, set every entry equal (e.g. [12, 12, 12, 12]); the shape
// is the only thing to swap.
const SPEED_INCREMENTS = [6, 10, 14, 18];

// The opener is graded, not gifted, and its grade is the FIRST slice of the reserved skill headroom:
// it rides ON TOP of the guess-count pedestal (as frame lines, so the recap can show the opener's
// derivation), not inside it. Everything a player controls on guess 1 -- where they bet the gram, how
// many distinct letters they spent, whether they used the whole word -- is knowable before any
// feedback exists, so it is credited HERE and nowhere else (breadth and length skip the opener, so a
// good opening is paid exactly once):
//
//   openerGrade = gram weight * gram%  +  letters weight * letters%  +  length weight * length%
//               = 5 * gram%            +  10 * letters%              +  5 * length%   = up to 20
//
// Each criterion is scored as a PERCENTAGE of what was achievable on it, then scaled by a fixed weight
// that sums, across the three, to OPENER_MAX (20). This is mode-INDEPENDENT: the opener tops out at 20
// in every game mode, and the recap shows each line as its own percentage (0..100%), not a raw point
// number, so the three percentages read cleanly on their own scale even though their weighted points do
// not add up to a round number. The percentages are:
//   - gram%    = fractions[openerGramStart] / bestFrac -- how close the gram bet was to the best slot.
//   - letters% = distinct non-gram letters / non-gram slots (wordLength - GRAM_LENGTH).
//   - length%  = how close the opener was to full length (full = 100%, shortest legal guess = 0%).
//
// Distinct letters carries the most weight (10) -- it is what the player actually spent. Gram (5) and
// length (5) are equal and smaller: the gram bet is a PRIOR-based guess rewarded before any feedback
// exists, so it should not dominate, and merely using a long word is the least skillful of the three.
// Because each line is weight * fraction it is generally fractional; the recap hides that behind the
// percentage display, and the frame's rounding line reconciles the fractional sum into the score.
const OPENER_MAX = 20;
const OPENER_GRAM_WEIGHT = 5;
const OPENER_LETTERS_WEIGHT = 10;
const OPENER_LENGTH_WEIGHT = 5;

// The candidate pool (answer-length words still consistent with the feedback) at or below which the
// player is treated as "in the endgame": few possible answers remain, so a further strong guess is
// clue-gathering toward a word they cannot yet see, not sloppy wheel-spinning on a wide-open field.
// This generalizes the pool==1 "only the answer fits" case to its close neighbours (2, 3, ... left),
// which is where a good player's late narrowing guesses actually sit -- pool==1 alone is too narrow
// because a player who reaches it usually just plays the answer. Fast wins are unaffected: their
// non-winning guesses sit at a wide pool, above this line.
const STUCK_POOL = 6;

// Extra credit (as a fraction of the guess's normal breadth share) for a guess that tested a fresh
// letter while genuinely stuck: a won game's post-opener guess that introduced a new letter and
// wasted nothing while the field had narrowed to the endgame (poolByGuess <= STUCK_POOL). This
// replaces the former standalone "exploration" turn-cost refund: probing sharply when few valid words
// remain earns a small effort bonus. It is credited as its OWN ledger line (`stuckEffort`), NOT folded
// into breadth, so the recap can explain the concept ("few words left, but you still probed for
// clues"). positionDeduction is deliberately NOT buffed -- it stays at parity with the other deductions.
const STUCK_BUFF = 0.25;

// Hard ceiling on the total stuck-effort bonus across a game (points, PT-independent). The bonus is a
// small pat on the back for effort, not a scoring lever, so it is capped low rather than left to scale
// with breadth. Charged in guess order against this budget, like the deduction/waste caps.
const STUCK_BUFF_CAP = 3;

// A loss gets its own low pedestal, LOSS_BASE, below the slowest win's pedestal (winBaseFor(6) === 22)
// so a solved game always starts above an unsolved one -- this gap is what the removed solve bonus used
// to express. On top of LOSS_BASE the loss still earns the opener grade and the same skill ledger, and
// is clamped to LOSS_CAP, a ceiling that keeps even a well-played loss below a clean win's range. What
// moves a loss within [0, LOSS_CAP] is that ledger: breadth, deductions, triangulation and held greens
// lift it, waste (capped) lowers it, so a broad exploratory loss lands well above a lazy one.
const LOSS_BASE = 14;
const LOSS_CAP = 50;

// The speed bonus for an n-guess WIN: the sum of SPEED_INCREMENTS over the guesses saved
// (g = MAX_GUESSES - n). Zero at the slowest win (n === MAX_GUESSES) and the full sum at n === 2.
// With the progressive default it yields 48, 30, 16, 6, 0 for n = 2..6, so the whole win base
// (WIN_SOLVE_BASE + this) is 70, 52, 38, 28, 22. A 1-guess win never calls this (flat 100).
function speedBonusFor(n: number): number {
  const saved = MAX_GUESSES - n;
  let bonus = 0;
  for (let i = 0; i < saved && i < SPEED_INCREMENTS.length; i++) {
    bonus += SPEED_INCREMENTS[i];
  }
  return bonus;
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
 *  - openerLetters: distinct non-gram letters spent, as a percentage of the non-gram slots, scaled by
 *    a weight of 10. Repeating a letter wastes a slot, so it scores strictly lower than a repeat-free
 *    opener of the same length.
 *  - openerLength: how close the opener was to full length, as a percentage (full = 100%, shortest
 *    legal guess = 0%), scaled by a weight of 5.
 *
 * Each line's `points` is weight * percentage and its `max` is the weight, so the three sum to at most
 * OPENER_MAX (20) in every mode; the recap renders points / max as the percentage.
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
  const lines: FrameLine[] = [];

  const bestFrac = fractions.length > 0 ? Math.max(...fractions) : 0;
  if (openerGramStart >= 0 && bestFrac > 0) {
    const frac = Math.max(0, Math.min(1, fractions[openerGramStart] ?? 0));
    lines.push({
      key: "openerGram",
      points: round1(OPENER_GRAM_WEIGHT * (frac / bestFrac)),
      max: OPENER_GRAM_WEIGHT,
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
  // letters% = distinct non-gram letters / non-gram slots, scaled by the letters weight (10). The
  // recap shows the percentage; the points are weight * fraction and may be fractional.
  const slots = Math.max(1, wordLength - GRAM_LENGTH);
  const distinct = Math.min(chosen.size, slots);
  lines.push({
    key: "openerLetters",
    points: round1(OPENER_LETTERS_WEIGHT * (distinct / slots)),
    max: OPENER_LETTERS_WEIGHT,
  });

  // length% = how close the opener was to full length, scaled by the length weight (5). Full length is
  // 100%, the shortest legal guess is 0%. Count real letters, not blank offset padding.
  const spread = Math.max(1, wordLength - MIN_GUESS_LENGTH);
  const openerLen = opener.replace(/ /g, "").length;
  const deficit = Math.max(0, Math.min(spread, wordLength - openerLen));
  lines.push({
    key: "openerLength",
    points: round1(OPENER_LENGTH_WEIGHT * (1 - deficit / spread)),
    max: OPENER_LENGTH_WEIGHT,
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
// count win to ~100. Capping the count holds deduction's ceiling near breadth's -- both are
// PT-scaled so the match is independent of PT's value: DEDUCTION_CAP * DEDUCTION_WEIGHT (3 * 0.06 =
// 0.18) equals BREADTH_WEIGHT (0.18), so deduction's max and breadth's max are equal by construction
// (asserted in score-ceilings.test.ts). Placing a batch of deduced letters still reads as strong
// play without eclipsing the whole ledger, and placing letters green early is no longer punished
// relative to hoarding.
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

// Direct penalty for playing a guess SHORTER than the full word length: a flat cost of not committing
// to the answer length, charged per missing letter on any non-opener guess whether or not it tested
// something new, at the softer neglect weight. Capped like neglect so a run of short guesses cannot
// stack an unbounded penalty. The opener is exempt (its length is graded into the frame by
// openerLength).
const SHORT_GUESS_WEIGHT = NEGLECT_WEIGHT;
const SHORT_GUESS_CAP = NEGLECT_CAP;

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
// triangulation credit for the same skill. Capping the count holds its ceiling at parity with the
// other capped credits -- GRAM_DEDUCTION_CAP * GRAM_DEDUCTION_WEIGHT equals DEDUCTION_CAP *
// DEDUCTION_WEIGHT, so their PT-scaled maxes match by construction (asserted in
// score-ceilings.test.ts) -- and normalizes it across word lengths.
const GRAM_DEDUCTION_CAP = 3;

// Ruling out a wrong LETTER position: an already-known-present letter (seen yellow earlier) replayed
// at a slot not previously ruled out and still yellow eliminates one more place that letter can sit.
// This is the letter-position sibling of gramDeduction (ruling out a wrong gram spot) -- the same
// narrowing on a different search axis -- so it is deliberately calibrated AT PARITY with it: same
// per-elimination weight and the same count cap. Like gramDeduction it is NOT coverage-scaled (where
// a letter sits is an axis independent of how much of the alphabet you have found) and skips the
// opener. Its own budget keeps it from competing with the gram cap. The letter's FIRST yellow is not
// paid here -- that is its discovery, credited by breadth -- so discovery and a later green
// (deduction) are never double-counted.
const POSITION_DEDUCTION_WEIGHT = GRAM_DEDUCTION_WEIGHT;
const POSITION_DEDUCTION_CAP = GRAM_DEDUCTION_CAP;

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

// The tuning table, exposed ONLY for the ceiling-invariant test (score-ceilings.test.ts) and any
// calibration tooling. These are the exact same constants used throughout this module -- referenced,
// not re-declared, so they can never drift from the values the scorer actually uses. Grouping them
// lets a test assert the parity relationships the comments claim (e.g. a capped credit's max equals
// breadth's, independent of PT) instead of trusting hand-computed numbers in prose. Server-only like
// the rest of score.ts; never import this from the client. A component's PT-scaled point CEILING is
// PT * weight for the ramped/averaged credits (breadth, heldGreen) and PT * cap * weight for the
// count-capped ones (deduction, coldPlacement, gramDeduction, positionDeduction).
export const SCORE_TUNING = {
  PT,
  BREADTH_WEIGHT,
  DEDUCTION_WEIGHT,
  DEDUCTION_CAP,
  COLD_PLACEMENT_WEIGHT,
  COLD_PLACEMENT_CAP,
  GRAM_DEDUCTION_WEIGHT,
  GRAM_DEDUCTION_CAP,
  POSITION_DEDUCTION_WEIGHT,
  POSITION_DEDUCTION_CAP,
  NEGLECT_WEIGHT,
  NEGLECT_CAP,
  SHORT_GUESS_WEIGHT,
  SHORT_GUESS_CAP,
  WASTE_WEIGHT,
  WASTE_CAP,
  GRAM_STAGNATION_WEIGHT,
  HELD_GREEN_WEIGHT,
} as const;

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

// Raw per-guess length shortfall: how many letters short of the full word each guess was, with NO
// productivity waiver (the direct short-guess penalty charges it whether or not the guess tested
// something new).
// Blank padding on a slid short guess is not a letter. Feeds the direct short-guess penalty
// (SHORT_GUESS_WEIGHT); the caller exempts the opener. A winning guess is the full-length answer, so
// its shortfall is always 0 and it never contributes.
function shortfallByGuess(guesses: string[], wordLength: number): number[] {
  return guesses.map((word) => {
    const letterCount = word.length - countBlanks(word);
    return Math.max(0, wordLength - letterCount);
  });
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

// Distinct NEW wrong letter-positions eliminated per guess (see POSITION_DEDUCTION_WEIGHT). A letter
// ALREADY known present going into the guess (seen yellow on an earlier guess) is replayed at a slot
// not previously ruled out and comes back yellow again: one more place that letter cannot sit. The
// letter analog of gramDeductionsByGuess. Knowledge is read ENTERING each guess (everYellow /
// knownWrongPos are folded in AFTER crediting), so a letter's first yellow -- its discovery, paid by
// breadth -- earns nothing here, and a green placement (a deduction) is `correct`, not `misplaced`,
// so it is naturally excluded too.
function positionRuledOutByGuess(
  guesses: string[],
  feedback: LetterFeedback[][]
): number[] {
  const everYellow = new Set<string>();
  const knownWrongPos = new Set<string>();
  const out = guesses.map(() => 0);
  for (let i = 0; i < guesses.length; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      if (row[p] !== "misplaced") continue;
      const c = word[p];
      if (everYellow.has(c) && !knownWrongPos.has(`${c}@${p}`)) out[i]++;
    }
    for (let p = 0; p < word.length; p++) {
      if (row[p] === "misplaced") {
        everYellow.add(word[p]);
        knownWrongPos.add(`${word[p]}@${p}`);
      }
    }
  }
  return out;
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
 * Grammble scoring: base-plus-skill and additive. The score is built as
 *
 *     total = clamp0to100( frame + skill )
 *
 * where `frame` is a GUESS-COUNT PEDESTAL plus the graded opener that rides on it, and `skill` is the
 * sum of point contributions accumulated guess by guess. The pedestal (winBaseFor(n)) is the only
 * place guess count enters: it is high for a fast win and steps down per extra guess, but it tops out
 * at 100 - SKILL_HEADROOM, reserving the top of the range for the opener grade and skill. Because the
 * per-guess step is smaller than that reserved headroom, strong play in a slow game can out-earn
 * sloppy play in a fast one (Moderate) while faster wins still start from a higher pedestal.
 *
 * The score measures only what the player controls. How the board happened to fall -- whether the
 * answer's letters turned up, whether the field collapsed kindly -- is LUCK, and luck no longer
 * feeds the score at all; it is measured separately as a standalone fortune readout (see luck.ts).
 *
 * FRAME (the guess-count pedestal, then the opening position that rides on it):
 *  - a pure guess-count pedestal: winBaseFor(n) on a win, LOSS_BASE on a loss. No unconditional floor,
 *    no per-turn cost, no solve bonus (the pedestal gap between a win and a loss replaces it).
 *  - plus the opener graded on its own merits -- gram bet, distinct letters, length (see gradeOpener).
 *    A good bet scores even when today's answer sits elsewhere, because it is paid from the prior, not
 *    the outcome. This grade is the first slice of the reserved skill headroom.
 *
 * SKILL (decision quality after the opener, controllable) -- the whole of the accumulator:
 *  - breadth: distinct non-gram letters tested before the finish (ramped), split by who tested
 *    them, EXCLUDING the opener (its letters are graded into the frame).
 *  - deduction: a yellow reasoned into a green, scaled by how much was known.
 *  - gramDeduction: distinct wrong gram positions eliminated (triangulation).
 *  - positionDeduction: distinct wrong letter positions eliminated (a known letter replayed at a
 *    fresh slot, still yellow) -- the letter analog of gramDeduction.
 *  - heldGreen: the average green frame carried across the middle guesses.
 *  - minus waste, a direct short-guess penalty, neglect, and gram stagnation (skill errors).
 *
 * A 1-guess win is a perfect 100. Losses run through the SAME accumulator: they start from the lower
 * LOSS_BASE pedestal and are capped at LOSS_CAP, so a well-played loss can climb while a hollow one
 * sinks, yet a loss never reaches a clean win's range. `gramPositionFractions` carries the
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
  // and earns the stuck-strong breadth buff (see the breadth block in accumulateScore). The router
  // computes this from the solver; absent -> the buff never fires, so old callers, tests, and the sim
  // are unaffected.
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
  // Wasted (dead-letter retry) count per guess; computed here so the stuck-strong breadth buff below
  // can require a clean guess. Its own capped penalty is applied later, in the waste block.
  const waste = wastedByGuess(guesses, feedback);
  // New wrong letter-positions ruled out per guess; credited below (position triangulation).
  const positionRuledOut = positionRuledOutByGuess(guesses, feedback);
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
  // A won game's post-opener guess that kept probing sharply while genuinely stuck -- introduced a new
  // letter, wasted nothing, and the field had narrowed to the endgame (poolByGuess <= STUCK_POOL) --
  // earns a STUCK_BUFF premium on the breadth it contributed, credited as its own `stuckEffort` line
  // (capped at STUCK_BUFF_CAP total) rather than inflating the breadth number. This is the reward-side
  // sibling of the neglect/stagnation waivers: don't under-credit a move a sharp player had no better
  // alternative to. It needs the solver's per-guess pool counts (the router supplies them); absent
  // poolByGuess it never fires, so old callers, tests, and the sim are unchanged unless they pass it.
  const stuckStrong = (i: number): boolean =>
    won &&
    i >= 1 &&
    i <= lastNonWin &&
    !!params.poolByGuess &&
    newTested[i] > 0 &&
    waste[i] === 0 &&
    (params.poolByGuess[i] ?? Infinity) <= STUCK_POOL;
  let stuckBudget = STUCK_BUFF_CAP;
  if (breadthPoints > 0 && nonOpenerNewTested > 0) {
    newTested.forEach((t, i) => {
      if (i === 0 || t === 0) return;
      const share = breadthPoints * (t / nonOpenerNewTested);
      add("breadth", share, i);
      if (stuckStrong(i) && stuckBudget > 0) {
        const bonus = Math.min(stuckBudget, share * STUCK_BUFF);
        stuckBudget -= bonus;
        add("stuckEffort", bonus, i);
      }
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

  // position triangulation (skill): distinct wrong LETTER positions eliminated -- a known-present
  // letter replayed at a fresh slot that comes back yellow again (see POSITION_DEDUCTION_WEIGHT). The
  // letter analog of gram triangulation above: same parity weight, same count cap consumed in guess
  // order, its own budget, and no coverage damping. It is NOT stuck-buffed -- it stays at parity with
  // the other deductions rather than riding the breadth premium.
  let positionDeductionBudget = POSITION_DEDUCTION_CAP;
  positionRuledOut.forEach((d, i) => {
    if (d <= 0 || positionDeductionBudget <= 0) return;
    const charged = Math.min(d, positionDeductionBudget);
    positionDeductionBudget -= charged;
    add("positionDeduction", PT * POSITION_DEDUCTION_WEIGHT * charged, i);
  });

  // skill-error penalties: gram stagnation, waste, neglect, short guess (capped in order).
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
  let wasteBudget = WASTE_CAP;
  waste.forEach((w, i) => {
    if (w <= 0 || wasteBudget <= 0) return;
    const charged = Math.min(w, wasteBudget);
    wasteBudget -= charged;
    add("waste", -PT * WASTE_WEIGHT * charged, i);
  });
  let neglectBudget = NEGLECT_CAP;
  neglectByGuess(guesses, feedback, won, params.probePool).forEach((c, i) => {
    if (c <= 0 || neglectBudget <= 0) return;
    const charged = Math.min(c, neglectBudget);
    neglectBudget -= charged;
    add("neglect", -PT * NEGLECT_WEIGHT * charged, i);
  });
  // Direct short-guess penalty: every non-opener guess shorter than the full word is charged per
  // missing letter, unconditionally (see SHORT_GUESS_WEIGHT). Purely about length and separate from
  // the no-progress penalty above, so a short guess always carries a cost. Capped in guess order.
  let shortGuessBudget = SHORT_GUESS_CAP;
  shortfallByGuess(guesses, wordLength).forEach((short, i) => {
    if (i === 0 || short <= 0 || shortGuessBudget <= 0) return;
    const charged = Math.min(short, shortGuessBudget);
    shortGuessBudget -= charged;
    add("shortGuess", -PT * SHORT_GUESS_WEIGHT * charged, i);
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

  // Luck no longer touches the score. The uncertainty drag, gram-lock relief, coverage and endgame
  // credits that used to live here were the "how the board fell" terms; they are gone from the score
  // and measured separately as a standalone fortune readout (see luck.ts). What the player controls
  // -- breadth, deductions, gram triangulation, held greens, and the clean-play penalties above --
  // is the whole of skill now. Per-guess coverage still scales the deduction premium.

  // Base ledger, itemized: on a win the flat solve credit plus the speed bonus for finishing early
  // (omitted at the slowest win, where it is zero), on a loss the lower LOSS_BASE; then the graded
  // opener that rides on top. Skill (added above) builds on top of all of it. The parts sum to the
  // baseline and are surfaced so the recap can show the derivation. A win is clamped to 100; a loss to
  // LOSS_CAP, which sits below any clean win's range.
  const openerLines = gradeOpener(
    guesses[0] ?? "",
    openerGramStart,
    fractions,
    wordLength
  );
  if (won) {
    const speed = speedBonusFor(n);
    const frameParts: FrameLine[] = [
      { key: "winBase", points: WIN_SOLVE_BASE },
      ...(speed > 0 ? [{ key: "speedBonus", points: speed }] : []),
      ...openerLines,
    ];
    return finalize(frameParts, 100);
  }
  return finalize([{ key: "lossBase", points: LOSS_BASE }, ...openerLines], LOSS_CAP);
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
