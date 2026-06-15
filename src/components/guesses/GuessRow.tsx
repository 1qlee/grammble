import clsx from "clsx";
import { useGameStore, type LetterFeedback } from "~/stores/game-store";
import { WORD_LENGTH } from "~/utils/game/constants";
import { GuessTile } from "./GuessTile";
import { GramTile } from "./GramTile";
import { useGramPosition } from "./useGramPosition";

interface Props {
  guess: string;
  feedback?: LetterFeedback[];
  gram: string;
  cols?: number;
  isCurrentRow: boolean;
  isFirstRow: boolean;
  isLastRow: boolean;
}

export function GuessRow({
  guess,
  feedback,
  gram,
  cols = WORD_LENGTH,
  isCurrentRow,
  isFirstRow,
  isLastRow,
}: Props) {
  const setGuess = useGameStore((s) => s.setGuess);
  const status = useGameStore((s) => s.status);
  const editingToggled = useGameStore((s) => s.editing.toggled);
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

  const tiles: React.ReactNode[] = [];
  for (let colIndex = 0; colIndex < numCols; colIndex++) {
    const hiddenByGram =
      hasGram && (colIndex === gramStart || colIndex === gramStart + 1);
    const isFilled = colIndex < guess.length;
    const isActive =
      colIndex === activeIndex && !hiddenByGram && colIndex < cols;
    tiles.push(
      <GuessTile
        key={colIndex}
        char={guess[colIndex] ?? ""}
        feedback={feedback?.[colIndex]}
        hidden={hiddenByGram}
        index={colIndex}
        editable={isCurrentRow && isFilled && !hiddenByGram}
        active={isActive}
      />,
    );
  }

  return (
    <div
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
        "row relative gap-[2px] p-1",
        isFirstRow && "rounded-t-lg",
        isLastRow && "rounded-b-lg",
        canCopy && "cursor-pointer",
      )}
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
      />
    </div>
  );
}
