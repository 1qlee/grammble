interface GramBadgeProps {
  gram: string;
  // Pixel height/width of each letter cell. When omitted, the badge follows the
  // Scoreboard header scale (derived from `--tile-size`). Pass a value (e.g.
  // MAX_TILE_SIZE) to render at a fixed, larger size.
  size?: number;
}

// Self-contained scale vars so the badge renders identically whether it sits in
// the Scoreboard (which sets these on an ancestor) or standalone elsewhere. A
// `size` prop pins `--sb-gram-h` to a fixed value; `--sb-gram-font` derives from
// it either way.
const baseScaleStyle = {
  "--sb-tab-h": "clamp(16px, calc(var(--tile-size, 52px) * 0.54), 30px)",
  "--sb-gram-h": "calc(var(--sb-tab-h) + 6px)",
  "--sb-gram-font": "calc(var(--sb-gram-h) * 0.41)",
} as React.CSSProperties;

// The two-letter gradient pill. Shared by the Scoreboard header and the
// end-game dialog header.
export default function GramBadge({ gram, size }: GramBadgeProps) {
  const letters = gram.split("");

  const scaleStyle: React.CSSProperties =
    size !== undefined
      ? ({ ...baseScaleStyle, "--sb-gram-h": `${size}px` } as React.CSSProperties)
      : baseScaleStyle;

  return (
    <span
      className="surface-raised relative grid place-items-center"
      style={{
        ...scaleStyle,
        fontSize: "var(--sb-gram-font)",
        height: "var(--sb-gram-h)",
        gridTemplateColumns: "var(--sb-gram-h) var(--sb-gram-h)",
        gap: "var(--tile-gap, 2px)",
        borderRadius:
          "calc(var(--sb-gram-h) * 0.308) / calc(var(--sb-gram-h) * 0.231)",
      }}
    >
      {letters.map((l, i) => (
        <span className="grid place-items-center font-bold" key={i}>
          {l}
        </span>
      ))}
    </span>
  );
}
