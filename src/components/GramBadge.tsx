import type { Difficulty } from "~/utils/game/share";

interface GramBadgeProps {
  gram: string;
  puzzleNumber: number;
  difficulty: Difficulty;
  // Pixel height/width of each letter cell. When omitted, the badge follows the
  // Scoreboard header scale (derived from `--tile-size`). Pass a value (e.g.
  // MAX_TILE_SIZE) to render at a fixed, larger size.
  size?: number;
  // Toggle the difficulty-colored puzzle-number badge in the corner.
  showPuzzleNumber?: boolean;
}

const difficultyBadgeStyles: Record<Difficulty, string> = {
  easy: "bg-green-600 text-green-900 dark:bg-green-600 dark:text-green-100",
  med: "bg-yellow-300 text-yellow-900 dark:bg-yellow-600 dark:text-yellow-100",
  hard: "bg-red-300 text-red-900 dark:bg-red-600 dark:text-red-100",
};

// Self-contained scale vars so the badge renders identically whether it sits in
// the Scoreboard (which sets these on an ancestor) or standalone elsewhere. A
// `size` prop pins `--sb-gram-h` to a fixed value; `--sb-gram-font` derives from
// it either way.
const baseScaleStyle = {
  "--sb-tab-h": "clamp(16px, calc(var(--tile-size, 52px) * 0.54), 30px)",
  "--sb-gram-h": "calc(var(--sb-tab-h) + 6px)",
  "--sb-gram-font": "calc(var(--sb-gram-h) * 0.41)",
} as React.CSSProperties;

// The two-letter gradient pill with an optional difficulty-colored puzzle-number
// badge. Shared by the Scoreboard header and the end-game dialog header.
export default function GramBadge({
  gram,
  puzzleNumber,
  difficulty,
  size,
  showPuzzleNumber = true,
}: GramBadgeProps) {
  const letters = gram.split("");

  const scaleStyle: React.CSSProperties =
    size !== undefined
      ? ({ ...baseScaleStyle, "--sb-gram-h": `${size}px` } as React.CSSProperties)
      : baseScaleStyle;

  return (
    <span
      className="relative grid place-items-center bg-linear-to-b from-zinc-50 to-white text-zinc-900 shadow-[inset_0_-2px_2px_var(--color-zinc-200)] border border-zinc-300 border-t border-t-zinc-200 dark:border-zinc-800 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-100 dark:shadow-[inset_0_-2px_2px_var(--color-zinc-950)]"
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
      {letters.map((l) => (
        <span className="grid place-items-center font-bold" key={l}>
          {l}
        </span>
      ))}
      {showPuzzleNumber && (
        <span
          className={`absolute grid place-items-center rounded-full font-bold leading-none text-white shadow-sm ${difficultyBadgeStyles[difficulty]}`}
          style={{
            top: "calc(var(--sb-gram-h) * -0.18)",
            right: "calc(var(--sb-gram-h) * -0.18)",
            height: "calc(var(--sb-gram-h) * 0.5)",
            width: "calc(var(--sb-gram-h) * 0.5)",
            fontSize: "calc(var(--sb-gram-h) * 0.26)",
          }}
        >
          {puzzleNumber}
        </span>
      )}
    </span>
  );
}
