import { useRef } from "react";
import { useGameStore } from "~/stores/game-store";
import {
  MAX_GUESSES,
  WORD_LENGTH,
  type GameMode,
} from "~/utils/game/constants";
import {
  MAX_TILE_SIZE,
  ROW_PADDING,
  TILE_GAP,
} from "~/utils/game/board.constants";
import type { LetterFeedback } from "~/utils/game/types";
import Scoreboard from "./Scoreboard";
import { GuessRow } from "./guesses/GuessRow";
import { useTilePopAnimation } from "./guesses/useTilePopAnimation";
import { SkeletonScoreboard } from "./guesses/SkeletonScoreboard";
import { SkeletonRow } from "./guesses/SkeletonRow";

interface GuessesProps {
  gram: string;
  puzzleNumber: number;
  difficulty: "easy" | "med" | "hard";
  mode: GameMode;
  isPremium: boolean;
  cols?: number;
  isLoading?: boolean;
  initialGuesses?: string[];
  initialFeedback?: LetterFeedback[][];
}

export default function Guesses({
  gram,
  puzzleNumber,
  difficulty,
  mode,
  isPremium,
  cols = WORD_LENGTH,
  isLoading = false,
  initialGuesses,
  initialFeedback,
}: GuessesProps) {
  const storeGuesses = useGameStore((s) => s.guesses);
  const storeFeedback = useGameStore((s) => s.feedback);
  const storeCurrentGuessIndex = useGameStore((s) => s.currentGuessIndex);

  // Before the store is seeded on the client (SSR + first render), fall back
  // to props derived from route context so the board renders the real state.
  const hasStoreData = storeGuesses.length > 0;
  const guesses = hasStoreData ? storeGuesses : (initialGuesses ?? []);
  const feedback = hasStoreData ? storeFeedback : (initialFeedback ?? []);
  const currentGuessIndex = hasStoreData
    ? storeCurrentGuessIndex
    : (initialGuesses?.length ?? 0);
  const root = useRef<HTMLDivElement>(null);

  useTilePopAnimation(root);

  // Cards fill the per-mode width owned by `.board-scope`. The guess card uses
  // the active `--cols`/`--tile-size`; the scoreboard card overrides them to the
  // 6-letter values (`.scoreboard-scope`) so it stays a fixed size in every mode.
  const cardWidth = `calc(var(--cols, ${cols}) * var(--tile-size, ${MAX_TILE_SIZE}px) + (var(--cols, ${cols}) - 1) * var(--tile-gap, ${TILE_GAP}px) + ${ROW_PADDING * 4}px)`;

  return (
    <div className="mx-auto w-full flex grow justify-center items-center">
      <div className="w-full flex flex-col items-center">
        {/* Stack the scoreboard and guess cards with the same gap that
            separates two guess rows (each row contributes ROW_PADDING). */}
        <div
          className="w-full flex flex-col items-center"
          style={{ gap: `${ROW_PADDING * 2}px` }}
        >
          <div
            className="scoreboard-scope bg-default shadow-lg rounded-lg p-1"
            style={{ width: cardWidth }}
          >
            {isLoading ? (
              <SkeletonScoreboard />
            ) : (
              <Scoreboard
                gram={gram}
                puzzleNumber={puzzleNumber}
                difficulty={difficulty}
                mode={mode}
                isPremium={isPremium}
              />
            )}
          </div>
          <div
            ref={root}
            className="flex flex-col bg-default justify-center shadow-lg rounded-lg p-1"
            style={{ width: cardWidth }}
          >
            {Array.from({ length: MAX_GUESSES }, (_, rowIndex) =>
              isLoading ? (
                <SkeletonRow
                  key={rowIndex}
                  cols={cols}
                  isFirstRow={rowIndex === 0}
                  isLastRow={rowIndex === MAX_GUESSES - 1}
                />
              ) : (
                <GuessRow
                  key={rowIndex}
                  guess={guesses[rowIndex] ?? ""}
                  feedback={feedback[rowIndex]}
                  gram={gram}
                  cols={cols}
                  isCurrentRow={rowIndex === currentGuessIndex}
                  isFirstRow={rowIndex === 0}
                  isLastRow={rowIndex === MAX_GUESSES - 1}
                />
              ),
            )}
          </div>
        </div>
        {isLoading && (
          <div
            className="mt-4 self-center text-xs uppercase tracking-wider text-accent"
            role="status"
            aria-live="polite"
          >
            Loading the board...
          </div>
        )}
      </div>
    </div>
  );
}
