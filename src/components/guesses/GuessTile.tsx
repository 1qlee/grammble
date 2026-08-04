import { useEffect, useRef, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { animate } from "animejs";
import { useGameStore, type LetterFeedback } from "~/stores/game-store";
import { FEEDBACK_CLASSES } from "./feedback-classes";
import { useAnimeMount } from "~/hooks/useAnimeMount";
import { AntsOutline } from "./AntsOutline";
import { CHAR_IN, CHAR_OUT, TILE_SLOT_PUNCH } from "./tileAnimations.constants";

interface Props {
  char: string;
  feedback?: LetterFeedback;
  hidden?: boolean;
  index?: number;
  editable?: boolean;
  // Empty slot ahead of the cursor: clicking it moves the cursor here (padding
  // the gap with blanks) so the next keystroke lands on this tile.
  movable?: boolean;
  active?: boolean;
  revealDelay?: number;
}

interface TileCharProps {
  char: string;
  feedback?: LetterFeedback;
  isEditing: boolean;
  dismissing: boolean;
  onExited: () => void;
  revealDelay?: number;
}

function TileChar({
  char,
  feedback,
  isEditing,
  dismissing,
  onExited,
  revealDelay,
}: TileCharProps) {
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
    <span
      ref={ref}
      className={clsx("tile-char", feedback && FEEDBACK_CLASSES[feedback])}
      style={
        revealDelay !== undefined
          ? ({ "--reveal-delay": `${revealDelay}ms` } as CSSProperties)
          : undefined
      }
    >
      {char}
    </span>
  );
}

export function GuessTile({
  char,
  feedback,
  hidden,
  index,
  editable,
  movable,
  active,
  revealDelay,
}: Props) {
  const editing = useGameStore((s) => s.editing);
  const editKey = useGameStore((s) => s.editKey);
  const moveCursorTo = useGameStore((s) => s.moveCursorTo);
  const hasChar = char !== "";
  const isEditing =
    !!editable &&
    editing.toggled &&
    index !== undefined &&
    editing.key === index;
  const [renderChar, setRenderChar] = useState(hasChar);
  const charSnapshotRef = useRef(char);
  const charKeyRef = useRef(0);
  const tileRef = useRef<HTMLDivElement>(null);

  if (hasChar) charSnapshotRef.current = char;

  useEffect(() => {
    if (hasChar && !renderChar) {
      charKeyRef.current += 1;
      setRenderChar(true);
      if (tileRef.current) animate(tileRef.current, TILE_SLOT_PUNCH);
    }
  }, [hasChar, renderChar]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || index === undefined) return;
    e.stopPropagation();
    editKey(index, !isEditing);
  };

  // Do not stop propagation: let the document-level outside-click handler in
  // useKeyboardInput close any open edit as the cursor moves.
  const handleMovePointerDown = () => {
    if (index === undefined) return;
    moveCursorTo(index);
  };

  return (
    <div
      ref={tileRef}
      data-editable-tile={editable ? "" : undefined}
      onPointerDown={
        editable
          ? handlePointerDown
          : movable
            ? handleMovePointerDown
            : undefined
      }
      className={clsx(
        "tile",
        // During the initial reveal the keycap is held invisible until its
        // staggered delay, so keep the blank-well styling underneath (it sits
        // behind the .tile-char, which covers it once the color washes in).
        (!hasChar || revealDelay !== undefined) && "tile-blank",
        hidden && "invisible",
        editable && "cursor-pointer",
        movable &&
          "cursor-pointer hover:border-2 hover:border-zinc-300 dark:hover:border-zinc-600",
        active && "border-zinc-400 dark:border-zinc-100",
      )}
    >
      {renderChar && (
        <TileChar
          key={charKeyRef.current}
          char={charSnapshotRef.current}
          feedback={feedback}
          isEditing={isEditing}
          dismissing={!hasChar}
          onExited={() => setRenderChar(false)}
          revealDelay={revealDelay}
        />
      )}
      {isEditing && <AntsOutline />}
    </div>
  );
}
