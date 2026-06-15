import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useGameStore, type LetterFeedback } from "~/stores/game-store";
import { FEEDBACK_CLASSES } from "./feedback-classes";
import { useAnimeMount } from "~/hooks/useAnimeMount";
import { AntsOutline } from "./AntsOutline";
import { CHAR_IN, CHAR_OUT } from "./tileAnimations.constants";

interface Props {
  char: string;
  feedback?: LetterFeedback;
  hidden?: boolean;
  index?: number;
  editable?: boolean;
  active?: boolean;
}

interface TileCharProps {
  char: string;
  feedback?: LetterFeedback;
  isEditing: boolean;
  dismissing: boolean;
  onExited: () => void;
}

function TileChar({
  char,
  feedback,
  isEditing,
  dismissing,
  onExited,
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
      className={clsx(
        "tile-char",
        feedback && FEEDBACK_CLASSES[feedback],
      )}
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
  active,
}: Props) {
  const editing = useGameStore((s) => s.editing);
  const editKey = useGameStore((s) => s.editKey);
  const hasChar = char !== "";
  const isEditing =
    !!editable &&
    editing.toggled &&
    index !== undefined &&
    editing.key === index;
  const [renderChar, setRenderChar] = useState(hasChar);
  const charSnapshotRef = useRef(char);
  const charKeyRef = useRef(0);

  if (hasChar) charSnapshotRef.current = char;

  useEffect(() => {
    if (hasChar && !renderChar) {
      charKeyRef.current += 1;
      setRenderChar(true);
    }
  }, [hasChar, renderChar]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || index === undefined) return;
    e.stopPropagation();
    editKey(index, !isEditing);
  };

  return (
    <div
      data-editable-tile={editable ? "" : undefined}
      onPointerDown={editable ? handlePointerDown : undefined}
      className={clsx(
        "tile",
        !hasChar && "tile-blank",
        hidden && "invisible",
        editable && "cursor-pointer",
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
        />
      )}
      {isEditing && <AntsOutline />}
    </div>
  );
}
