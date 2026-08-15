import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import type { User } from "~/prisma-generated/browser";
import type { DailyModeData } from "~/trpc/router";
import Guesses from "~/components/Guesses";
import GameLoadingOverlay from "~/components/game/GameLoadingOverlay";
import Keyboard from "~/components/keyboard/Keyboard";
import Button from "~/components/buttons/Button";
import { useGameStore, type GameStatus } from "~/stores/game-store";
import { useStatsRecorder } from "~/hooks/useStatsRecorder";
import {
  useEndGameDialog,
  useEndGameDialogStore,
} from "~/hooks/useEndGameDialog";
import { useTimedOverlay } from "~/hooks/useTimedOverlay";
import { useIsomorphicLayoutEffect } from "~/hooks/useIsomorphicLayoutEffect";

// The end-game dialog pulls in the entire recap/stats/charts/canvas-share tree,
// none of which is needed until a game is terminal. Splitting it here keeps that
// subtree out of the initial (in-progress) load; it is warmed on game-over so it
// is resolved before the auto-open delay elapses.
const EndGameDialog = lazy(() => import("~/components/EndGameDialog"));

interface GameBoardProps {
  data: DailyModeData;
  user: User | undefined;
  // True when rendering a replayed past puzzle from the archive.
  isArchive?: boolean;
}

// Read `isAppHydrated` through useSyncExternalStore so SSR and the first client
// (hydration) render always agree. The server never runs effects, so its HTML is
// produced with `isAppHydrated=false`; but a lazy route boundary can defer this
// board's hydration until AFTER the root effect flips the global to `true`.
// Reading the raw store during render would then omit the overlay the SSR HTML
// included and fail hydration. The server snapshot pins the hydration render to
// `false` (overlay shown, matching SSR), then React re-syncs to the live value.
// Client-side mode switches never hydrate, so they read the live value directly
// and still skip the overlay for instant switching.
const subscribeAppHydrated = (onChange: () => void) =>
  useEndGameDialogStore.subscribe(onChange);
const getAppHydrated = () => useEndGameDialogStore.getState().isAppHydrated;
const getAppHydratedServer = () => false;

export default function GameBoard({
  data,
  user,
  isArchive = false,
}: GameBoardProps) {
  useStatsRecorder({
    isAuthed: !!user,
    puzzleNumber: data.puzzleNumber,
    mode: data.mode,
    isArchive,
  });
  const storeStatus = useGameStore((s) => s.status);
  const storeHasData = useGameStore((s) => s.guesses.length > 0);
  const openEndGameDialog = useEndGameDialogStore((s) => s.setIsOpen);
  const setIsAppHydrated = useEndGameDialogStore((s) => s.setIsAppHydrated);
  // Drives the IN_PROGRESS -> terminal auto-open detection from the always-mounted
  // board rather than from inside the lazily-loaded dialog, so completing a game
  // still opens the dialog even before its chunk has been requested.
  const { isOpen: isEndGameOpen } = useEndGameDialog();

  // Before the store is seeded on the client, derive status from route
  // context so SSR and first client render agree with the user's real state.
  const effectiveStatus: GameStatus = storeHasData
    ? storeStatus
    : ((data.gameState?.status as GameStatus | undefined) ?? "IN_PROGRESS");
  const isGameOver = effectiveStatus !== "IN_PROGRESS";

  // Warm the dialog chunk as soon as the game is terminal so it resolves during
  // the auto-open delay (or before the user taps "View results"), avoiding a
  // Suspense flash on open. The import is deduped, so this is a no-op once loaded.
  useEffect(() => {
    if (isGameOver) void import("~/components/EndGameDialog");
  }, [isGameOver]);

  // The full-screen overlay only exists to mask the gap between the empty SSR
  // board and the client store seed on the very first load. After the app has
  // hydrated once this session, client-side mode switches re-seed the store
  // synchronously before paint (layout effect below), so the overlay is skipped
  // and switching feels instant. See the snapshot helpers above for why this
  // reads through useSyncExternalStore rather than the store directly.
  //
  // The server-snapshot pin only matters for the SSR'd daily routes. Archive
  // routes are `ssr: false`, so this board has no SSR HTML to match and always
  // mounts after the app has hydrated (`isAppHydrated` already true). Pinning
  // the server snapshot to `false` there would mismatch the live client value
  // and force a re-render mid-mount ("state update on a component that hasn't
  // mounted yet"), so archive reads the live value for both snapshots.
  const isAppHydrated = useSyncExternalStore(
    subscribeAppHydrated,
    getAppHydrated,
    isArchive ? getAppHydrated : getAppHydratedServer,
  );
  const [isLoading, setIsLoading] = useState(() => !isAppHydrated);
  // Adds fade-in/out and a minimum on-screen time on top of the raw flag.
  const overlay = useTimedOverlay(isLoading);

  // Start the board/keyboard entrance the moment the loading overlay begins to
  // fade out (`isVisible` false), not when it finishes unmounting. Waiting for
  // the unmount lets the 300ms fade reveal the static SSR board first, so the
  // entrance would then play on an already-visible board. Triggering at
  // fade-start hides the board (drop-in begins at opacity 0) behind the fading
  // overlay for a clean hand-off. On a client-side mode switch the overlay
  // never renders, so `shouldRender` is false and this is true from first render.
  const animateIn = !overlay.shouldRender || !overlay.isVisible;

  // Layout effect (not a passive effect) so the authed seed lands before the
  // browser paints; otherwise a switch away from a played mode would flash the
  // previous mode's guesses, which `Guesses` prefers while the store has data.
  useIsomorphicLayoutEffect(() => {
    // The end-game dialog pauses input on open (its `onOpen`/`onClose` toggle
    // `isPaused`). Navigating straight from the open dialog to another
    // in-progress puzzle unmounts the dialog via its `IN_PROGRESS` early-return
    // before that close handler can run, so the store would stay paused and the
    // keyboard frozen. After seeding, if the loaded game is still playable,
    // resume it and drop the stale dialog-open flag. Terminal games are left
    // untouched so switching to an already-completed mode keeps the dialog open.
    const unfreezeIfPlayable = () => {
      if (useGameStore.getState().status === "IN_PROGRESS") {
        useGameStore.setState({ isPaused: false });
        useEndGameDialogStore.getState().setIsOpen(false);
      }
    };

    if (user) {
      useGameStore.setState({
        date: data.date,
        gram: data.gram,
        mode: data.mode,
        wordLength: data.wordLength,
        isArchive,
        guesses: data.gameState?.guesses ?? [],
        feedback: data.gameState?.feedback ?? [],
        currentGuessIndex: data.gameState?.guesses.length ?? 0,
        status: (data.gameState?.status as GameStatus) ?? "IN_PROGRESS",
        revealedWord: data.gameState?.word ?? null,
        score: data.gameState?.score ?? null,
      });
      setIsAppHydrated(true);
      setIsLoading(false);
      unfreezeIfPlayable();
      return;
    }

    const store = useGameStore;
    const { setDailyPuzzle, resetSession } = store.getState();

    const finish = () => {
      setIsLoading(false);
      setIsAppHydrated(true);
      unfreezeIfPlayable();
    };

    const hasPersisted =
      window.localStorage.getItem("grammble-game") !== null;

    if (hasPersisted) {
      store.persist.rehydrate()?.then(() => {
        store
          .getState()
          .setDailyPuzzle(data.date, data.gram, data.mode, isArchive);
        finish();
      });
    } else {
      resetSession();
      setDailyPuzzle(data.date, data.gram, data.mode, isArchive);
      finish();
    }
  }, [data, user, isArchive]);

  return (
    <>
      {overlay.shouldRender && (
        <GameLoadingOverlay
          gram={data.gram}
          puzzleNumber={data.puzzleNumber}
          date={data.date}
          visible={overlay.isVisible}
        />
      )}
      {/* Key by game identity so switching modes (or archive dates) mounts a
          fresh board instead of reusing tiles from the previous game. Reusing
          them replays per-tile exit animations (CHAR_OUT) and leaves a
          dismissing gram lingering in rows that are empty in the new game. */}
      <Guesses
        key={`${data.mode}-${data.date}`}
        gram={data.gram}
        date={data.date}
        puzzleNumber={data.puzzleNumber}
        difficulty={data.difficulty}
        mode={data.mode}
        isPremium={!!user?.isPremium}
        cols={data.wordLength}
        initialGuesses={data.gameState?.guesses}
        initialFeedback={data.gameState?.feedback}
        animateIn={animateIn}
      />
      {isLoading ? null : isGameOver ? (
        <div className="flex justify-center p-4">
          <Button onClick={() => openEndGameDialog(true)}>View results</Button>
        </div>
      ) : (
        <div className="relative left-1/2 w-screen max-w-[480px] -translate-x-1/2">
          <Keyboard />
        </div>
      )}
      {isEndGameOpen && (
        <Suspense fallback={null}>
          <EndGameDialog
            puzzleNumber={data.puzzleNumber}
            difficulty={data.difficulty}
            isAuthed={!!user}
            isPremium={!!user?.isPremium}
            initialStats={data.stats}
          />
        </Suspense>
      )}
    </>
  );
}
