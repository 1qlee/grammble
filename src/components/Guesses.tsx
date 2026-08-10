import { useState } from "react";
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

interface GuessesProps {
  gram: string;
  date: string;
  puzzleNumber: number;
  difficulty: "easy" | "med" | "hard";
  mode: GameMode;
  isPremium: boolean;
  cols?: number;
  initialGuesses?: string[];
  initialFeedback?: LetterFeedback[][];
  // Plays the drop-in entrance (and defers the tile reveal cascade) once true.
  animateIn?: boolean;
}

export default function Guesses({
  gram,
  date,
  puzzleNumber,
  difficulty,
  mode,
  isPremium,
  cols = WORD_LENGTH,
  initialGuesses,
  initialFeedback,
  animateIn = false,
}: GuessesProps) {
  const storeGuesses = useGameStore((s) => s.guesses);
  const storeFeedback = useGameStore((s) => s.feedback);
  const storeCurrentGuessIndex = useGameStore((s) => s.currentGuessIndex);
  const storeDate = useGameStore((s) => s.date);
  const storeMode = useGameStore((s) => s.mode);

  // The store lags a remount by one render: switching games remounts this board
  // (keyed by identity) while the store still holds the PREVIOUS game until
  // GameBoard's layout effect re-seeds it. Trusting it then paints the old
  // game's letters, and re-seeding to this game runs CHAR_OUT exits on the tiles
  // that are empty here, leaving stale tiles lingering on top. Only treat the
  // store as authoritative once its identity matches this game; otherwise fall
  // back to the route-provided state, which is already correct on first render.
  const storeMatchesGame = storeDate === date && storeMode === mode;
  const hasStoreData = storeMatchesGame && storeGuesses.length > 0;
  const guesses = hasStoreData ? storeGuesses : (initialGuesses ?? []);
  const feedback = hasStoreData ? storeFeedback : (initialFeedback ?? []);
  const currentGuessIndex = hasStoreData
    ? storeCurrentGuessIndex
    : (initialGuesses?.length ?? 0);

  // Rows already submitted at mount reveal (pop in) on load. Captured once so
  // later submissions (rows >= this count) keep their own submit/char animations
  // instead of replaying the reveal. Prefer the route's game state over the
  // store: on a mode switch this board is remounted (keyed by game identity)
  // while the store still holds the previous game for one render, so the store
  // count would be stale until GameBoard re-seeds it. Use `currentGuessIndex`,
  // not `guesses.length`: the in-progress (unsubmitted) guess lives at
  // `guesses[currentGuessIndex]`, so the length would count the active row as
  // submitted and (on a back/forward remount, where the store already matches)
  // wrongly play the reveal on it, unmasking its transparent parked gram well.
  const [revealCount] = useState(
    () =>
      initialGuesses?.length ??
      (storeMatchesGame ? storeCurrentGuessIndex : 0),
  );

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
          className={`w-full flex flex-col items-center${
            animateIn ? " board-enter" : ""
          }`}
          style={{ gap: `${ROW_PADDING * 2}px` }}
        >
          <div
            className="scoreboard-scope bg-default border border-zinc-200 dark:border-zinc-700 rounded-lg p-1"
            style={{ width: cardWidth }}
          >
            <Scoreboard
              gram={gram}
              date={date}
              puzzleNumber={puzzleNumber}
              difficulty={difficulty}
              mode={mode}
              isPremium={isPremium}
            />
          </div>
          <div
            className="flex flex-col bg-default justify-center border border-zinc-200 dark:border-zinc-700 rounded-lg p-1"
            style={{ width: cardWidth }}
          >
            {Array.from({ length: MAX_GUESSES }, (_, rowIndex) => (
              <GuessRow
                key={rowIndex}
                guess={guesses[rowIndex] ?? ""}
                feedback={feedback[rowIndex]}
                gram={gram}
                cols={cols}
                isCurrentRow={rowIndex === currentGuessIndex}
                isFirstRow={rowIndex === 0}
                isLastRow={rowIndex === MAX_GUESSES - 1}
                revealRow={rowIndex < revealCount ? rowIndex : undefined}
                animateIn={animateIn}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
