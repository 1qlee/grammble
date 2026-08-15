import type { LetterFeedback } from "~/stores/game-store";

export const FEEDBACK_CLASSES: Record<LetterFeedback, string> = {
  correct: "tile-correct",
  gramCorrect: "tile-correct",
  misplaced: "tile-misplaced",
  gramMisplaced: "tile-misplaced",
  absent: "tile-absent",
  // Offset blank tile: no color. Committed rows render these as empty wells in
  // GuessRow, so this only guards exhaustiveness.
  blank: "",
};

// Recap note highlight border, keyed by the tile's own feedback color. A highlighted tile is framed
// with a DARKER SHADE of its own color ("hit"); the "origin" a note points back to (e.g. the locked
// green a later guess overwrote, or the tile that first showed a re-tested letter was dead) uses an
// even darker shade of that same hue -- same width, just darker, so it reads as the source. A border
// (not `outline`, which `.using-mouse` force-clears for mouse users; not a ring, which blooms past the
// tile) stays inside the tile box. The class strings are literal here so Tailwind's scanner emits them.
const NOTE_BORDER_CLASSES: Record<
  LetterFeedback,
  { hit: string; origin: string }
> = {
  correct: {
    hit: "border-green-600 dark:border-green-400",
    origin: "border-green-800 dark:border-green-200",
  },
  gramCorrect: {
    hit: "border-green-600 dark:border-green-400",
    origin: "border-green-800 dark:border-green-200",
  },
  misplaced: {
    hit: "border-yellow-600 dark:border-yellow-400",
    origin: "border-yellow-800 dark:border-yellow-200",
  },
  gramMisplaced: {
    hit: "border-yellow-600 dark:border-yellow-400",
    origin: "border-yellow-800 dark:border-yellow-200",
  },
  absent: {
    hit: "border-zinc-600 dark:border-zinc-400",
    origin: "border-zinc-800 dark:border-zinc-200",
  },
  blank: { hit: "", origin: "" },
};

// The `border-2 <color>` classes for a highlighted note tile. Falls back to a neutral zinc frame when
// the tile has no feedback color (a blank cell), so the highlight is still visible.
export function noteBorderClass(
  feedback: LetterFeedback | undefined,
  variant: "hit" | "origin",
): string {
  const shade = feedback ? NOTE_BORDER_CLASSES[feedback][variant] : "";
  if (shade) return `border-2 ${shade}`;
  return variant === "origin"
    ? "border-2 border-zinc-800 dark:border-zinc-200"
    : "border-2 border-zinc-600 dark:border-zinc-400";
}
