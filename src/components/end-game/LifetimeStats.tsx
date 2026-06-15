export function LifetimeStats({
  played,
  winPct,
  currentStreak,
  maxStreak,
  avgScore,
  bestScore,
}: {
  played: number;
  winPct: number;
  currentStreak: number;
  maxStreak: number;
  avgScore: number;
  bestScore: number;
}) {
  const rows: Array<[string, number | string]> = [
    ["Played", played],
    ["Win %", `${winPct}%`],
    ["Streak", currentStreak],
    ["Best streak", maxStreak],
    ["Avg score", avgScore],
    ["Best score", bestScore],
  ];
  return (
    <div className="bg-accent rounded-xl p-4">
      <p className="text-xs font-bold mb-2">
        Stats
      </p>
      <div className="flex flex-col gap-[7px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex text-xs items-center justify-between">
            <span className="text-accent">{label}</span>
            <span className="font-bold tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
