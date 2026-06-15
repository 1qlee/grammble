import GramBadge from "~/components/GramBadge";
import ModeTabs from "~/components/game/ModeTabs";
import VerticalLabel from "~/components/ui/VerticalLabel";
import type { GameMode } from "~/utils/game/constants";
import type { Difficulty } from "~/utils/game/share";

interface ScoreboardProps {
  gram: string;
  puzzleNumber: number;
  difficulty: Difficulty;
  mode: GameMode;
  isPremium: boolean;
}

// Static CSS-variable scale map shared by every render. The values are pure
// `calc()` strings keyed off `--tile-size`, so they never depend on props.
const scaleStyle = {
  "--sb-px": "calc(10px + (var(--tile-size, 52px) - 36px) * 0.2)",
  "--sb-py": "calc(6px + (var(--tile-size, 52px) - 36px) * 0.2)",
  "--sb-gram-label-font": "calc(7px + (var(--tile-size, 52px) - 36px) * 0.08)",
  // Inner circular tab height, scaled with the tile grid. The ModeTabs tabs
  // consume this via `--tab-size`, and the gram matches their full control
  // height (tab + p-0.5 [4px] + border [2px]).
  "--sb-tab-h": "clamp(16px, calc(var(--tile-size, 52px) * 0.54), 30px)",
  "--sb-gram-h": "calc(var(--sb-tab-h) + 6px)",
  "--sb-gram-font": "calc(var(--sb-gram-h) * 0.41)",
  "--tab-size": "var(--sb-tab-h)",
  "--tab-font": "calc(var(--sb-tab-h) * 0.45)",
  padding: "var(--sb-py) 8px",
} as React.CSSProperties;

export default function Scoreboard({
  gram,
  puzzleNumber,
  difficulty,
  mode,
  isPremium,
}: ScoreboardProps) {
  return (
    <div
      className="select-none flex w-full items-center justify-between overflow-visible whitespace-nowrap"
      style={scaleStyle}
    >
      <div className="flex items-center" style={{ gap: "var(--sb-px)" }}>
        <VerticalLabel>Gram</VerticalLabel>
        <GramBadge
          gram={gram}
          puzzleNumber={puzzleNumber}
          difficulty={difficulty}
        />
      </div>
      <ModeTabs current={mode} isPremium={isPremium} />
    </div>
  );
}
