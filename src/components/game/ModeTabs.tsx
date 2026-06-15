import { CircleCheck, Crown } from "lucide-react";
import {
  GAME_MODES,
  WORD_LENGTH_BY_MODE,
  type GameMode,
} from "~/utils/game/constants";
import VerticalLabel from "~/components/ui/VerticalLabel";
import { useModeNavigation } from "./useModeNavigation";

interface ModeTabsProps {
  current: GameMode;
  isPremium: boolean;
  showLabel?: boolean;
}

// Pip size/typography ride the shared scoreboard scale vars so the pips track
// the tile grid.
const pipStyle = {
  width: "var(--tab-size, 30px)",
  height: "var(--tab-size, 30px)",
  borderRadius: "calc(var(--tab-size, 30px) * 0.3)",
  fontSize: "var(--tab-font, 13px)",
} as React.CSSProperties;

export default function ModeTabs({
  current,
  isPremium,
  showLabel = true,
}: ModeTabsProps) {
  const { isLocked, handleClick } = useModeNavigation(current, isPremium);

  return (
    <div className="inline-flex items-center" style={{ gap: "var(--sb-px)" }}>
      {showLabel && <VerticalLabel>Mode</VerticalLabel>}

      <div className="flex" style={{ gap: "calc(var(--tab-size, 30px) * 0.17)" }}>
        {GAME_MODES.map((mode) => {
          const locked = isLocked(mode);
          const active = mode === current;

          const stateClasses = locked
            ? "bg-locked-stripes bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            : active
              ? "bg-green-500 border-green-600 text-green-950 hover:bg-green-600"
              : "bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600";

          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleClick(mode)}
              aria-pressed={active}
              aria-label={`${WORD_LENGTH_BY_MODE[mode]}-letter mode${locked ? " (premium)" : ""
                }`}
              className={`relative grid cursor-pointer place-items-center border font-bold leading-none transition-colors ${stateClasses}`}
              style={pipStyle}
            >
              {WORD_LENGTH_BY_MODE[mode]}
              {locked && (
                <span className="absolute -top-1 -right-1 flex rounded-full bg-white p-px text-yellow-400 dark:bg-zinc-900">
                  <Crown
                    className="h-2.5 w-2.5 fill-yellow-400"
                    aria-hidden="true"
                  />
                </span>
              )}
              {active && !locked && (
                <span className="absolute -top-1 -right-1 flex rounded-full bg-white p-px text-green-600 dark:bg-zinc-900">
                  <CircleCheck
                    className="h-2.5 w-2.5 fill-green-500 text-white dark:text-zinc-900"
                    aria-hidden="true"
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
