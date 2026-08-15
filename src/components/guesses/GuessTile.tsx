import { useEffect, useRef, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { animate } from "animejs";
import { useGameStore, type LetterFeedback } from "~/stores/game-store";
import { FEEDBACK_CLASSES, noteBorderClass } from "./feedback-classes";
import { useAnimeMount } from "~/hooks/useAnimeMount";
import { AntsOutline } from "./AntsOutline";
import { CHAR_IN, CHAR_OUT, TILE_SLOT_PUNCH } from "./tileAnimations.constants";

interface Props {
  char: string;
  feedback?: LetterFeedback;
  hidden?: boolean;
  index?: number;
  editable?: boolean;
  // Empty slot ahead of the cursor: clicking it fills the gap (and this slot)
  // with blanks and opens editing here, so the next keystroke replaces this
  // tile's blank in place.
  movable?: boolean;
  active?: boolean;
  revealDelay?: number;
  // Recap note highlight: "hit" rings the tile as belonging to the hovered/tapped score note,
  // "origin" rings it with a heavier, darker border as the source the note points back to (an
  // overwritten green), "dim" fades it as context. Undefined leaves the tile at its normal appearance.
  note?: "hit" | "origin" | "dim";
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
  note,
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

  // Fill up to the clicked slot and open editing on it (handled in the store).
  // Movable tiles only render when no edit is open, so there is nothing to
  // dismiss here; the store toggles the new edit on directly.
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
        // The highlight is a BORDER (see noteBorderClass): a darker shade of the tile's own feedback
        // color, with `origin` an even darker shade of the same hue. A border stays within the tile's
        // box (border-box) and frames the .tile-char fill; utilities win over `.tile-blank`'s border
        // via the utilities layer order.
        note && "transition-[border-color,opacity] duration-200",
        note === "hit" && noteBorderClass(feedback, "hit"),
        note === "origin" && noteBorderClass(feedback, "origin"),
        note === "dim" && "opacity-30",
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
