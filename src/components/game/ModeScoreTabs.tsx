import { CirclePlay, Crown } from "lucide-react";
import {
  GAME_MODES,
  WORD_LENGTH_BY_MODE,
  type GameMode,
} from "~/utils/game/constants";
import { useModeNavigation } from "./useModeNavigation";

interface ModeScoreTabsProps {
  current: GameMode;
  isPremium: boolean;
  // Per-mode score for today's puzzle. A numeric value renders the completed
  // (green) keycap with a score band; omit/null marks a mode as not yet played.
  scoreByMode: Partial<Record<GameMode, number | null>>;
  // Called before a click navigates or opens the upsell, so the host dialog can
  // close itself first (see `useModeNavigation`).
  onLeave?: () => void;
}

// Keycap geometry scales off the shared `--tab-size`, with a 30px fallback for
// standalone use in the end-game dialog (where the scoreboard vars are unset).
const tileStyle = {
  width: "var(--tab-size, 30px)",
  height: "calc(var(--tab-size, 30px) * 1.4)",
  borderRadius: "calc(var(--tab-size, 30px) * 0.3)",
} as React.CSSProperties;

const numStyle = {
  fontSize: "var(--tab-font, 13px)",
} as React.CSSProperties;

const bandStyle = {
  height: "calc(var(--tab-size, 30px) * 0.5)",
  fontSize: "calc(var(--tab-font, 13px) * 0.72)",
} as React.CSSProperties;

const unitStyle = {
  fontSize: "calc(var(--tab-font, 13px) * 0.55)",
} as React.CSSProperties;

export default function ModeScoreTabs({
  current,
  isPremium,
  scoreByMode,
  onLeave,
}: ModeScoreTabsProps) {
  const { isLocked, handleClick } = useModeNavigation(
    current,
    isPremium,
    onLeave,
  );

  return (
    <div className="flex" style={{ gap: "calc(var(--tab-size, 30px) * 0.17)" }}>
      {GAME_MODES.map((mode) => {
        const locked = isLocked(mode);
        const active = mode === current;
        const modeScore = scoreByMode[mode];
        const done = !locked && typeof modeScore === "number";

        const tileClasses = locked
          ? "bg-locked-stripes bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          : done
            ? "bg-linear-to-b from-green-200 to-green-400 border-green-500 hover:from-green-300 hover:to-green-500 dark:from-green-600 dark:to-green-700 dark:border-green-800 dark:hover:from-green-500 dark:hover:to-green-600"
            : "bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-300 dark:hover:bg-zinc-600";

        const numClasses = locked
          ? "text-zinc-500"
          : done
            ? "text-green-900 dark:text-green-50"
            : "text-zinc-700 dark:text-zinc-200";

        return (
          <button
            key={mode}
            type="button"
            onClick={() => handleClick(mode)}
            aria-pressed={active}
            aria-label={`${WORD_LENGTH_BY_MODE[mode]}-letter mode${
              locked ? " (premium)" : done ? ` (${modeScore} pts)` : " (not played)"
            }`}
            className={`relative flex cursor-pointer flex-col overflow-hidden border text-left shadow-sm transition-colors ${tileClasses} ${
              active
                ? "ring-2 ring-offset-1 ring-green-600 ring-offset-white dark:ring-green-500 dark:ring-offset-zinc-900"
                : ""
            }`}
            style={tileStyle}
          >
            <span
              className={`grid flex-1 place-items-center font-extrabold leading-none ${numClasses}`}
              style={numStyle}
            >
              {WORD_LENGTH_BY_MODE[mode]}
            </span>

            {locked ? (
              <span
                className="flex items-center justify-center border-t border-zinc-300/70 bg-black/5 text-yellow-400 dark:border-zinc-600/70 dark:bg-black/20"
                style={bandStyle}
              >
                <Crown className="h-2.5 w-2.5 fill-yellow-400" aria-hidden="true" />
              </span>
            ) : done ? (
              <span
                className="flex items-center justify-center gap-px bg-black/10 font-bold tabular-nums leading-none text-green-900 dark:bg-black/20 dark:text-green-50"
                style={bandStyle}
              >
                {modeScore}
                <small className="font-semibold opacity-65" style={unitStyle}>
                  pts
                </small>
              </span>
            ) : (
              <span
                className="flex items-center justify-center bg-black/5 text-zinc-400 dark:bg-white/5 dark:text-zinc-500"
                style={bandStyle}
              >
                <CirclePlay className="h-2.5 w-2.5" aria-hidden="true" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
