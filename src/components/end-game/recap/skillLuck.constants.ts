import type { LuckTier } from "~/utils/game/recap";

// Player-facing labels for the score's skill contribution keys. The keys are produced by
// decomposeScore (score.ts); the scoring weights never cross to the client, only these numbers
// and keys do. Kept short so a couple can sit under the skill column as its drivers. Every key here
// is skill now: luck no longer feeds the score (see LUCK_TIER_LABELS for the separate fortune
// readout).
export const CONTRIBUTION_LABELS: Record<string, string> = {
  breadth: "Tested a wide range of letters",
  deduction: "Placed letters you had deduced",
  coldPlacement: "Placed a new letter correctly",
  gramDeduction: "Ruled out wrong gram spots",
  foundGram: "Locked the gram in place",
  heldGreen: "Held your locked letters",
  exploration: "Gathered clues while stuck",
  waste: "Re-tested dead letters",
  length: "Shortened without testing anything new",
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

// Resolve a contribution's player-facing label, tiering the wording by magnitude where a fixed
// phrase would misread. `points` is the signed points the item moved; breadth is always positive.
export function contributionLabel(key: string, points: number): string {
  if (key === "breadth") {
    const p = Math.round(Math.abs(points));
    if (p <= 2) return BREADTH_LABELS.min;
    if (p <= 4) return BREADTH_LABELS.mid;
    return BREADTH_LABELS.max;
  }
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
// base row on the overview slide; the underlying scoring constants stay server-side. turnCost is
// absent because its label carries the guess count and is built at render time.
export const FRAME_LABELS: Record<string, string> = {
  openerFloor: "Starting base",
  openerGram: "Gram in a likely spot",
  openerLetters: "Distinct letters played",
  openerLength: "Used the full word",
  solveBonus: "Solved the puzzle",
  lossCost: "Did not solve",
  rounding: "Score rounding",
  perfect: "Perfect game",
};

// What the opener earned on top of the floor. These are the grade behind "Starting base" rather
// than peers of it, so the ledger indents them beneath it.
export const OPENER_GRADE_KEYS = new Set([
  "openerGram",
  "openerLetters",
  "openerLength",
]);
