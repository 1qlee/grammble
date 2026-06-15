export function SkeletonScoreboard() {
  const scaleStyle = {
    "--sb-px": "calc(8px + (var(--tile-size, 52px) - 36px) * 0.25)",
    "--sb-py": "calc(4px + (var(--tile-size, 52px) - 36px) * 0.15)",
    "--sb-badge": "calc(20px + (var(--tile-size, 52px) - 36px) * 0.4)",
    "--sb-font": "calc(11px + (var(--tile-size, 52px) - 36px) * 0.12)",
  } as React.CSSProperties;

  return (
    <div
      className="select-none flex w-full items-stretch justify-between overflow-hidden rounded-full border border-zinc-200 bg-white whitespace-nowrap inset-shadow-default border-t-zinc-300/80 border-zinc-200/50 dark:border-zinc-700/80 dark:border-t-zinc-500/50 dark:border-zinc-800 dark:bg-zinc-900"
      style={{ ...scaleStyle, fontSize: "var(--sb-font)" }}
      aria-hidden="true"
    >
      <div
        className="flex items-center gap-1.5"
        style={{ padding: "var(--sb-py) var(--sb-px)" }}
      >
        <span className="font-semibold uppercase tracking-wide text-accent">
          No.
        </span>
        <span
          className="skeleton-shimmer rounded-md"
          style={{
            height: "var(--sb-badge)",
            width: "calc(var(--sb-badge) * 1.6)",
          }}
        />
      </div>
      <div
        className="flex items-center gap-1.5 border-l border-r border-zinc-200 dark:border-zinc-800"
        style={{ padding: "var(--sb-py) var(--sb-px)" }}
      >
        <span className="font-semibold uppercase tracking-wide text-accent">
          Gram:
        </span>
        <span
          className="skeleton-shimmer rounded-md"
          style={{
            height: "var(--sb-badge)",
            width: "calc(var(--sb-badge) * 2)",
          }}
        />
      </div>
      <div
        className="flex items-center gap-1.5"
        style={{ padding: "var(--sb-py) var(--sb-px)" }}
      >
        <span
          className="skeleton-shimmer rounded-md"
          style={{
            height: "var(--sb-badge)",
            width: "calc(var(--sb-badge) * 3)",
          }}
        />
      </div>
    </div>
  );
}
