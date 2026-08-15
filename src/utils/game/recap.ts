import type { GameAnalysis } from "~/utils/game/analysis";

// Client-safe shared types for the premium game recap. The solver that produces
// NarrowingResult lives in solver.ts (server-only, since it loads the answer
// pool); only these types cross to the client, never the answer list itself.

export interface GuessNarrowing {
  guess: string;
  // Possible answers still standing before this guess was played...
  before: number;
  // ...and after applying the feedback it actually returned.
  after: number;
  // A capped, alphabetical sample of the still-valid words that are answer-length -- the words that
  // could actually be the solution. `answerTotal` is the true count of these; answers.length <= it.
  answers: string[];
  answerTotal: number;
  // The sharpest next guesses a player could play to narrow the field, ranked by how finely each one
  // splits the answer-length survivors (information gain). Drawn from the whole gram pool at any valid
  // length, minus the current candidates and already-played words, so a high-information probe (often
  // a full-length word that has been ruled out as the answer) surfaces distinct from the likely
  // answers. Capped and pre-filtered to genuinely informative probes, so a short list of good moves.
  probes: string[];
  // Only populated once the field is down to a single answer (when `probes` is empty by construction,
  // since there is nothing left to narrow): a small, varied sample of other valid words that contain
  // the gram but no longer match the clues. Purely inspirational -- a reminder of what was playable
  // for a stuck player, never words that could still be the answer.
  otherWords: string[];
}

export interface NarrowingResult {
  // Possible answers for the gram before any guess (answer-length words only; shorter valid guesses
  // are narrowing tools, not candidate solutions).
  start: number;
  perGuess: GuessNarrowing[];
  // Candidates still possible entering the winning guess (win only, else null):
  // 1 means the answer was fully deduced, more means the finish had some luck.
  solvedWith: number | null;
  guessCount: number;
  won: boolean;
}

// How often the gram sits at each start position across the whole answer pool.
// Used for the first-guess slide: a player's opening choice is really a bet on
// where the gram lives, so we show the prior odds of each placement.
export interface GramPositionStat {
  // 0-based index in the answer where the gram starts.
  position: number;
  // Answers (in the pool, containing the gram) with the gram at this position.
  count: number;
  // count / (answers containing the gram): the odds this placement is right.
  fraction: number;
}

export interface GramPlacement {
  gram: string;
  wordLength: number;
  gramLength: number;
  positions: GramPositionStat[];
  // Where the opening guess put the gram (its first occurrence), or null if the
  // first guess is missing. `chosenAligned` is true when that placement matched
  // the answer (the opener earned gramCorrect feedback).
  chosenPosition: number | null;
  chosenAligned: boolean;
  // Where the gram actually sits in the answer (its first occurrence). Lets the opener slide
  // compare the player's placement to the truth without the "but you were right" grammar bug.
  answerPosition: number;
}

// Skill decomposition of the score. The score is built additively as frame + skill (see score.ts):
// every credit or penalty is a decision-quality (skill) point added on top of the frame baseline,
// so `frame + skill === total` holds by construction (frame is the running-ledger baseline -- opener
// grade minus a turn cost per extra guess plus the solve bonus -- plus the rounding/clamp
// adjustment). Points are signed: skill-error penalties (waste, unproductive short guesses) are
// negative. Luck is NOT part of the score -- how the board fell is a separate readout (see
// LuckResult / luck.ts). Computed server-side by decomposeScore (score.ts is server-only); only
// these numbers cross to the client, never the scoring weights.
export interface ScoreContribution {
  // Stable identifier the client maps to a label (e.g. "breadth", "deduction", "gramDeduction").
  key: string;
  // Signed raw points this component added to (or removed from) the score.
  points: number;
}

// One guess's slice of the skill decomposition: the signed points that guess added, plus its own
// itemized contributions. Summing skillDelta across every guess reproduces the whole-game skill
// point sum (the same add() calls, tagged by guess).
export interface PerGuessBreakdown {
  guessIndex: number;
  skillDelta: number;
  items: ScoreContribution[];
}

// One line of the base-score ledger: how the running-ledger baseline (frame) was built, item by
// item, so the recap can show the opener base, the per-turn costs, and the solve bonus that sum
// to it. `key` is mapped to a player-facing label on the client (see FRAME_LABELS); the scoring
// constants themselves never cross over, only these already-computed points do.
export interface FrameLine {
  // Stable identifier: the opener's grade ("openerFloor" | "openerGram" | "openerLetters" |
  // "openerLength"), then "turnCost" | "solveBonus" | "adjustment" | "perfect".
  key: string;
  // Signed points this line added to (or removed from) the base score.
  points: number;
  // The most points this line could have awarded, for the graded opener items where a partial credit
  // is possible (openerGram/openerLetters/openerLength). Omitted for fixed or penalty lines, where an
  // "out of" ceiling is not meaningful. Lets the recap render "+3/10" style caps.
  max?: number;
  // openerGram only: the opener placed the gram in its CORRECT position (gramCorrect), so it earns full
  // marks outright rather than the prior-likelihood grade. Lets the recap swap "likely spot" -> "correct
  // place". Absent/false means the gram bet was graded on prior likelihood.
  exact?: boolean;
}

export interface ScoreBreakdown {
  // The final score, identical to computePuzzleScore (delegated, never recomputed here).
  total: number;
  // Running-ledger baseline (opener grade minus a turn cost per extra guess, plus the solve bonus)
  // plus the rounding/clamp adjustment: the part that is not the player's post-opener skill.
  frame: number;
  // The itemized ledger that sums to `frame`: opener grade, per-turn costs, solve bonus, and any
  // rounding/clamp adjustment. Lets the recap show how the base was built rather than a bare number.
  frameLines: FrameLine[];
  // Net decision-quality points (deductions, triangulation, broad testing, held greens, minus
  // clean-play errors). frame + skill === total.
  skill: number;
  // Itemized nonzero contributions, largest magnitude first, for a detailed readout.
  contributions: ScoreContribution[];
  // The same contributions attributed to the guess that caused them, one entry per guess (in
  // play order). Drives the per-guess carousel slides.
  perGuess: PerGuessBreakdown[];
}

// How the board treated the player, measured independently of the score (see luck.ts). Luck is
// "expected vs actual field collapse": holding the player's guesses fixed and varying only the
// hidden answer over the real answer pool, did the answer land in a smaller-than-expected surviving
// group (lucky) or a larger one (unlucky). It is orthogonal to skill by construction -- a better
// guess lowers the expectation, and only the deviation of the realised outcome from that
// expectation is luck -- and it does NOT feed the score. It is surfaced purely as end-of-game
// colour: "the board was kind" / "the word hid from your probes".
export type LuckTier =
  | "very-unlucky"
  | "unlucky"
  | "average"
  | "lucky"
  | "very-lucky";

// One guess's luck: the answer pool still standing before it (`before`), the expected surviving
// group size under a uniform-random answer (`expected` = E), the group the real answer actually
// fell into (`actual` = A), and the luck that guess earned in bits (log2(E/A), positive = luckier
// than the guess statistically deserved). `isWin` marks the guess that ended the game.
export interface LuckGuess {
  guess: string;
  before: number;
  expected: number;
  actual: number;
  bits: number;
  isWin: boolean;
}

export interface LuckResult {
  // Total luck in bits (narrowing + finish), signed. Positive = the board was kinder than the
  // player's guesses statistically earned; negative = the word hid from their probes.
  bits: number;
  // Narrowing luck: how kindly the field collapsed given the guesses, excluding the winning stab.
  narrowingBits: number;
  // Finish luck: winning from a wide field. ~0 when the answer was deduced, large when it was a
  // lucky stab from many survivors. Zero on a loss (no winning guess).
  finishBits: number;
  // The five-way fortune tier: the only luck value the UI shows. Derived from `bits` against the
  // mode's boundaries (see luck.ts). Deliberately coarse -- it answers "were you lucky", not a
  // precise rank -- because there is no real playerbase to compute a percentile against.
  tier: LuckTier;
  perGuess: LuckGuess[];
}

export interface GameRecap {
  narrowing: NarrowingResult;
  gramPlacement: GramPlacement;
  analysis: GameAnalysis;
  breakdown: ScoreBreakdown;
  luck: LuckResult;
}
