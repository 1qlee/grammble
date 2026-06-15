import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
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
}

export default function GameModeView({ mode, data, user }: GameModeViewProps) {
  const navigate = useNavigate();
  const openUpsell = useAppDialogStore((s) => s.open);

  const selectMode = (next: GameMode) => {
    navigate({ to: MODE_ROUTE_BY_MODE[next] });
  };

  // A non-premium user who lands directly on a locked mode (e.g. via URL) has
  // no puzzle data for it; prompt them to upgrade.
  useEffect(() => {
    if (!data) openUpsell("subscription");
  }, [data, openUpsell]);

  return (
    <div
      className="board-scope flex flex-col gap-y-4 h-[calc(100svh-84px)]"
      style={{ ["--cols" as string]: WORD_LENGTH_BY_MODE[mode] }}
      suppressHydrationWarning
    >
      {data ? (
        <GameBoard data={data} user={user} />
      ) : (
        <div className="flex grow flex-col items-center justify-center gap-4 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            The {WORD_LENGTH_BY_MODE[mode]}-letter mode is available to premium
            members.
          </p>
          <div className="flex gap-2">
            <Button variant="gold" onClick={() => openUpsell("subscription")}>
              Go Premium
            </Button>
            <Button onClick={() => selectMode("SIX")}>Play 6-letter</Button>
          </div>
        </div>
      )}
    </div>
  );
}
