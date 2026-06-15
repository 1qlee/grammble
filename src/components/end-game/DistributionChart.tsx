export function DistributionChart({
  distribution,
  highlightRow,
}: {
  distribution: number[];
  highlightRow: number;
}) {
  const maxBar = Math.max(1, ...distribution);
  return (
    <div className="bg-accent rounded-xl p-4">
      <p className="text-xs font-bold mb-2">
        Guesses
      </p>
      <div className="flex flex-col gap-1.5">
        {distribution.map((count, i) => {
          const pct = (count / maxBar) * 100;
          const isHighlight = i + 1 === highlightRow;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-3 font-mono text-accent">{i + 1}</span>
              <div className="flex-1 h-4 rounded-sm bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                <div
                  className={`h-full rounded-sm ${isHighlight
                    ? "bg-green-500"
                    : "bg-zinc-300 dark:bg-zinc-500"
                    }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="font-bold tabular-nums">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
