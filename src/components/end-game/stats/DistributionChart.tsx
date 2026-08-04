import { useMemo } from "react";
import { useDelayedFlag } from "./useDelayedFlag";
import { CASCADE } from "./cascade.constants";

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
              <span className="w-3 font-mono text-accent">{i + 1}</span>
              <div className="flex-1 h-4 rounded-sm shadow-[inset_0_1px_4px_var(--color-zinc-300)] bg-zinc-100 dark:bg-zinc-800 dark:shadow-[inset_0_1px_2px_var(--color-zinc-950)]">
                <div
                  className={`h-full rounded-sm transition-[width] ease-[cubic-bezier(.2,.7,.3,1)] ${isHighlight
                    ? "bg-gradient-to-r from-green-200 to-green-300 shadow-[0px_0px_2px_var(--color-green-100)] dark:from-green-700 dark:to-green-600 dark:shadow-[0px_0px_2px_var(--color-green-800)]"
                    : "bg-gradient-to-r from-zinc-200 to-zinc-300 shadow-[0px_0px_2px_var(--color-zinc-300)] dark:from-zinc-800 dark:to-zinc-700 dark:shadow-[0px_0px_2px_var(--color-zinc-900)]"
                    }`}
                  style={{
                    width: `${revealed ? pct : prevPct}%`,
                    transitionDuration: `${CASCADE.bars.duration}ms`,
                  }}
                />
              </div>
              <span
                className={`font-bold tabular-nums ${isHighlight ? "text-green-600 dark:text-green-400" : ""}`}
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
