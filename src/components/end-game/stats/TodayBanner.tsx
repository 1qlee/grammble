import type { CSSProperties } from "react";
import type { LetterFeedback } from "~/utils/game/types";
import { MiniGrid } from "./MiniGrid";
import { Odometer } from "./Odometer";
import { useDelayedFlag } from "./useDelayedFlag";
import { CASCADE } from "./cascade.constants";

function TileRow({
  letters,
  charClassName,
  className,
  style,
  ariaHidden,
}: {
  letters: string[];
  charClassName?: string;
  className?: string;
  style?: CSSProperties;
  ariaHidden?: boolean;
}) {
  return (
    <div
      className={`flex gap-[2px] ${className ?? ""}`}
      style={style}
      aria-hidden={ariaHidden}
    >
      {letters.map((char, i) => (
        <div key={i} className="@container relative flex flex-1 min-w-0 aspect-square">
          <span
            className={`tile-char rounded-lg text-sm font-bold ${charClassName ?? ""}`}
          >
            {char}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TodayBanner({
  feedback,
  wordLength,
  revealedWord,
  score,
  animate = true,
  onCopy,
}: {
  feedback: LetterFeedback[][];
  wordLength: number;
  revealedWord: string;
  score: number;
  animate?: boolean;
  onCopy: () => void;
}) {
  const progress = Math.max(0, Math.min(100, score));
  const letters = revealedWord.toUpperCase().split("");
  const filled = useDelayedFlag(CASCADE.clip.delay, animate);
  const clip = filled ? progress : 0;

  return (
    <div className="endgame-section">
      <div className="flex items-start justify-between gap-4">
        <div className="basis-2/3 shrink-0">
          <p className="section-label">
            Score
          </p>
          <p className="mt-1">
            <Odometer
              value={score}
              delay={CASCADE.score.delay}
              duration={CASCADE.score.duration}
              animate={animate}
              className="text-5xl font-bold"
            />
            <span className="text-xl font-bold text-accent ml-1">/ 100</span>
          </p>
          <div className="relative mt-2">
            <TileRow letters={letters} />
            <TileRow
              letters={letters}
              ariaHidden
              className="absolute inset-0 transition-[clip-path] ease-[cubic-bezier(.2,.7,.3,1)]"
              style={{
                clipPath: `inset(0 ${100 - clip}% 0 0)`,
                transitionDuration: `${CASCADE.clip.duration}ms`,
              }}
              charClassName="tile-correct"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy results to clipboard"
          className="group flex-1 min-w-0 flex flex-col items-center gap-1.5 cursor-pointer"
        >
          <span className="rounded-md shadow-md bg-default p-1 w-fit max-w-full transition group-hover:opacity-80">
            <MiniGrid feedback={feedback} wordLength={wordLength} />
          </span>
          <span className="text-xs text-accent transition group-hover:opacity-80">
            Share
          </span>
        </button>
      </div>
    </div>
  );
}
