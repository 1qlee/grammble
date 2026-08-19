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
 *  - openerGram: if the opener placed the gram in its CORRECT slot (gramCorrect), it earns full marks
 *    outright -- landing the gram is the best possible result and is not docked for the slot being
 *    a-priori uncommon. Otherwise the bet is graded RELATIVE to the best slot available by prior
 *    likelihood, so full marks there mean "the most probable spot", not "a spot that happened to be
 *    common": a player who reads ER as a word ending and opens FLOWER earns near-full whether or not
 *    today's answer actually ends in ER. (Before 2026-08-10 a correct-but-unlikely bet was graded only
 *    on prior, so a wrong bet on the popular slot could outscore a correct bet on a rare one.)
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
  wordLength: number,
  gramCorrectOnOpener: boolean
): FrameLine[] {
  const lines: FrameLine[] = [];

  const bestFrac = fractions.length > 0 ? Math.max(...fractions) : 0;
  if (openerGramStart >= 0 && gramCorrectOnOpener) {
    // The gram landed in its true position: full marks, graded on the outcome, not the prior.
    lines.push({
      key: "openerGram",
      points: OPENER_GRAM_WEIGHT,
      max: OPENER_GRAM_WEIGHT,
      exact: true,
    });
  } else if (openerGramStart >= 0 && bestFrac > 0) {
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

// Penalty per wasted-info tile, shared by "Re-tested dead letters" (waste) and "Overwrote a locked-in
// letter" (wasteGreen). Buffed to NEGLECT parity (2026-08-13): 0.04 -> 0.06, so throwing away
// information you already had (re-testing a gray, overwriting a locked green) costs the same per tile as
// neglecting a known-present letter (NEGLECT_WEIGHT). This DECOUPLES waste from breadth's per-letter
// mirror rate (BREADTH_WEIGHT / (HI - LO) = 0.04): waste used to be that mirror, but the mirror now
// lives only on shortGuess (forgone coverage). NO COUNT CAP: continuously reusing dead information is
// continuous bad play and is penalized continuously (unlike neglect, which stays capped -- it has no
// clean anchor and can be forced by a thin board, whereas re-testing dead info is always avoidable).
const WASTE_WEIGHT = 0.06;

// Extra flat penalty (2026-08-17) layered ON TOP of the dead-letter waste above when a letter is
// replayed in the EXACT tile where it already came back gray -- a more blatant repeat than re-testing a
// dead letter in a fresh slot, so it takes an additional fixed nudge. PT-INDEPENDENT (a flat point, like
// STUCK_BUFF_CAP): the same-spot repeat is a fixed unforced error, not a term that should scale with the
// skill weight. Charged per offending tile.
const SAME_POS_WASTE_PENALTY = 1;

// Premium for converting a yellow into a correctly placed green: you had to deduce
// the position, which is skill, not luck. A letter handed to you as a green earns
// no premium; placing a letter you only knew as a yellow does. This is what lets a
// yellow-built solve edge the green-built one at the same guess count. Credited FLAT per letter with
// no board-coverage scaling (removed 2026-08-15), so it sits at exact per-letter parity with cold
// placement (COLD_PLACEMENT_WEIGHT === DEDUCTION_WEIGHT, both unscaled). The count is bounded by
// DEDUCTION_CAP rather than damped by how much was known going in. Set (2026-08-15) so a placed letter
// is worth ~2 points: PT * DEDUCTION_WEIGHT = 48 * 0.042 = 2.02. Was 0.06 (2.88); the user wanted each
// placed letter closer to +2 in the recap. Kept just ABOVE breadth's per-letter rate (0.04 = 1.92) so
// placing a deduced letter still beats merely testing one.
const DEDUCTION_WEIGHT = 0.042;
// Max total deduction CHARGES per game (a count, like NEGLECT_CAP). Deduction is the
// only positive credit that would otherwise scale linearly and unbounded with letters placed: a
// yellow-heavy solve that hoards every letter as a misplaced tile and then dumps them all green on
// the winning guess earns one deduction PER letter at once -- five letters in a 7-length answer would
// stack to +10, dwarfing every other skill term and dragging a mid-count win toward 100. Capping the
// count holds deduction's ceiling at DEDUCTION_CAP * DEDUCTION_WEIGHT (3 * 0.042 = 0.126, PT-scaled),
// the anchor the gram/position/cold credits are calibrated against (asserted in score-ceilings.test.ts).
// This still sits ABOVE breadth's ceiling (BREADTH_WEIGHT = 0.12): placing letters you deduced is
// stronger play than merely testing letters, so the deduction family tops the skill ledger and breadth
// sits below it. Placing a batch of deduced letters still reads as strong play without eclipsing
// everything, and placing letters green early is no longer punished relative to hoarding.
const DEDUCTION_CAP = 3;

// Premium for a COLD placement: a green placed on a letter that was never seen as a yellow first --
// the player guessed the letter AND its exact spot with no prior misplaced clue to reason from. That
// is real progress (a freshly locked position), priced at full parity with a yellow -> green
// deduction: placing a letter you never had a clue for is no less skillful than placing one you did.
// It is UNCAPPED and NOT scaled by board coverage -- a game can only cold-place as many letters as the
// mode has non-gram tiles, so the count is naturally bounded by play (like gram/position deduction),
// and a fresh green is credited the same whether the board was empty or nearly solved going in.
const COLD_PLACEMENT_WEIGHT = DEDUCTION_WEIGHT;

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

// Direct penalty for playing a guess SHORTER than the full word length: charged per missing letter on
// any non-opener guess whether or not it tested something new. This is the breadth MIRROR: each missing
// slot is a forgone letter test -- it declines exactly the breadth a full-length slot could have
// gathered -- so it is priced at breadth's per-letter rate BREADTH_WEIGHT / (HI - LO) = 0.12 / 3 = 0.04.
// The literal is inlined because BREADTH_WEIGHT is defined below this point; the score-ceilings test
// pins it to the computed mirror so a breadth-ramp change can't silently desync it. It was `= WASTE_WEIGHT`
// until waste was buffed off the mirror to neglect parity (2026-08-13); short-guess is forgone coverage,
// not thrown-away information, so it stayed on the mirror. UNCAPPED: continuously playing short is
// continuous forfeited coverage, and the total can only match the breadth those slots declined to earn.
// The opener is exempt (its length is graded into the frame by openerLength).
const SHORT_GUESS_WEIGHT = 0.04;

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
// dominate a mid-count win. Matching DEDUCTION_WEIGHT removes the headline weight; and since letter
// deduction is itself no longer coverage-scaled (2026-08-15), their per-letter rates are now identical.
// The only remaining difference is the cap -- letter deduction is capped at DEDUCTION_CAP charges, gram
// triangulation is uncapped (see below) as a strictly one-per-guess narrowing -- so where the gram sits
// is an independent search axis and an elimination is real work on a full or empty board either way.
//
// NO COUNT CAP (2026-08-11): gram triangulation is a strictly ONE-PER-GUESS narrowing -- a guess bets
// the gram at exactly one start, so it can rule out at most one wrong position per turn. It cannot be
// dumped in a batch the way letter deduction/coldPlacement can, so there is no one-shot spike to guard
// against; and each elimination costs a whole guess, whose speed penalty far outweighs the ~2 credit.
// This is the same reasoning that uncapped breadth (both are spread-across-turns rewards). Previously
// capped at 3 to hold a parity ceiling and normalize across modes; that silently zeroed the 4th/5th
// eliminations a player spent real turns earning. Longer modes having more gram slots is not farming --
// those extra eliminations each cost an extra guess.
const GRAM_DEDUCTION_WEIGHT = 0.042;

// Ruling out a wrong LETTER position: an already-known-present letter (seen yellow earlier) replayed
// at a slot not previously ruled out and still yellow eliminates one more place that letter can sit.
// This is the letter-position sibling of gramDeduction (ruling out a wrong gram spot) -- the same
// narrowing on a different search axis -- weighted at parity with it, NOT coverage-scaled (where a
// letter sits is an axis independent of how much of the alphabet you have found), and skipping the
// opener. The letter's FIRST yellow is not paid here -- that is its discovery, credited by breadth --
// so discovery and a later green (deduction) are never double-counted.
//
// NO COUNT CAP (2026-08-11): uncapped alongside gramDeduction. In principle a single guess can rule out
// several letter-positions at once (replaying multiple known letters), a batch gram triangulation can't
// form -- but measured against an adversarial farmer, per-guess eliminations top out at 4 (7/8-letter,
// rare) and never reach 5, so the one-shot dump this cap guarded is effectively a phantom. It produces
// only YELLOWS, never a solve, so it cannot spike a fast win the way the green-dumping deduction/cold
// caps guard against. The per-GAME total can accumulate higher than gram's (positions x letters is 2D
// vs gram's 1D), but farming positions works against solving, so a heavy farmer loses -- and a loss is
// clamped at LOSS_CAP, which absorbs the tail. Reward continued narrowing; don't clip it at 3.
const POSITION_DEDUCTION_WEIGHT = GRAM_DEDUCTION_WEIGHT;

// Penalty for re-placing the gram at a start already proven wrong (a repeated gramMisplaced
// at the same position). That probe learns nothing new about the gram -- the position was
// already ruled out -- so a player who parks the gram on a known-wrong spot instead of
// testing a fresh one is charged, mirroring the letter-waste penalty for a repeated gray.
// Priced at exactly 2x WASTE_WEIGHT (0.12 = 2 * 0.06): a wasted gram occupies two tiles, so
// re-parking the two-letter gram on a known-wrong spot costs what two dead letters would. Tracks
// WASTE_WEIGHT: when the wasted-info rate was buffed to neglect parity, this rose with it (2026-08-13).
// This is a pricing convention (mechanically you forgo one gram-position hypothesis, not two tests), but
// a gram-placement bet is high-value narrowing, so 2x a single dead letter is a conservative floor.
// Keeping a CONFIRMED-correct gram fixed is never charged (a correct start is never in the
// known-wrong set), so efficient letter play is untouched.
const GRAM_STAGNATION_WEIGHT = 0.12;

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
// additionally rewarded by the deduction / held-green / cold-placement credits, so finding still beats
// mere testing.
//
// The credit RAMPS from a floor rather than paying from the first letter: a guess earns nothing until
// the game has tested BREADTH_RAMP_LO distinct letters and reaches the full per-game BREADTH_WEIGHT at
// BREADTH_RAMP_HI. Below the floor a repeat-heavy or narrow guess earns almost nothing -- the carrot
// that discourages duplicate-heavy guesses without a direct penalty. Past BREADTH_RAMP_HI the ramp is
// NOT capped (see rampAt in accumulateScore): it keeps rising at the same per-letter rate, so a player
// who keeps probing fresh letters deep in a hard game is still credited for the clues each one gathers.
// Only the non-winning guesses count (the winning guess adds no new testing).
//
// Weight is deliberately BELOW the deduction family (DEDUCTION_CAP * DEDUCTION_WEIGHT = 0.18): merely
// testing letters ranks under placing letters you deduced, so breadth no longer tops the ledger. Was
// 0.18 (at parity with deduction); trimmed to 0.12 on 2026-08-10 so an info-gathering probe cannot
// out-earn the deductions and placements that actually crack the answer.
const BREADTH_WEIGHT = 0.12;
const BREADTH_RAMP_LO = 4;
const BREADTH_RAMP_HI = 7;

// The tuning table, exposed ONLY for the ceiling-invariant test (score-ceilings.test.ts) and any
// calibration tooling. These are the exact same constants used throughout this module -- referenced,
// not re-declared, so they can never drift from the values the scorer actually uses. Grouping them
// lets a test assert the relationships the comments claim (e.g. the capped deduction family sits at a
// common ceiling, above breadth's, independent of PT) instead of trusting hand-computed numbers in
// prose. Server-only like
// the rest of score.ts; never import this from the client. A component's PT-scaled point CEILING is
// PT * weight for the ramped/averaged credits (breadth, heldGreen) and PT * cap * weight for the
// count-capped ones (deduction). coldPlacement/gramDeduction/positionDeduction are per-letter at
// deduction's weight but uncapped, bounded by play rather than a fixed charge count.
export const SCORE_TUNING = {
  PT,
  BREADTH_WEIGHT,
  BREADTH_RAMP_LO,
  BREADTH_RAMP_HI,
  DEDUCTION_WEIGHT,
  DEDUCTION_CAP,
  COLD_PLACEMENT_WEIGHT,
  GRAM_DEDUCTION_WEIGHT,
  POSITION_DEDUCTION_WEIGHT,
  NEGLECT_WEIGHT,
  NEGLECT_CAP,
  SHORT_GUESS_WEIGHT,
  WASTE_WEIGHT,
  SAME_POS_WASTE_PENALTY,
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
 * The gram's start position within each guess, read from the feedback row (the index of
 * the first gramCorrect/gramMisplaced tile). Every valid guess contains the gram exactly
 * once in its feedback, so this is well defined; -1 only if a row is somehow gram-less.
 */
function gramStartByGuess(feedback: LetterFeedback[][]): number[] {
  return feedback.map((row) =>
    row.findIndex((t) => t === "gramCorrect" || t === "gramMisplaced")
  );
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

// Classify every FRESH green (a "correct" tile placed at a position not already locked on an earlier
// guess) as either a DEDUCTION (a prior yellow instance of that letter was available to reason from)
// or a COLD placement (no prior instance -- an unclued lock). deductionsByGuess and
// coldPlacementsByGuess are thin views over this single walk, so they stay mutually exclusive by
// construction.
//
// Duplicate letters are handled PER INSTANCE. The answer can hold a letter more than once (e.g. two
// Es), and the player may have had a yellow clue for only some of them. `knownPresent[c]` is how many
// instances of c were confirmed present ENTERING the guess -- the max non-absent (yellow or green)
// count of c in any single earlier guess, since K non-absent tiles of c in one guess prove at least K
// instances in the answer. Each fresh green consumes one known instance as a deduction; greens beyond
// the confirmed count are cold. So a second E locked green with only one E ever seen yellow is one
// deduction PLUS one cold placement, not a single credit swallowing the duplicate (the old
// `counted`-by-letter walk credited each letter at most once, dropping the extra instance entirely).
//
// Knowledge is folded in AFTER crediting, so a letter first sighted this turn never reclassifies a
// green placed on the same guess. Positions locked on an earlier guess are skipped, so re-showing a
// held green never re-credits. Gram tiles are excluded (gramCorrect is not "correct") -- where the
// gram sits is scored by gramDeduction, not as a letter placement.
function classifyGreenPlacements(
  guesses: string[],
  feedback: LetterFeedback[][]
): { deductions: number[]; cold: number[] } {
  const knownPresent = new Map<string, number>();
  const assignedGreens = new Map<string, number>();
  const lockedPos = new Set<number>();
  const deductions = guesses.map(() => 0);
  const cold = guesses.map(() => 0);
  for (let i = 0; i < guesses.length; i++) {
    const word = guesses[i] ?? "";
    const row = feedback[i] ?? [];
    for (let p = 0; p < word.length; p++) {
      if (row[p] !== "correct" || lockedPos.has(p)) continue;
      const c = word[p];
      const seen = assignedGreens.get(c) ?? 0;
      if (seen < (knownPresent.get(c) ?? 0)) deductions[i]++;
      else cold[i]++;
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
  return { deductions, cold };
}

function deductionsByGuess(
  guesses: string[],
  feedback: LetterFeedback[][]
): number[] {
  return classifyGreenPlacements(guesses, feedback).deductions;
}

function coldPlacementsByGuess(
  guesses: string[],
  feedback: LetterFeedback[][]
): number[] {
  return classifyGreenPlacements(guesses, feedback).cold;
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
  // Skip the winning guess on a win (it adds no new testing); count every guess on a loss.
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

// Two distinct kinds of self-inflicted waste, tracked separately so the recap can label them
// accurately: `dead` re-tests information already known to be BAD (a known-absent letter, or a letter
// on a position already ruled out for it), while `overwrite` throws away information known to be GOOD
// (a different letter played on a slot already locked green). Both cost the same, but they are opposite
// mistakes, so they must not share one line of copy.
//
// `sameDeadPos` is an EXTRA charge layered on top of `dead`: replaying a letter in the exact tile where
// it already came back gray (dead at that position) is a more blatant repeat than re-testing a dead
// letter somewhere new, so it takes an additional flat nudge (SAME_POS_WASTE_PENALTY). Tracked by
// letter@position over every prior gray tile, independent of whether the letter is fully absent (a
// letter green elsewhere but gray here is still dead in THIS slot).
function wastedByGuess(
  guesses: string[],
  feedback: LetterFeedback[][]
): { dead: number[]; overwrite: number[]; sameDeadPos: number[] } {
  const knownGreen = new Map<number, string>();
  const absentLetters = new Set<string>();
  const knownWrongPos = new Set<string>();
  const grayAtPos = new Set<string>();
  const dead = guesses.map(() => 0);
  const overwrite = guesses.map(() => 0);
  const sameDeadPos = guesses.map(() => 0);

  for (let i = 0; i < guesses.length; i++) {
    const word = guesses[i];
    const row = feedback[i] ?? [];

    if (i > 0) {
      for (let p = 0; p < word.length; p++) {
        const tile = row[p];
        if (tile === "gramCorrect" || tile === "gramMisplaced" || tile === "blank")
          continue;
        const c = word[p];
        if (knownGreen.has(p) && knownGreen.get(p) !== c) overwrite[i]++;
        if (absentLetters.has(c)) dead[i]++;
        if (knownWrongPos.has(`${c}@${p}`)) dead[i]++;
        if (grayAtPos.has(`${c}@${p}`)) sameDeadPos[i]++;
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
        grayAtPos.add(`${c}@${p}`);
        const presentElsewhere = word
          .split("")
          .some((ch, q) => ch === c && (isGreen(row[q]) || isYellow(row[q])));
        if (!presentElsewhere) absentLetters.add(c);
      }
    }
  }

  return { dead, overwrite, sameDeadPos };
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

  const gramStarts = gramStartByGuess(feedback);

  // Non-winning guesses are where information is gathered: for a win, the opener through the guess
  // before the finish (0..n-2); for a loss, every guess (0..n-1). heldGreen averages the frame across
  // 1..lastNonWin.
  const lastNonWin = won ? n - 2 : n - 1;

  // The opener's gram bet is graded into the base (gradeOpener), not credited as skill. Later
  // placements are credited via triangulation/lock below.
  const openerGramStart = gramStarts[0];

  // breadth (skill): distinct non-gram letters tested, ramped. Each non-opener guess earns only the
  // SLICE OF THE RAMP its own new letters filled -- rampAt(cumAfter) - rampAt(cumBefore) -- rather than
  // a share of a single whole-game pot. The OPENER IS EXCLUDED from being paid (its letters are graded
  // into the frame as openerLetters), but its letters still advance the cumulative count, so the ramp
  // it filled is simply dropped, NOT redistributed to a later guess. This is what stops a thin mid-guess
  // that added a letter or two from pocketing the breadth its opener ramped up: a guess that itself
  // widens the field from narrow to broad earns more, while one riding an already-wide board earns only
  // the little ramp its own letters added. Timing-independent across the non-opener guesses (the ramp
  // slices are additive regardless of how the new letters split across guesses).
  //
  // NO GAME CAP (2026-08-11): the ramp reaches full credit at BREADTH_RAMP_HI but is NOT clamped there;
  // it keeps rising linearly, so every new distinct letter tested earns the same per-letter credit no
  // matter how deep in the game it comes. A player who keeps probing fresh letters for clues is never
  // told those clues were worthless. There is no farming risk to guard against here: breadth is a small
  // per-letter reward that cannot come close to offsetting the guess-count penalties a long game
  // accrues, so continuing to make informative guesses is simply not punished. The ramp keeps only its
  // LOWER floor (below BREADTH_RAMP_LO a narrow/repeat-heavy guess still earns nothing).
  const rampAt = (k: number): number =>
    Math.max(0, (k - BREADTH_RAMP_LO) / (BREADTH_RAMP_HI - BREADTH_RAMP_LO));
  const breadthCeil = PT * BREADTH_WEIGHT;
  const newTested = newTestedByGuess(guesses, feedback, won);
  // Wasted counts per guess, split into re-tested BAD info (dead) and discarded GOOD info (overwrite);
  // computed here so the stuck-strong breadth buff below can require a fully clean guess. Their
  // penalties are applied later, in the waste block, as two separately labeled lines.
  const {
    dead: wasteDead,
    overwrite: wasteOverwrite,
    sameDeadPos: wasteSameDeadPos,
  } = wastedByGuess(guesses, feedback);
  // New wrong letter-positions ruled out per guess; credited below (position triangulation).
  const positionRuledOut = positionRuledOutByGuess(guesses, feedback);
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
    wasteDead[i] === 0 &&
    wasteOverwrite[i] === 0 &&
    wasteSameDeadPos[i] === 0 &&
    (params.poolByGuess[i] ?? Infinity) <= STUCK_POOL;
  let stuckBudget = STUCK_BUFF_CAP;
  let cumTested = 0;
  newTested.forEach((t, i) => {
    const before = cumTested;
    cumTested += t;
    if (i === 0 || t === 0) return;
    const share = breadthCeil * (rampAt(cumTested) - rampAt(before));
    if (share <= 0) return;
    add("breadth", share, i);
    if (stuckStrong(i) && stuckBudget > 0) {
      const bonus = Math.min(stuckBudget, share * STUCK_BUFF);
      stuckBudget -= bonus;
      add("stuckEffort", bonus, i);
    }
  });

  // deduction (skill): a yellow reasoned into a green. Credited FLAT at DEDUCTION_WEIGHT per letter,
  // NO board-coverage scaling (removed 2026-08-15): placing a letter you had a yellow clue for is skill
  // regardless of how much of the board was known going in, and this puts it at exact per-letter parity
  // with cold placement (both PT * DEDUCTION_WEIGHT * count), so "Placed letters you had deduced" and
  // "Placed a new letter correctly" are worth the same per letter -- previously deduction was damped by
  // coverage while cold was not, so a cold green could out-earn a deduced one. Still capped at
  // DEDUCTION_CAP charges across the game (consumed in guess order, like neglect/waste) so a final-guess
  // batch of placed-at-once deduced letters cannot linearly stack past the family ceiling.
  const deductions = deductionsByGuess(guesses, feedback);
  let deductionBudget = DEDUCTION_CAP;
  deductions.forEach((d, i) => {
    if (d <= 0 || deductionBudget <= 0) return;
    const charged = Math.min(d, deductionBudget);
    deductionBudget -= charged;
    add("deduction", PT * DEDUCTION_WEIGHT * charged, i);
  });

  // cold placement (skill): a fresh green with no prior yellow to reason from -- new locked ground,
  // credited at full parity with the deduction premium per letter. Uncapped and not scaled by board
  // coverage: the count is bounded by how many non-gram tiles the mode has, and a fresh green is worth
  // the same regardless of how much of the board was known going in. Skips the opener (i === 0, graded
  // into the frame), like deduction.
  const coldPlacements = coldPlacementsByGuess(guesses, feedback);
  coldPlacements.forEach((c, i) => {
    if (i === 0 || c <= 0) return;
    add("coldPlacement", PT * COLD_PLACEMENT_WEIGHT * c, i);
  });

  // gram triangulation (skill): distinct wrong gram positions eliminated. Deliberately NOT scaled
  // by letter knowledge (unlike the deduction premium above): where the gram sits is a search axis
  // independent of which letters you have found, so eliminating a wrong gram position is real work
  // whether the letter board is full or empty. Each elimination is already a discrete, verifiable
  // narrowing (one of the few possible starts ruled out), so it does not need the "don't overpay a
  // lone clue" damping that a single ambiguous yellow does. It is NOT capped (see GRAM_DEDUCTION_WEIGHT):
  // one elimination per guess, each turn-paid, so every wrong gram spot the player ruled out is credited.
  gramDeductionsByGuess(gramStarts, feedback).forEach((d, i) => {
    if (d <= 0) return;
    add("gramDeduction", PT * GRAM_DEDUCTION_WEIGHT * d, i);
  });

  // position triangulation (skill): distinct wrong LETTER positions eliminated -- a known-present
  // letter replayed at a fresh slot that comes back yellow again (see POSITION_DEDUCTION_WEIGHT). The
  // letter analog of gram triangulation above at parity weight, no coverage damping, NOT stuck-buffed,
  // and (like gram triangulation) NOT capped: every wrong letter-position the player ruled out is paid.
  positionRuledOut.forEach((d, i) => {
    if (d <= 0) return;
    add("positionDeduction", PT * POSITION_DEDUCTION_WEIGHT * d, i);
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
  // Re-testing known-BAD info (dead letters / ruled-out positions) and discarding known-GOOD info
  // (a letter played over a locked green) are opposite mistakes at the same weight, so they are two
  // separate ledger lines rather than one mislabeled "dead letters" line.
  //
  // The "Re-tested dead letters" (waste) charge folds in an unlabeled extra: replaying a letter in the
  // EXACT tile it already showed gray in adds a flat SAME_POS_WASTE_PENALTY per tile ON TOP of the
  // per-tile dead-letter weight. It is deliberately NOT its own line -- it silently deepens the waste
  // number. Both are added in ONE add("waste") call per guess so the recap shows a single line (two
  // separate add()s of the same key would render as two). A tile gray-here but green-elsewhere is not in
  // wasteDead, so on such a guess the same-spot penalty can stand alone under the waste key.
  wasteDead.forEach((w, i) => {
    const penalty =
      PT * WASTE_WEIGHT * w + SAME_POS_WASTE_PENALTY * wasteSameDeadPos[i];
    if (penalty <= 0) return;
    add("waste", -penalty, i);
  });
  wasteOverwrite.forEach((w, i) => {
    if (w <= 0) return;
    add("wasteGreen", -PT * WASTE_WEIGHT * w, i);
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
  // the no-progress penalty above, so a short guess always carries a cost. Uncapped -- each missing
  // slot is a forgone letter test priced at the breadth mirror, so the total stays proportionate.
  shortfallByGuess(guesses, wordLength).forEach((short, i) => {
    if (i === 0 || short <= 0) return;
    add("shortGuess", -PT * SHORT_GUESS_WEIGHT * short, i);
  });

  // heldGreen (skill): the average CARRIED green frame across the middle guesses (1..lastNonWin) --
  // only greens at a POSITION already locked on an earlier guess count, never a green first placed
  // this turn (that is deduction/cold placement, paid there). The guess that first drops the gram into
  // its correct spot (all gram tiles green) reads as FINDING the gram, not holding it -- the lock is
  // new that turn, so it credits every green it shows. A gram first placed on the opener (index 0) is
  // graded into the base, so its later middle guesses correctly hold it and never trip this.
  const gramFoundFirst = feedback.findIndex(
    (row) => row.filter((t) => t === "gramCorrect").length === GRAM_LENGTH
  );
  if (lastNonWin >= 1) {
    // A green counts as HELD only if the SAME POSITION has already shown green on an earlier guess --
    // the player carried that exact lock forward. A green placed at a NEW position this turn is a
    // deduction/cold placement, credited there, and must NOT feed heldGreen or the line contradicts its
    // own note. Tracking by position (not letter) is what distinguishes carrying a locked letter from
    // placing a SECOND instance of that letter for the first time: e.g. one E already green at its slot
    // while the other E, previously yellow, is now placed at a fresh slot -- that second E is a
    // deduction, not held. foundGram is the exception: that guess is defined by locking the gram tiles
    // fresh, so it credits every green it shows. Seeded with the opener's green positions.
    const greenPos = new Set<number>();
    const seedRow = feedback[0] ?? [];
    for (let p = 0; p < seedRow.length; p++)
      if (isGreen(seedRow[p])) greenPos.add(p);
    for (let i = 1; i <= lastNonWin; i++) {
      const row = feedback[i] ?? [];
      const isFound = i === gramFoundFirst;
      let greens = 0;
      for (let p = 0; p < row.length; p++)
        if (isGreen(row[p]) && (isFound || greenPos.has(p))) greens++;
      add(
        isFound ? "foundGram" : "heldGreen",
        (PT * HELD_GREEN_WEIGHT * (greens / wordLength)) / lastNonWin,
        i
      );
      // Record this guess's green positions AFTER scoring, so a slot first locked this turn is held
      // only from the next turn on.
      for (let p = 0; p < row.length; p++)
        if (isGreen(row[p])) greenPos.add(p);
    }
  }

  // Locking the gram in its correct spot for the FIRST time ON the winning guess is otherwise
  // unrewarded: the heldGreen/foundGram loop above only runs through lastNonWin (n - 2 on a win), so a
  // gram first placed correctly on the final guess falls outside it, and gramDeduction pays only the
  // wrong spots ELIMINATED before it, never the correct placement itself. Letter greens on the winning
  // guess ARE already paid (deduction/coldPlacement fire on every guess), so this closes that
  // asymmetry -- the final gram lock earns a flat gram-family credit (PT * GRAM_DEDUCTION_WEIGHT, at
  // parity with one elimination), surfaced under the same "Found the gram's position" line. Guarded to
  // FIRST placement on the win: a gram already locked on an earlier guess was merely held into the win.
  if (won && gramFoundFirst === n - 1) {
    add("foundGram", PT * GRAM_DEDUCTION_WEIGHT, n - 1);
  }

  // Luck no longer touches the score. The uncertainty drag, gram-lock relief, coverage and endgame
  // credits that used to live here were the "how the board fell" terms; they are gone from the score
  // and measured separately as a standalone fortune readout (see luck.ts). What the player controls
  // -- breadth, deductions, gram triangulation, held greens, and the clean-play penalties above --
  // is the whole of skill now.

  // Base ledger, itemized: on a win the flat solve credit plus the speed bonus for finishing early
  // (omitted at the slowest win, where it is zero), on a loss the lower LOSS_BASE; then the graded
  // opener that rides on top. Skill (added above) builds on top of all of it. The parts sum to the
  // baseline and are surfaced so the recap can show the derivation. A win is clamped to 100; a loss to
  // LOSS_CAP, which sits below any clean win's range.
  const gramCorrectOnOpener =
    openerGramStart >= 0 &&
    feedback[0]?.[openerGramStart] === "gramCorrect";
  const openerLines = gradeOpener(
    guesses[0] ?? "",
    openerGramStart,
    fractions,
    wordLength,
    gramCorrectOnOpener
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
