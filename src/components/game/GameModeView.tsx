import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClock, X } from "lucide-react";
import type { User } from "~/prisma-generated/browser";
import type { DailyModeData } from "~/trpc/router";
import Button from "~/components/buttons/Button";
import GameBoard from "~/components/game/GameBoard";
import { useAppDialogStore } from "~/hooks/useAppDialog";
import {
  MODE_ROUTE_BY_MODE,
  WORD_LENGTH_BY_MODE,
  type GameMode,
} from "~/utils/game/constants";

interface GameModeViewProps {
  mode: GameMode;
  // null when the mode is locked for this user (premium-gated, non-premium).
  data: DailyModeData | null;
  user: User | undefined;
  // True when this view renders a past puzzle loaded from the archive.
  isArchive?: boolean;
  archiveDate?: string;
}

function formatArchiveDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function GameModeView({
  mode,
  data,
  user,
  isArchive = false,
  archiveDate,
}: GameModeViewProps) {
  const navigate = useNavigate();
  const openUpsell = useAppDialogStore((s) => s.open);

  const selectMode = (next: GameMode) => {
    navigate({ to: MODE_ROUTE_BY_MODE[next] });
  };

  // A non-premium user who lands directly on a locked mode (e.g. via URL) has
  // no puzzle data for it; prompt them to upgrade. Keyed off the mount-time
  // data so this only reflects a direct landing. Logging out while on a locked
  // route transitions `data` present -> null via router invalidation; keying off
  // live `data` would (wrongly) fire the upsell during that logout redirect.
  const hadDataOnMount = useRef(data !== null);
  useEffect(() => {
    if (!hadDataOnMount.current) openUpsell("subscription");
  }, [openUpsell]);

  return (
    <div
      className="board-scope flex flex-col gap-y-4 h-[calc(100svh-84px)]"
      style={{ ["--cols" as string]: WORD_LENGTH_BY_MODE[mode] }}
      suppressHydrationWarning
    >
      {data ? (
        <GameBoard data={data} user={user} isArchive={isArchive} />
      ) : (
        <div className="flex grow flex-col items-center justify-center gap-4 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            {isArchive
              ? "The puzzle archive is available to premium members."
              : `The ${WORD_LENGTH_BY_MODE[mode]}-letter mode is available to premium members.`}
          </p>
          <div className="flex gap-2">
            <Button variant="gold" onClick={() => openUpsell("subscription")}>
              Go Premium
            </Button>
            <Button onClick={() => selectMode(isArchive ? mode : "SIX")}>
              {isArchive ? "Back to today" : "Play 6-letter"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
