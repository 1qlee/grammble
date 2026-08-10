import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Crown } from "lucide-react";
import ArchiveDialog from "~/components/game/ArchiveDialog";
import { useAppDialogStore } from "~/hooks/useAppDialog";
import { useEndGameDialogStore } from "~/hooks/useEndGameDialog";
import { useGameStore } from "~/stores/game-store";
import { getDateString } from "~/utils/game/daily-puzzle";
import type { GameMode } from "~/utils/game/constants";
import type { ArchiveDayStatus } from "~/trpc/router";

const ARCHIVE_ROUTE_BY_MODE: Record<
  GameMode,
  "/six/$date" | "/seven/$date" | "/eight/$date"
> = {
  SIX: "/six/$date",
  SEVEN: "/seven/$date",
  EIGHT: "/eight/$date",
};

const DAILY_ROUTE_BY_MODE: Record<GameMode, "/six" | "/seven" | "/eight"> = {
  SIX: "/six",
  SEVEN: "/seven",
  EIGHT: "/eight",
};

interface ArchiveButtonProps {
  puzzleNumber: number;
  mode: GameMode;
  isPremium: boolean;
}

// Keycap-style button showing the daily puzzle number. Opens the puzzle
// archive dialog. Scales with the Scoreboard header vars (`--sb-gram-h` /
// `--sb-gram-font`) so it matches the gram badge height.
export default function ArchiveButton({
  puzzleNumber,
  mode,
  isPremium,
}: ArchiveButtonProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const openUpsell = useAppDialogStore((s) => s.open);
  const navigate = useNavigate();

  const handleClick = () => {
    // The archive is premium-only; non-premium users get the upsell instead.
    if (isPremium) {
      setArchiveOpen(true);
    } else {
      // The archive is a standalone premium feature, not a word-length upsell,
      // so open the subscription tab with the default copy (no mode passed).
      openUpsell("subscription");
    }
  };

  // Play/Resume/Review route to the `/{mode}/{date}` archive board, which loads
  // that day's session. `playMode` is the mode selected in the dialog's header
  // tabs (which may differ from the board's current mode), so a past puzzle can
  // be played in any mode. Today's puzzle is the exception: it lives at the
  // daily `/{mode}` route with no loader, so route there instead. When the user
  // is already on today's game this is a same-route navigation, so it just
  // closes the dialog without re-fetching.
  const handlePlay = (
    date: string,
    status: ArchiveDayStatus,
    playMode: GameMode,
  ) => {
    setArchiveOpen(false);
    // The end-game dialog pauses input on open and only resumes via its close
    // handler. Navigating to another puzzle unmounts that dialog before the
    // handler can run, so the store would stay paused and the keyboard frozen.
    // The destination board's mount effect tries to recover, but the archive
    // route is `ssr: false` with an async, cache-dependent loader, so that
    // recovery races the navigation and only sometimes wins. When the target is
    // playable, clear the pause and dialog-open flag here at the source so input
    // is enabled deterministically. Terminal targets are left paused so loading
    // an already-finished puzzle keeps its results dialog open (review flow).
    if (status === "OPEN" || status === "IN_PROGRESS") {
      useEndGameDialogStore.getState().setIsOpen(false);
      useGameStore.getState().resumeGame();
    }
    if (date === getDateString()) {
      navigate({ to: DAILY_ROUTE_BY_MODE[playMode] });
      return;
    }
    navigate({ to: ARCHIVE_ROUTE_BY_MODE[playMode], params: { date } });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Puzzle number ${puzzleNumber}. Open archive${isPremium ? "" : " (premium)"}`}
        className="surface-raised relative inline-flex items-center justify-center leading-none cursor-pointer transition-colors duration-150 hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
        style={{
          height: "var(--sb-gram-h, 30px)",
          padding: "0 calc(var(--sb-gram-h, 30px) * 0.28)",
          borderRadius:
            "calc(var(--sb-gram-h, 30px) * 0.308) / calc(var(--sb-gram-h, 30px) * 0.231)",
        }}
      >
        <span
          className="font-bold tracking-tight"
          style={{ fontSize: "calc(var(--sb-gram-font, 12px) + 2px)" }}
        >
          {puzzleNumber}
        </span>
        {isPremium ? (
          <ChevronDown
            className="text-zinc-500 dark:text-zinc-400"
            style={{
              width: "calc(var(--sb-gram-font, 12px) * 0.85)",
              height: "calc(var(--sb-gram-font, 12px) * 0.85)",
              marginLeft: "calc(var(--sb-gram-h, 30px) * 0.06 + 2px)",
            }}
          />
        ) : (
          <Crown
            className="fill-yellow-400 text-yellow-400"
            aria-hidden="true"
            style={{
              width: "calc(var(--sb-gram-font, 12px) * 0.85)",
              height: "calc(var(--sb-gram-font, 12px) * 0.85)",
              marginLeft: "calc(var(--sb-gram-h, 30px) * 0.06 + 2px)",
            }}
          />
        )}
      </button>

      <ArchiveDialog
        mode={mode}
        isPremium={isPremium}
        isOpen={archiveOpen}
        setIsOpen={setArchiveOpen}
        onPlay={handlePlay}
      />
    </>
  );
}
