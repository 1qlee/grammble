import type { GameMode } from "~/utils/game/constants";

// Flavor headline shown at the top of the end-game dialog, keyed by the number
// of guesses it took to win (1-6). LOSS covers a failed puzzle. Roughly ten
// options per bucket; the dialog picks one deterministically off the puzzle
// number so it stays stable across re-renders but varies day to day.
export const WIN_MESSAGES: Record<number, string[]> = {
  1: [
    "Word-in-one.",
    "Perfection.",
    "Unreal.",
    "Pure genius.",
    "First try.",
    "Flawless.",
    "Mic drop.",
    "Nailed it.",
    "Bullseye.",
    "Outrageous.",
  ],
  2: [
    "Nice work.",
    "Sharp.",
    "Smooth.",
    "Two and through.",
    "Brilliant.",
    "Quick thinking.",
    "Impressive.",
    "So clean.",
    "Locked in.",
    "Dialed.",
  ],
  3: [
    "Solid.",
    "Well played.",
    "Nicely done.",
    "Good eye.",
    "Steady.",
    "On point.",
    "Clean solve.",
    "That works.",
    "Right on.",
    "No notes.",
  ],
  4: [
    "Got there.",
    "Good grind.",
    "Clutch.",
    "Pulled it off.",
    "Nice recovery.",
    "Found it.",
    "Persistence pays.",
    "That'll do.",
    "Made it count.",
    "Earned it.",
  ],
  5: [
    "Phew.",
    "Down to the wire.",
    "Cut it close.",
    "Just made it.",
    "Nervy finish.",
    "Clutch save.",
    "Squeaked by.",
    "Heart rate up?",
    "Barely.",
    "On the edge.",
  ],
  6: [
    "Last gasp.",
    "At the buzzer.",
    "No room to spare.",
    "Final-row finish.",
    "That was close.",
    "Survived.",
    "Down to the last.",
    "Whew, made it.",
    "Clutch sixth.",
    "Nail-biter.",
  ],
};

export const LOSS_MESSAGES: string[] = [
  "Better luck tomorrow.",
  "So close.",
  "Tomorrow's another shot.",
  "Not today.",
  "Tough one.",
  "It happens.",
  "Shake it off.",
  "Next time.",
  "Almost had it.",
  "On to the next.",
];

// Number words for the green banner headline ("Six in two.").
export const GUESS_COUNT_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
};

// Length word per mode for the banner headline ("Six in two.").
export const MODE_LENGTH_WORDS: Record<GameMode, string> = {
  SIX: "Six",
  SEVEN: "Seven",
  EIGHT: "Eight",
};

export function pickMessage(
  won: boolean,
  guessCount: number,
  seed: number,
): string {
  const pool = won ? (WIN_MESSAGES[guessCount] ?? []) : LOSS_MESSAGES;
  const fallback = won ? "Nice work." : "Better luck tomorrow.";
  if (pool.length === 0) return fallback;
  const index = Math.abs(seed) % pool.length;
  return pool[index];
}
