import { useEffect, useState } from "react";
import type { User } from "~/prisma-generated/browser";
import type { DailyModeData } from "~/trpc/router";
import EndGameDialog from "~/components/EndGameDialog";
import Guesses from "~/components/Guesses";
import Keyboard from "~/components/keyboard/Keyboard";
import Button from "~/components/buttons/Button";
import { useGameStore, type GameStatus } from "~/stores/game-store";
import { useStatsRecorder } from "~/hooks/useStatsRecorder";
import { useEndGameDialogStore } from "~/hooks/useEndGameDialog";

interface GameBoardProps {
  data: DailyModeData;
  user: User | undefined;
}

export default function GameBoard({ data, user }: GameBoardProps) {
  useStatsRecorder({
    isAuthed: !!user,
    puzzleNumber: data.puzzleNumber,
    mode: data.mode,
  });
  const storeStatus = useGameStore((s) => s.status);
  const storeHasData = useGameStore((s) => s.guesses.length > 0);
  const openEndGameDialog = useEndGameDialogStore((s) => s.setIsOpen);
  const setIsAppHydrated = useEndGameDialogStore((s) => s.setIsAppHydrated);

  // Before the store is seeded on the client, derive status from route
  // context so SSR and first client render agree with the user's real state.
  const effectiveStatus: GameStatus = storeHasData
    ? storeStatus
    : ((data.gameState?.status as GameStatus | undefined) ?? "IN_PROGRESS");
  const isGameOver = effectiveStatus !== "IN_PROGRESS";

  // SSR renders an empty board for unauthed users (no skeleton). The skeleton
  // only appears on the client if localStorage actually has state to restore.
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      useGameStore.setState({
        date: data.date,
        gram: data.gram,
        mode: data.mode,
        wordLength: data.wordLength,
        guesses: data.gameState?.guesses ?? [],
        feedback: data.gameState?.feedback ?? [],
        currentGuessIndex: data.gameState?.guesses.length ?? 0,
        status: (data.gameState?.status as GameStatus) ?? "IN_PROGRESS",
        revealedWord: data.gameState?.word ?? null,
        score: data.gameState?.score ?? null,
      });
      setIsAppHydrated(true);
      return;
    }

    const store = useGameStore;
    const { setDailyPuzzle, resetSession } = store.getState();

    const finish = () => {
      setIsLoading(false);
      setIsAppHydrated(true);
    };

    const hasPersisted =
      window.localStorage.getItem("grammble-game") !== null;

    if (hasPersisted) {
      setIsLoading(true);
      store.persist.rehydrate()?.then(() => {
        store.getState().setDailyPuzzle(data.date, data.gram, data.mode);
        finish();
      });
    } else {
      resetSession();
      setDailyPuzzle(data.date, data.gram, data.mode);
      finish();
    }
  }, [data, user]);

  return (
    <>
      <Guesses
        gram={data.gram}
        puzzleNumber={data.puzzleNumber}
        difficulty={data.difficulty}
        mode={data.mode}
        isPremium={!!user?.isPremium}
        cols={data.wordLength}
        isLoading={isLoading}
        initialGuesses={data.gameState?.guesses}
        initialFeedback={data.gameState?.feedback}
      />
      {isLoading ? null : isGameOver ? (
        <div className="flex justify-center p-4">
          <Button onClick={() => openEndGameDialog(true)}>View results</Button>
        </div>
      ) : (
        <Keyboard />
      )}
      <EndGameDialog
        puzzleNumber={data.puzzleNumber}
        difficulty={data.difficulty}
        isAuthed={!!user}
        isPremium={!!user?.isPremium}
        initialStats={data.stats}
      />
    </>
  );
}
