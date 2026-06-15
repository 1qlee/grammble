import { Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import Button from "~/components/buttons/Button";
import { GAME_MODES, WORD_LENGTH_BY_MODE, MODE_ROUTE_BY_MODE } from "~/utils/game/constants";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

type LogoTile = "empty" | "correct" | "misplaced" | "absent";

// 3x3 brand mark mirroring the favicon: a scattering of game-feedback tiles.
const LOGO_TILES: LogoTile[] = [
  "correct",
  "misplaced",
  "empty",
  "correct",
  "correct",
  "misplaced",
  "correct",
  "correct",
  "correct",
];

const LOGO_TILE_CLASS: Record<LogoTile, string> = {
  empty: "tile-char",
  correct: "tile-char tile-correct",
  misplaced: "tile-char tile-misplaced",
  absent: "tile-char tile-absent",
};

function GrammbleMark() {
  return (
    <div className="rounded-lg bg-default p-2 shadow-lg">
      <div
        className="grid grid-cols-3 gap-1"
        style={{ ["--tile-size" as string]: "18px" }}
      >
        {LOGO_TILES.map((tile, i) => (
          <div key={i} className="h-[16px] w-[16px]">
            <div className={LOGO_TILE_CLASS[tile]} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface MainMenuProps {
  puzzleNumber: number;
  date: string;
  /** True until the app has hydrated; keeps the Play button in a loading state. */
  isLoading: boolean;
  /** Premium users get a quick picker for all three modes. */
  isPremium: boolean;
  onPlay: () => void;
}

export function MainMenu({
  puzzleNumber,
  date,
  isLoading,
  isPremium,
  onPlay,
}: MainMenuProps) {
  return (
    <div className="flex min-h-[calc(100svh-84px)] flex-col items-center justify-center gap-10 text-center">
      <div className="flex flex-col items-center gap-7">
        <GrammbleMark />
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-5xl font-bold tracking-tighter text-zinc-900 dark:text-zinc-100">
            grammble
          </h1>
          <p className="max-w-[14rem] text-lg leading-snug text-zinc-500 dark:text-zinc-400">
            The two letter word game. New every day.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Button
          variant="gold"
          onClick={onPlay}
          disabled={isLoading}
          aria-busy={isLoading}
          className="w-44 gap-2 disabled:cursor-wait disabled:opacity-80"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading
            </>
          ) : (
            "Play"
          )}
        </Button>

        {isPremium && (
          <div className="flex w-44 gap-1 rounded-lg bg-default-shadow p-1">
            {GAME_MODES.map((mode) => (
              <Link
                key={mode}
                to={MODE_ROUTE_BY_MODE[mode]}
                preload="intent"
                className="flex-1 rounded-md px-2 py-1.5 text-center text-sm font-semibold text-zinc-600 no-underline transition-colors hover:bg-default hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                {WORD_LENGTH_BY_MODE[mode]}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {formatDate(date)}
        </span>
        <span className="text-sm text-zinc-400 dark:text-zinc-500">
          No. {puzzleNumber}
        </span>
      </div>
    </div>
  );
}
