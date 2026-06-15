import { useEffect, useRef } from "react";
import clsx from "clsx";
import { animate } from "animejs";
import { useGameStore, type LetterFeedback } from "~/stores/game-store";
import { GramFace } from "./GramFace";
import { AntsOutline } from "./AntsOutline";
import { CHAR_IN } from "./tileAnimations.constants";

interface Props {
  chars: [string, string];
  feedback?: LetterFeedback;
  columnStart: number;
  show: boolean;
  leftIndex: number;
  rightIndex: number;
  editable: boolean;
}

interface GramCharProps {
  chars: [string, string];
  feedback?: LetterFeedback;
}

function GramChar({ chars, feedback }: GramCharProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    animate(ref.current, CHAR_IN);
  }, []);

  return <GramFace ref={ref} chars={chars} feedback={feedback} />;
}

export function GramTile({
  chars,
  feedback,
  columnStart,
  show,
  leftIndex,
  rightIndex,
  editable,
}: Props) {
  const editing = useGameStore((s) => s.editing);
  const editKey = useGameStore((s) => s.editKey);

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
        transform: `translateX(calc(${columnStart - 1} * (var(--tile-size, 52px) + var(--tile-gap, 2px)) + var(--tile-gap, 2px) * 2))`,
        transition: "none",
      }}
      aria-hidden={!show}
    >
      {show && <GramChar chars={chars} feedback={feedback} />}
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
