import type { CSSProperties } from "react";
import type { LetterFeedback } from "~/utils/game/types";
import { MiniGrid } from "./MiniGrid";

export function TodayBanner({
  headline,
  currentStreak,
  feedback,
  wordLength,
  revealedWord,
  score,
  onCopy,
}: {
  headline: string;
  currentStreak: number;
  feedback: LetterFeedback[][];
  wordLength: number;
  revealedWord: string | null;
  score: number;
  onCopy: () => void;
}) {
  const progress = Math.max(0, Math.min(100, score));
  const letters = (revealedWord ?? "").toUpperCase().split("");

  return (
    <div className="bg-accent rounded-xl p-5">
      <p className="text-3xl font-bold leading-tight">{headline}</p>
      <div className="flex items-start justify-between gap-4 mt-4">
        <div className="min-w-0 flex-1">
          <p className="text-xxs font-mono font-semibold tracking-widest uppercase text-accent">
            Score
          </p>
          <p className="font-mono leading-none mt-1">
            <span className="text-5xl font-bold text-zinc-900 dark:text-zinc-100">
              {score}
            </span>
            <span className="text-2xl font-bold text-accent ml-1">/100</span>
          </p>
          {letters.length > 0 && (
            <div
              className="relative mt-4"
              style={{ "--tile-size": "38px" } as CSSProperties}
            >
              <div className="flex gap-[2px]">
                {letters.map((letter, i) => (
                  <span key={i} className="flex-1 aspect-square">
                    <span className="tile-char">{letter}</span>
                  </span>
                ))}
              </div>
              <div
                aria-hidden="true"
                className="absolute inset-0 flex gap-[2px] transition-[clip-path] duration-[450ms] ease-[cubic-bezier(.2,.7,.3,1)]"
                style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
              >
                {letters.map((letter, i) => (
                  <span key={i} className="flex-1 aspect-square">
                    <span className="tile-char tile-correct">{letter}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy results to clipboard"
          className="group shrink-0 flex flex-col items-center gap-1.5 cursor-pointer"
        >
          <span className="rounded-lg shadow-md bg-default p-2 transition group-hover:opacity-80">
            <MiniGrid feedback={feedback} wordLength={wordLength} />
          </span>
          <span className="text-xxs font-mono uppercase tracking-widest text-accent transition group-hover:opacity-80">
            Copy results
          </span>
        </button>
      </div>
    </div>
  );
}
