import { forwardRef } from "react";
import clsx from "clsx";
import type { LetterFeedback } from "~/stores/game-store";
import { FEEDBACK_CLASSES } from "./feedback-classes";

interface GramFaceProps {
  chars: [string, string];
  feedback?: LetterFeedback;
  className?: string;
}

// Static visual face of a gram tile: the two-letter gradient pill shared by the
// in-game GramTile and the Scoreboard header. All sizing derives from
// `--tile-size` / `--tile-gap` (via `.tile-char-wide`), so callers scale it by
// overriding those vars on an ancestor rather than duplicating the styling.
export const GramFace = forwardRef<HTMLSpanElement, GramFaceProps>(
  function GramFace({ chars, feedback, className }, ref) {
    return (
      <span
        ref={ref}
        className={clsx(
          "tile-char-wide",
          feedback && FEEDBACK_CLASSES[feedback],
          className,
        )}
      >
        <span className="mr-[4px]">{chars[0]}</span>
        <span className="mr-[4px]">{chars[1]}</span>
      </span>
    );
  },
);
