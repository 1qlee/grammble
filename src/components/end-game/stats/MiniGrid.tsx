import { MAX_GUESSES } from "~/utils/game/constants";
import type { LetterFeedback } from "~/utils/game/types";

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

export function MiniGrid({
  feedback,
  wordLength,
}: {
  feedback: LetterFeedback[][];
  wordLength: number;
}) {
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
                className={`flex-1 min-w-0 aspect-square rounded-[1px] ${cell ? MINI_FEEDBACK_CLASSES[cell] : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
