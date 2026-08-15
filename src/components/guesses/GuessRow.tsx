import { useEffect, useRef, type CSSProperties } from "react";
import clsx from "clsx";
import { animate } from "animejs";
import { useGameStore, type LetterFeedback } from "~/stores/game-store";
import { WORD_LENGTH } from "~/utils/game/constants";
import { GuessTile } from "./GuessTile";
import { GramTile } from "./GramTile";
import { useGramPosition } from "./useGramPosition";
import {
  TILE_SUBMIT_DOWN,
  TILE_SUBMIT_UP,
  FAN_ORIGIN,
  FAN_ROT_DEG,
  FAN_LIFT_PX,
  FAN_STAGGER_MS,
  TILE_FAN_OUT_MS,
  TILE_FAN_OUT_EASE,
  TILE_FAN_HOLD_MS,
  TILE_FAN_BACK_MS,
  TILE_FAN_BACK_EASE,
  REVEAL_ROW_STAGGER_MS,
  REVEAL_COL_STAGGER_MS,
} from "./tileAnimations.constants";
import { fireConfettiFromElements } from "~/utils/game/confetti";

// Fan the winning row's tiles outward like a hand of cards, hold at the lifted
// peak, then settle them back to flat. Tiles are sorted by on-screen x so
// "center" and "edge" are visual, not DOM, order: each tile pivots from below
// (FAN_ORIGIN) toward its nearest edge by an angle that grows linearly with its
// distance from center, lifts at the peak, and the stagger radiates from the
// center so the middle tiles lead. Confetti launches from the tiles once they
// have all reached that fanned-out peak. Replaces the submit spring-back on a win.
function playWinFanOut(tiles: Element[]): void {
  const sorted = [...tiles].sort(
    (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
  );
  const center = (sorted.length - 1) / 2;
  sorted.forEach((tile, i) => {
    const el = tile as HTMLElement;
    const offset = i - center; // negative = left of center
    const dist = Math.abs(offset);
    const angle = offset * FAN_ROT_DEG; // outward, grows toward the ends
    const prevOrigin = el.style.transformOrigin;
    el.style.transformOrigin = FAN_ORIGIN;
    animate(el, {
      rotate: [
        { to: angle, duration: TILE_FAN_OUT_MS, ease: TILE_FAN_OUT_EASE },
        { to: angle, duration: TILE_FAN_HOLD_MS }, // hold at the peak
        { to: 0, duration: TILE_FAN_BACK_MS, ease: TILE_FAN_BACK_EASE },
      ],
      translateY: [
        { to: FAN_LIFT_PX, duration: TILE_FAN_OUT_MS, ease: TILE_FAN_OUT_EASE },
        { to: FAN_LIFT_PX, duration: TILE_FAN_HOLD_MS }, // hold lifted
        { to: 0, duration: TILE_FAN_BACK_MS, ease: TILE_FAN_BACK_EASE },
      ],
      // Undo the submit press (scale 0.98) on the way out; the reference does
      // not grow the tiles, so settle straight to 1.
      scale: { to: 1, duration: TILE_FAN_OUT_MS, ease: TILE_FAN_OUT_EASE },
      delay: dist * FAN_STAGGER_MS,
      onComplete: () => {
        el.style.transformOrigin = prevOrigin;
      },
    });
  });
}

interface Props {
  guess: string;
  feedback?: LetterFeedback[];
  gram: string;
  cols?: number;
  isCurrentRow: boolean;
  isFirstRow: boolean;
  isLastRow: boolean;
  // Zero-based position of this row in the initial reveal cascade, or undefined
  // for rows that should not play the load-time color wash.
  revealRow?: number;
  // Gate the reveal cascade so it starts with (and waits behind) the board's
  // drop-in entrance rather than firing on mount underneath the loading overlay.
  animateIn?: boolean;
  // The row's inner padding. Defaults on; the recap board turns it off for a
  // tighter grid. `--row-pad` (0 when off) keeps the gram overlay aligned, since
  // its offsets are measured from the padding edge.
  padded?: boolean;
  // Recap note highlight: the columns in this row a hovered/tapped score note refers to. When
  // provided, those tiles are emphasised and every other tile in the row is dimmed. Undefined (the
  // default, and always so on the live board) leaves every tile at its normal appearance.
  highlightCols?: number[];
  // Subset of highlightCols that are the note's ORIGIN cells (e.g. the locked green a later guess
  // overwrote): rendered with a heavier, darker border so they read as the source, not the mistake.
  originCols?: number[];
}

export function GuessRow({
  guess,
  feedback,
  gram,
  cols = WORD_LENGTH,
  isCurrentRow,
  isFirstRow,
  isLastRow,
  revealRow,
  animateIn = false,
  padded = true,
  highlightCols,
  originCols,
}: Props) {
  const setGuess = useGameStore((s) => s.setGuess);
  const status = useGameStore((s) => s.status);
  const loading = useGameStore((s) => s.loading);
  const editingToggled = useGameStore((s) => s.editing.toggled);
  const rowRef = useRef<HTMLDivElement>(null);
  const submitting = isCurrentRow && loading;
  const wasSubmitting = useRef(false);

  // Rising burst from the winning row's tiles, timed to land with the fan-out.
  // Only ever called from the live IN_PROGRESS -> WON submit branch below, so it
  // never replays when an already-won game is hydrated on load.
  function fireWinConfetti(): void {
    const row = rowRef.current;
    if (!row) return;
    window.setTimeout(() => {
      const tiles = row.querySelectorAll(
        ".tile:not(.invisible):not(.tile-blank), .tile-wide",
      );
      fireConfettiFromElements(tiles);
    }, 260);
  }

  useEffect(() => {
    if (!rowRef.current) return;
    const targets = rowRef.current.querySelectorAll(
      ".tile:not(.invisible):not(.tile-blank), .tile-char-wide",
    );
    if (targets.length) {
      if (submitting && !wasSubmitting.current) {
        animate(targets, TILE_SUBMIT_DOWN);
      } else if (!submitting && wasSubmitting.current) {
        // On a win the just-submitted row fans out instead of the plain
        // spring-back; that branch is only ever reached by the active row.
        if (status === "WON") {
          playWinFanOut(Array.from(targets));
          fireWinConfetti();
        } else {
          animate(targets, TILE_SUBMIT_UP);
        }
      }
    }
    wasSubmitting.current = submitting;
  }, [submitting, status]);

  const isSubmitted = !isCurrentRow && guess.length > 0 && !!feedback;

  const canCopy = isSubmitted && status === "IN_PROGRESS";
  const numCols = isCurrentRow ? Math.max(cols, guess.length) : cols;
  const showActive =
    isCurrentRow && status === "IN_PROGRESS" && !editingToggled;
  const activeIndex = showActive ? guess.length : -1;

  const {
    gramStart,
    hasGram,
    gridColumnStart,
    charsForTile,
    feedbackForTile,
  } = useGramPosition({ guess, gram, feedback, isCurrentRow });

  // Diagonal wave: each tile's wash is delayed by its row (cascade down) plus
  // column (sweep across). Undefined for rows outside the initial reveal.
  const revealDelayFor = (colIndex: number): number | undefined =>
    revealRow === undefined
      ? undefined
      : revealRow * REVEAL_ROW_STAGGER_MS + colIndex * REVEAL_COL_STAGGER_MS;

  // A recap note is active for this row when `highlightCols` is provided: matched columns read as
  // "hit", every other tile dims. Undefined leaves the row untouched (the live board's normal state).
  const noteActive = highlightCols !== undefined;
  const noteFor = (colIndex: number): "hit" | "origin" | "dim" | undefined =>
    noteActive
      ? originCols?.includes(colIndex)
        ? "origin"
        : highlightCols!.includes(colIndex)
          ? "hit"
          : "dim"
      : undefined;
  const gramNote = noteActive
    ? highlightCols!.includes(gramStart) ||
      highlightCols!.includes(gramStart + 1)
      ? "hit"
      : "dim"
    : undefined;

  const tiles: React.ReactNode[] = [];
  for (let colIndex = 0; colIndex < numCols; colIndex++) {
    const hiddenByGram =
      hasGram && (colIndex === gramStart || colIndex === gramStart + 1);
    const isFilled = colIndex < guess.length;
    const isActive =
      colIndex === activeIndex && !hiddenByGram && colIndex < cols;
    // Empty slots past the active cursor: click to jump the cursor here.
    const isMovable =
      showActive &&
      !hiddenByGram &&
      colIndex > guess.length &&
      colIndex < cols;
    // A submitted row's offset blank (a column the slid word left empty) renders
    // as an empty well, not a space-char tile, so a leading blank looks the same
    // as the trailing empties. Only committed rows carry "blank" feedback; the
    // live row keeps its space padding as-is.
    const isBlankCell = feedback?.[colIndex] === "blank";
    tiles.push(
      <GuessTile
        key={colIndex}
        char={isBlankCell ? "" : guess[colIndex] ?? ""}
        feedback={isBlankCell ? undefined : feedback?.[colIndex]}
        hidden={hiddenByGram}
        index={colIndex}
        editable={isCurrentRow && isFilled && !hiddenByGram}
        movable={isMovable}
        active={isActive}
        revealDelay={revealDelayFor(colIndex)}
        note={noteFor(colIndex)}
      />,
    );
  }

  return (
    <div
      ref={rowRef}
      role={canCopy ? "button" : undefined}
      tabIndex={canCopy ? 0 : undefined}
      onClick={canCopy ? () => setGuess(guess) : undefined}
      onKeyDown={
        canCopy
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setGuess(guess);
              }
            }
          : undefined
      }
      className={clsx(
        "row relative gap-[2px]",
        padded && "p-1",
        isFirstRow && "rounded-t-lg",
        isLastRow && "rounded-b-lg",
        canCopy && "cursor-pointer",
        revealRow !== undefined && animateIn && "row-reveal",
      )}
      style={padded ? undefined : ({ ["--row-pad"]: "0px" } as CSSProperties)}
    >
      {tiles}
      <GramTile
        chars={charsForTile}
        feedback={feedbackForTile}
        columnStart={gridColumnStart}
        show={hasGram}
        leftIndex={gramStart}
        rightIndex={gramStart + 1}
        editable={isCurrentRow}
        revealDelay={revealDelayFor(gramStart)}
        note={gramNote}
      />
    </div>
  );
}
