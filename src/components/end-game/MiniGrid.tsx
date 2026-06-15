import { MAX_GUESSES } from "~/utils/game/constants";
import type { LetterFeedback } from "~/utils/game/types";

const MINI_FEEDBACK_CLASSES: Record<LetterFeedback, string> = {
  correct: "bg-green-500",
  gramCorrect: "bg-green-500",
  misplaced: "bg-yellow-500",
  gramMisplaced: "bg-yellow-500",
  absent: "bg-zinc-500",
};

export function MiniGrid({
  feedback,
  wordLength,
}: {
  feedback: LetterFeedback[][];
  wordLength: number;
}) {
  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => feedback[r] ?? []);
  return (
    <div className="flex flex-col gap-[2px]">
      {rows.map((row, r) => (
        <div key={r} className="flex gap-[2px]">
          {Array.from({ length: wordLength }, (_, c) => {
            const cell = row[c];
            return (
              <span
                key={c}
                className={`w-2 h-2 rounded-[1px] ${
                  cell ? MINI_FEEDBACK_CLASSES[cell] : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
