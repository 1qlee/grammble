import { Loader2 } from "lucide-react";
import { formatPuzzleDate } from "~/utils/game/daily-puzzle";

interface GameLoadingOverlayProps {
  gram: string;
  puzzleNumber: number;
  date: string;
  // Drives the fade-out: starts true (opaque, no fade-in) and flips to false to
  // fade the overlay out before it unmounts.
  visible: boolean;
}

// Full-screen cover shown while the game store is being seeded/rehydrated on
// the client. It hides the empty SSR board until the real session is ready, so
// returning players never see a flash of an unfilled board.
export default function GameLoadingOverlay({
  gram,
  puzzleNumber,
  date,
  visible,
}: GameLoadingOverlayProps) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-default transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-3xl font-bold tracking-tighter text-zinc-900 dark:text-zinc-100">
          grammble
        </span>
        <span className="text-2xl font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100">
          {gram}
        </span>
        <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          {formatPuzzleDate(date)}
        </span>
        <span className="text-sm text-accent">No. {puzzleNumber}</span>
      </div>
      <Loader2 className="size-6 animate-spin text-accent" />
      <span className="sr-only">Loading the puzzle...</span>
    </div>
  );
}
