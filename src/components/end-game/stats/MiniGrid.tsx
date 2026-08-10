import { MAX_GUESSES } from "~/utils/game/constants";
import type { LetterFeedback } from "~/utils/game/types";
import { useSettings } from "~/utils/providers/settings-provider";

const MINI_FEEDBACK_CLASSES: Record<LetterFeedback, string> = {
  correct: "bg-green-300 dark:bg-green-600",
  gramCorrect: "bg-green-300 dark:bg-green-600",
  misplaced: "bg-yellow-300 dark:bg-yellow-600",
  gramMisplaced: "bg-yellow-300 dark:bg-yellow-600",
  absent: "bg-zinc-300 dark:bg-zinc-500",
  // Offset blank tile: an empty column the slid word skipped, shown as an
  // unfilled cell.
  blank: "bg-zinc-200 dark:bg-zinc-700",
};

// High-contrast orange/blue variant, matching the board and the shared grid, so
// the results preview reads correctly under color-blind mode. Only the feedback
// fills change; absent/blank keep their neutral zinc.
const MINI_FEEDBACK_CLASSES_COLOR_BLIND: Record<LetterFeedback, string> = {
  ...MINI_FEEDBACK_CLASSES,
  correct: "bg-[#f5793a] dark:bg-[#f5793a]",
  gramCorrect: "bg-[#f5793a] dark:bg-[#f5793a]",
  misplaced: "bg-[#85c0f9] dark:bg-[#85c0f9]",
  gramMisplaced: "bg-[#85c0f9] dark:bg-[#85c0f9]",
};

export function MiniGrid({
  feedback,
  wordLength,
}: {
  feedback: LetterFeedback[][];
  wordLength: number;
}) {
  const { colorBlindMode } = useSettings();
  const classes = colorBlindMode
    ? MINI_FEEDBACK_CLASSES_COLOR_BLIND
    : MINI_FEEDBACK_CLASSES;
  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => feedback[r] ?? []);
  // Preferred size matches the original 12px cells + 2px gaps, but maxWidth lets
  // the whole grid shrink (cells stay square via aspect-ratio) when space is tight.
  const naturalWidth = wordLength * 14 - 2;
  return (
    <div
      className="flex flex-col gap-[2px]"
      style={{ width: naturalWidth, maxWidth: "100%" }}
    >
      {rows.map((row, r) => (
        <div key={r} className="flex gap-[2px]">
          {Array.from({ length: wordLength }, (_, c) => {
            const cell = row[c];
            return (
              <span
                key={c}
                className={`flex-1 min-w-0 aspect-square rounded-[1px] ${cell ? classes[cell] : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
