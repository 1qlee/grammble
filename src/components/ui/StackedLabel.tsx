interface StackedLabelProps {
  children: React.ReactNode;
  className?: string;
}

// Small uppercase caption rendered above the gram tiles / mode tabs. Font size
// scales with `--sb-gram-label-font` when provided, defaulting to 7px.
export default function StackedLabel({
  children,
  className = "",
}: StackedLabelProps) {
  return (
    <span
      className={`inline-flex items-center justify-center font-semibold uppercase leading-none tracking-wider ${className}`}
      style={{ fontSize: "var(--sb-gram-label-font, 7px)" }}
    >
      {children}
    </span>
  );
}
