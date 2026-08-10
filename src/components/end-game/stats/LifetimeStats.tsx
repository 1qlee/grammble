import { ArrowUp, ArrowDown } from "lucide-react";
import { Odometer } from "./Odometer";
import { CASCADE } from "./cascade.constants";

export type StatValues = {
  played: number;
  winPct: number;
  currentStreak: number;
  maxStreak: number;
  avgScore: number;
  bestScore: number;
};

export function LifetimeStats({
  current,
  previous,
  streakUp,
  streakDown,
  animate = true,
}: {
  current: StatValues;
  // Values before the just-finished game; null when there is no prior game, in
  // which case the odometers count up from zero.
  previous: StatValues | null;
  streakUp: boolean;
  streakDown: boolean;
  animate?: boolean;
}) {
  const rows: Array<{
    label: string;
    value: number;
    from?: number;
    suffix?: string;
  }> = [
      { label: "Played", value: current.played, from: previous?.played },
      { label: "Win %", value: current.winPct, from: previous?.winPct, suffix: "%" },
      { label: "Streak", value: current.currentStreak, from: previous?.currentStreak },
      { label: "Best streak", value: current.maxStreak, from: previous?.maxStreak },
      { label: "Avg score", value: current.avgScore, from: previous?.avgScore },
      { label: "Best score", value: current.bestScore, from: previous?.bestScore },
    ];
  // TEMP DEBUG: remove after diagnosing missing stat color coding.
  console.log("[LifetimeStats] color debug", {
    current,
    previous,
    streakUp,
    streakDown,
    deltas: rows.map((r) => ({
      label: r.label,
      value: r.value,
      from: r.from,
      delta: r.value - (r.from ?? 0),
    })),
  });
  return (
    <div className="endgame-section">
      <p className="section-label mb-2">
        Stats
      </p>
      <div className="flex flex-col gap-[7px]">
        {rows.map((row, i) => {
          // Color the value by how this game moved it: up green, down yellow. A
          // first-time user has no prior stats, so compare against zero (the
          // same baseline the odometers count up from) to surface increases.
          const delta = row.value - (row.from ?? 0);
          // The Streak row's color must track the arrow (streakUp/streakDown),
          // not the raw delta: a streak that resets to 1 after a loss still
          // "went up" this game even though its value dropped from the prior
          // streak.
          const isStreak = row.label === "Streak";
          const isUp = isStreak ? streakUp : delta > 0;
          const isDown = isStreak ? streakDown : delta < 0;
          const deltaClass = isUp
            ? "text-green-600 dark:text-green-400"
            : isDown
              ? "text-yellow-600 dark:text-yellow-400"
              : "";
          return (
            <div key={row.label} className="flex text-xs items-center gap-2">
              <span className="text-accent">{row.label}</span>
              <span className="flex-1 border-b border-dotted border-zinc-300" />
              <span
                className={`flex items-center gap-0.5 font-bold tabular-nums ${deltaClass}`}
              >
                {row.label === "Streak" && streakUp && (<ArrowUp className="w-3 h-3 text-green-600 dark:text-green-400" aria-label="Streak increased" />)}
                {row.label === "Streak" && streakDown && (<ArrowDown className="w-3 h-3 text-yellow-600 dark:text-yellow-400" aria-label="Streak lost" />)}
                <Odometer
                  value={row.value}
                  from={row.from ?? 0}
                  suffix={row.suffix}
                  delay={CASCADE.stats.delay + i * CASCADE.stats.stagger}
                  duration={CASCADE.stats.duration}
                  animate={animate}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
