import { useMemo } from "react";
import { useDelayedFlag } from "./useDelayedFlag";
import { CASCADE } from "./cascade.constants";
import { useSettings } from "~/utils/providers/settings-provider";

export function DistributionChart({
  distribution,
  highlightRow,
  animate = true,
}: {
  distribution: number[];
  highlightRow: number;
  animate?: boolean;
}) {
  // Pre-game distribution: the highlighted (just-won) row was one lower before
  // this game folded in. Animating from these widths lets bars that lose the
  // lead shrink while the winning bar expands.
  const prevDistribution = useMemo(() => {
    if (highlightRow < 1) return distribution;
    const d = [...distribution];
    d[highlightRow - 1] = Math.max(0, d[highlightRow - 1] - 1);
    return d;
  }, [distribution, highlightRow]);

  const maxBar = Math.max(1, ...distribution);
  const prevMaxBar = Math.max(1, ...prevDistribution);
  const revealed = useDelayedFlag(CASCADE.bars.delay, animate);
  const { colorBlindMode } = useSettings();

  // Match the board's high-contrast palette: the won-row highlight uses the
  // same orange as a "correct" tile when color-blind mode is on.
  const highlightBar = colorBlindMode
    ? "bg-[#f5793a] dark:bg-[#f5793a]"
    : "bg-green-300 dark:bg-green-600";
  const highlightText = colorBlindMode
    ? "text-[#f5793a]"
    : "text-green-600 dark:text-green-400";

  return (
    <div className="endgame-section">
      <p className="section-label mb-2">
        Guesses
      </p>
      <div className="flex flex-col gap-1.5">
        {distribution.map((count, i) => {
          const pct = (count / maxBar) * 100;
          const prevPct = (prevDistribution[i] / prevMaxBar) * 100;
          const isHighlight = i + 1 === highlightRow;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-3 text-accent">{i + 1}</span>
              <div className="flex-1 h-4 rounded-sm border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-sm transition-[width] ease-[cubic-bezier(.2,.7,.3,1)] ${isHighlight
                    ? highlightBar
                    : "bg-zinc-300 dark:bg-zinc-700"
                    }`}
                  style={{
                    width: `${revealed ? pct : prevPct}%`,
                    transitionDuration: `${CASCADE.bars.duration}ms`,
                  }}
                />
              </div>
              <span
                className={`font-bold tabular-nums ${isHighlight ? highlightText : ""}`}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
