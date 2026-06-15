interface VerticalLabelProps {
  children: React.ReactNode;
  className?: string;
}

// Sideways uppercase label rendered to the left of the gram tiles / mode tabs.
// Reads bottom-to-top. Font size scales with `--sb-gram-label-font` when
// provided, defaulting to 7px.
export default function VerticalLabel({
  children,
  className = "",
}: VerticalLabelProps) {
  return (
    <span
      className={`inline-flex items-center justify-center font-semibold uppercase leading-none tracking-wider text-zinc-400 dark:text-zinc-500 ${className}`}
      style={{
        fontSize: "var(--sb-gram-label-font, 7px)",
        writingMode: "vertical-rl",
        transform: "rotate(180deg)",
      }}
    >
      {children}
    </span>
  );
}
