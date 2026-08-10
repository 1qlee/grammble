import type { LuckTier } from "~/utils/game/recap";

// Player-facing labels for the score's skill contribution keys. The keys are produced by
// decomposeScore (score.ts); the scoring weights never cross to the client, only these numbers
// and keys do. Kept short so a couple can sit under the skill column as its drivers. Every key here
// is skill now: luck no longer feeds the score (see LUCK_TIER_LABELS for the separate fortune
// readout).
export const CONTRIBUTION_LABELS: Record<string, string> = {
  breadth: "Tested a wide range of letters",
  stuckEffort: "Probed for clues with few words left",
  deduction: "Placed letters you had deduced",
  coldPlacement: "Placed a new letter correctly",
  gramDeduction: "Ruled out wrong gram spots",
  positionDeduction: "Ruled out a wrong letter spot",
  foundGram: "Locked the gram in place",
  heldGreen: "Held your locked letters",
  waste: "Re-tested dead letters",
  shortGuess: "Used a word shorter than the answer",
  gramStagnation: "Re-tried a ruled-out gram spot",
  neglect: "Left a known letter unused",
};

// Some contributions read wrong at a fixed magnitude: "Tested a wide range of letters" overstates a
// +2 slice that only added a couple of letters. breadth scales its wording by how much it moved the
// score so the copy tracks the effort -- a small slice reads modest, the full pot reads wide.
const BREADTH_LABELS = {
  min: "Tested a few new letters",
  mid: "Tested several new letters",
  max: "Tested a wide range of letters",
} as const;

// coldPlacement covers one or more fresh greens in a single guess, so its wording pluralizes by the
// number of letters it credited. `count` is that letter count (the note's tile count); when unknown
// (the aggregated overview view) it falls back to the singular phrasing in CONTRIBUTION_LABELS.
const COLD_PLACEMENT_PLURAL = "Placed new letters correctly";

// positionDeduction credits one or more wrong letter-positions eliminated in a single guess, so it
// pluralizes by the number it ruled out (its tile count), like coldPlacement. Falls back to the
// singular in CONTRIBUTION_LABELS when the count is unknown (the aggregated overview view).
const POSITION_DEDUCTION_PLURAL = "Ruled out wrong letter spots";

// neglect charges one or more known letters left unused in a single guess, so it pluralizes by the
// number of neglected letters (its tile count, one cell per letter). Falls back to the singular in
// CONTRIBUTION_LABELS when the count is unknown (the aggregated overview view).
const NEGLECT_PLURAL = "Left known letters unused";

// Resolve a contribution's player-facing label, tiering the wording by magnitude where a fixed
// phrase would misread. `points` is the signed points the item moved; breadth is always positive.
// `count` is the number of board cells the item credited, used to pluralize where the copy names a
// countable thing (coldPlacement, positionDeduction, neglect); omit it and the label falls back to
// its default phrasing.
export function contributionLabel(
  key: string,
  points: number,
  count?: number
): string {
  if (key === "breadth") {
    const p = Math.round(Math.abs(points));
    if (p <= 2) return BREADTH_LABELS.min;
    if (p <= 4) return BREADTH_LABELS.mid;
    return BREADTH_LABELS.max;
  }
  if (key === "coldPlacement" && count != null && count > 1)
    return COLD_PLACEMENT_PLURAL;
  if (key === "positionDeduction" && count != null && count > 1)
    return POSITION_DEDUCTION_PLURAL;
  if (key === "neglect" && count != null && count > 1) return NEGLECT_PLURAL;
  return CONTRIBUTION_LABELS[key] ?? key;
}

// The ends of the diverging skill meter, left (negative) to right (positive): how the player played.
export const AXIS_END_LABELS = {
  skill: { low: "Loose play", high: "Sharp play" },
} as const;

// Player-facing name for each fortune tier (see luck.ts LuckResult.tier). Luck is how the board
// happened to fall, measured independently of the score.
export const LUCK_TIER_LABELS: Record<LuckTier, string> = {
  "very-unlucky": "Very unlucky",
  unlucky: "Unlucky",
  average: "Average luck",
  lucky: "Lucky",
  "very-lucky": "Very lucky",
};

// One-line read of each fortune tier: what the board did, holding the player's guesses fixed. Kept
// separate from anything scored, so the copy never implies the player did well or badly.
export const LUCK_TIER_BLURBS: Record<LuckTier, string> = {
  "very-unlucky":
    "The word hid from your probes. Your guesses turned up far less than an average draw would have.",
  unlucky:
    "The board ran cold. Your guesses earned a little less than an average draw.",
  average: "A fair draw. The board treated your guesses about as expected.",
  lucky:
    "The board leaned your way. Your guesses turned up more than an average draw.",
  "very-lucky":
    "Fortune smiled. The answer fell to your guesses far faster than it had any right to.",
};

// Player-facing labels for the base-score ledger (frameLines from decomposeScore). These sum to the
// base row on the overview slide; the underlying scoring constants stay server-side. winBase is
// absent because its label carries the guess count and is built at render time (see frameLineLabel).
export const FRAME_LABELS: Record<string, string> = {
  winBase: "Solved the puzzle",
  speedBonus: "Fast finish",
  openerGram: "Gram in a likely spot",
  openerLetters: "Distinct letters played",
  openerLength: "Used the full word",
  lossBase: "Did not solve",
  perfect: "Perfect game",
};

// openerLength grades how close the opener was to the full word length, scaling from full credit
// (full-length opener) down to nothing (shortest allowed guess). "Used the full word" only holds at
// full credit; a shorter-but-still-long opener earns a partial credit and gets the neutral phrasing.
const OPENER_LENGTH_PARTIAL = "Length of your opener";

// Player-facing label for a frame ledger line. speedBonus carries the guess count (how fast the solve
// was), built here since the count is not knowable server-side at label time. openerLength is tiered
// on whether the opener hit full length (points vs its max), so a partial-length opener never reads
// "Used the full word". Every other key maps straight through FRAME_LABELS.
export function frameLineLabel(
  key: string,
  opts: { guessCount?: number; points?: number; max?: number } = {}
): string {
  const { guessCount, points, max } = opts;
  if (key === "speedBonus" && guessCount != null)
    return `Fast finish (${guessCount} ${guessCount === 1 ? "guess" : "guesses"})`;
  if (key === "openerLength" && points != null && max != null && points < max)
    return OPENER_LENGTH_PARTIAL;
  return FRAME_LABELS[key] ?? key;
}

// What the opener earned on top of the floor. These are the grade behind "Starting base" rather
// than peers of it, so the ledger indents them beneath it.
export const OPENER_GRADE_KEYS = new Set([
  "openerGram",
  "openerLetters",
  "openerLength",
]);

// The opener's fixed maximum, mirroring OPENER_MAX in score.ts (gram 5 + letters 10 + length 5). The
// opening pillar is capped here so it never reads above its ceiling once the score's rounding crumb is
// folded into it (see splitFrameLines). Keep in sync with the server constant.
export const OPENER_MAX = 20;

// The opener grade is scored as a weighted percentage per criterion (server: gradeOpener), so its
// breakdown reads as a percentage of that criterion's ceiling rather than a raw point count -- the
// weighted points do not add up to a round number, but each criterion's percentage does. Returns null
// for lines that have no ceiling (e.g. the rounding crumb), which keep their raw point display.
export function openerLinePercent(
  points: number,
  max: number | undefined
): string | null {
  if (max == null || max <= 0) return null;
  return `${Math.round((points / max) * 100)}%`;
}
