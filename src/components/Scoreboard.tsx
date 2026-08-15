import GramBadge from "~/components/GramBadge";
import ArchiveButton from "~/components/game/ArchiveButton";
import ModeTabs from "~/components/game/ModeTabs";
import StackedLabel from "~/components/ui/StackedLabel";
import type { GameMode } from "~/utils/game/constants";
import { formatPuzzleDate } from "~/utils/game/daily-puzzle";
import type { Difficulty } from "~/utils/game/share";

interface ScoreboardProps {
  gram: string;
  date: string;
  puzzleNumber: number;
  difficulty: Difficulty;
  mode: GameMode;
  isPremium: boolean;
}

// Static CSS-variable scale map shared by every render. The values are pure
// `calc()` strings keyed off `--tile-size`, so they never depend on props.
const scaleStyle = {
  "--sb-px": "calc(10px + (var(--tile-size, 52px) - 36px) * 0.2)",
  "--sb-py": "calc(2px + (var(--tile-size, 52px) - 36px) * 0.12)",
  "--sb-gram-label-font": "calc(7px + (var(--tile-size, 52px) - 36px) * 0.08)",
  // Vertical gap between the stacked label and its content.
  "--sb-label-gap": "calc(2px + (var(--tile-size, 52px) - 36px) * 0.04)",
  // Base tab unit, scaled with the tile grid. Must match GramBadge's own
  // `--sb-tab-h` so every header control (gram badge, archive button, mode
  // tabs) resolves to the same `--sb-gram-h` height.
  "--sb-tab-h": "clamp(16px, calc(var(--tile-size, 52px) * 0.54), 30px)",
  "--sb-gram-h": "calc(var(--sb-tab-h) + 6px)",
  "--sb-gram-font": "calc(var(--sb-gram-h) * 0.41)",
  // Mode pips fill the full control height so each tab matches the gram badge.
  "--tab-size": "var(--sb-gram-h)",
  "--tab-font": "calc(var(--sb-gram-h) * 0.41)",
  padding: "var(--sb-py) 8px",
} as React.CSSProperties;

export default function Scoreboard({
  gram,
  date,
  puzzleNumber,
  mode,
  isPremium,
}: ScoreboardProps) {
  return (
    <div
      className="select-none flex w-full items-start justify-between overflow-visible whitespace-nowrap"
      style={scaleStyle}
    >
      <div
        className="flex flex-col items-center"
        style={{ gap: "var(--sb-label-gap)" }}
      >
        <StackedLabel>Gram</StackedLabel>
        <GramBadge gram={gram} />
      </div>

      <div
        className="flex flex-col items-center"
        style={{ gap: "var(--sb-label-gap)" }}
      >
        <StackedLabel>{formatPuzzleDate(date)}</StackedLabel>
        <ArchiveButton
          puzzleNumber={puzzleNumber}
          mode={mode}
          isPremium={isPremium}
        />
      </div>

      <ModeTabs current={mode} isPremium={isPremium} />
    </div>
  );
}
