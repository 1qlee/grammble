import * as React from "react";
import { Loader2 } from "lucide-react";
import Button from "~/components/buttons/Button";
import { GramFace } from "~/components/guesses/GramFace";
import {
  GAME_MODES,
  WORD_LENGTH_BY_MODE,
  DEFAULT_GAME_MODE,
  type GameMode,
} from "~/utils/game/constants";
import type { DailyModeData } from "~/trpc/router";

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

interface MainMenuProps {
  /** Per-mode daily data (always includes SIX; SEVEN/EIGHT for premium). The
      selected mode drives the displayed gram, date, and puzzle number. */
  dailies: Partial<Record<GameMode, DailyModeData>>;
  /** True until the app has hydrated; keeps the Play button in a loading state. */
  isLoading: boolean;
  /** Only signed-in premium members get the 6/7/8 letter-length picker. */
  showModePicker: boolean;
  onPlay: (mode: GameMode) => void;
}

export function MainMenu({
  dailies,
  isLoading,
  showModePicker,
  onPlay,
}: MainMenuProps) {
  const [selectedMode, setSelectedMode] =
    React.useState<GameMode>(DEFAULT_GAME_MODE);
  const current = dailies[selectedMode] ?? dailies[DEFAULT_GAME_MODE];
  if (!current) return null;
  const letters = current.gram.toUpperCase().split("");

  return (
    <div className="flex min-h-[calc(100svh-84px)] flex-col items-center justify-center">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-8 rounded-lg bg-default-shadow px-8 py-10 text-center sm:px-10">
        <div className="flex flex-col items-center gap-2">
          <span className="section-label">Today's Gram</span>
          <span
            className="gram-border inline-grid"
            style={{
              borderRadius:
                "calc(var(--tile-size) * 0.308 + 4px) / calc(var(--tile-size) * 0.231 + 4px)",
            }}
          >
            <span
              className="inline-grid"
              style={{
                width: "calc(var(--tile-size) * 2 + var(--tile-gap, 2px))",
                height: "var(--tile-size)",
                fontSize: "var(--tile-font-size)",
              }}
            >
              <GramFace chars={[letters[0], letters[1]]} />
            </span>
          </span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <h1 className="text-5xl font-bold tracking-tighter text-zinc-900 dark:text-zinc-100">
            grammble
          </h1>
          <p className="max-w-[14rem] text-lg leading-snug text-zinc-500 dark:text-zinc-400">
            The two letter word game. New every day.
          </p>
        </div>

        {showModePicker && (
          <div className="flex flex-col items-center gap-3">
            <span className="section-label">Game Mode</span>
            <div className="flex gap-2">
              {GAME_MODES.map((mode) => {
                const selected = mode === selectedMode;
                return (
                  <Button
                    key={mode}
                    size="none"
                    variant={selected ? "green" : "default"}
                    onClick={() => setSelectedMode(mode)}
                    aria-pressed={selected}
                    style={{
                      width: "calc(var(--tile-size) - 0.25rem)",
                      height: "calc(var(--tile-size) - 0.25rem)",
                      fontSize: "var(--tile-font-size)",
                    }}
                    className="font-bold"
                  >
                    {WORD_LENGTH_BY_MODE[mode]}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <Button
          variant="gold"
          onClick={() => onPlay(selectedMode)}
          disabled={isLoading}
          aria-busy={isLoading}
          className="w-full gap-2 disabled:cursor-wait disabled:opacity-80"
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

        <div className="w-full">
          <div className="mb-4 border-t border-zinc-200 dark:border-zinc-700" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {formatDate(current.date)}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              No. {current.puzzleNumber}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
