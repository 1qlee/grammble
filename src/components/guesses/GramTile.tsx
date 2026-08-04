import { useEffect, useRef, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { useGameStore, type LetterFeedback } from "~/stores/game-store";
import { useAnimeMount } from "~/hooks/useAnimeMount";
import { GramFace } from "./GramFace";
import { AntsOutline } from "./AntsOutline";
import { CHAR_IN, CHAR_OUT } from "./tileAnimations.constants";

interface Props {
  chars: [string, string];
  feedback?: LetterFeedback;
  columnStart: number;
  show: boolean;
  leftIndex: number;
  rightIndex: number;
  editable: boolean;
  revealDelay?: number;
}

interface GramCharProps {
  chars: [string, string];
  feedback?: LetterFeedback;
  dismissing: boolean;
  onExited: () => void;
  revealDelay?: number;
}

// Mirrors GuessTile's TileChar: the gram face animates in on mount and, when the
// gram breaks apart (dismissing), plays CHAR_OUT and stays mounted until it
// completes instead of vanishing instantly.
function GramChar({
  chars,
  feedback,
  dismissing,
  onExited,
  revealDelay,
}: GramCharProps) {
  const { ref, mounted, dismiss } = useAnimeMount<HTMLSpanElement>(
    CHAR_IN,
    CHAR_OUT,
  );

  useEffect(() => {
    if (dismissing) dismiss();
  }, [dismissing, dismiss]);

  useEffect(() => {
    if (!mounted) onExited();
  }, [mounted, onExited]);

  if (!mounted) return null;

  return (
    <GramFace
      ref={ref}
      chars={chars}
      feedback={feedback}
      style={
        revealDelay !== undefined
          ? ({ "--reveal-delay": `${revealDelay}ms` } as CSSProperties)
          : undefined
      }
    />
  );
}

export function GramTile({
  chars,
  feedback,
  columnStart,
  show,
  leftIndex,
  rightIndex,
  editable,
  revealDelay,
}: Props) {
  const editing = useGameStore((s) => s.editing);
  const editKey = useGameStore((s) => s.editKey);

  // Keep the gram face mounted through its CHAR_OUT exit: render it whenever the
  // gram is shown, and hold it on screen while it dismisses (when `show` flips
  // false) until the animation completes. Snapshots preserve the last shown
  // chars/feedback so the exit animates the letters that are leaving.
  const [renderGram, setRenderGram] = useState(show);
  const gramKeyRef = useRef(0);
  const charsSnapshot = useRef(chars);
  const feedbackSnapshot = useRef(feedback);
  if (show) {
    charsSnapshot.current = chars;
    feedbackSnapshot.current = feedback;
  }

  useEffect(() => {
    if (show && !renderGram) {
      gramKeyRef.current += 1;
      setRenderGram(true);
    }
  }, [show, renderGram]);

  const canEdit = editable && show;
  const leftActive = canEdit && editing.toggled && editing.key === leftIndex;
  const rightActive = canEdit && editing.toggled && editing.key === rightIndex;

  const handleHalfPointerDown =
    (index: number) => (e: React.PointerEvent<HTMLSpanElement>) => {
      if (!canEdit) return;
      e.stopPropagation();
      editKey(index, true);
    };

  return (
    <div
      className={clsx("tile-wide", !show && "pointer-events-none")}
      style={{
        transform: `translateX(calc(${columnStart - 1} * (var(--tile-size, 52px) + var(--tile-gap, 2px)) + var(--row-pad, 4px)))`,
        transition: "none",
      }}
      aria-hidden={!show}
    >
      {renderGram && (
        <GramChar
          key={gramKeyRef.current}
          chars={charsSnapshot.current}
          feedback={feedbackSnapshot.current}
          dismissing={!show}
          onExited={() => setRenderGram(false)}
          revealDelay={revealDelay}
        />
      )}
      {canEdit && (
        <>
          <span
            data-editable-tile=""
            onPointerDown={handleHalfPointerDown(leftIndex)}
            style={{ width: "var(--tile-size, 52px)" }}
            className="absolute inset-y-0 left-0 cursor-pointer rounded-[inherit]"
          >
            {leftActive && <AntsOutline />}
          </span>
          <span
            data-editable-tile=""
            onPointerDown={handleHalfPointerDown(rightIndex)}
            style={{ width: "var(--tile-size, 52px)" }}
            className="absolute inset-y-0 right-0 cursor-pointer rounded-[inherit]"
          >
            {rightActive && <AntsOutline />}
          </span>
        </>
      )}
    </div>
  );
}
