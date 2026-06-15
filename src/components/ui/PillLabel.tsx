interface PillLabelProps {
  children: React.ReactNode;
  className?: string;
}

// Small uppercase pill that floats centered over the top edge of its
// relatively-positioned parent (e.g. the gram tiles or the mode tabs). Font
// size scales with `--sb-gram-label-font` when provided, defaulting to 7px.
export default function PillLabel({ children, className = "" }: PillLabelProps) {
  return (
    <span
      className={`absolute top-0 left-1/2 z-10 inline-flex -translate-x-1/2 -translate-y-[66%] items-center rounded-full border border-zinc-200 bg-zinc-50 font-semibold uppercase leading-none tracking-wider text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 ${className}`}
      style={{
        fontSize: "var(--sb-gram-label-font, 7px)",
        padding:
          "calc(var(--sb-gram-label-font, 7px) * 0.35) calc(var(--sb-gram-label-font, 7px) * 0.75)",
      }}
    >
      {children}
    </span>
  );
}
