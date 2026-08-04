import type { ArchiveDayStatus } from "~/trpc/router";

// Shared status color language for the game-state surfaces: neutral = open /
// unplayed, yellow = in progress, green = won, red = lost. Used by the archive
// calendar cells and the mode tabs so all three read the same way. Full class
// literals so Tailwind's scanner emits the rules (it can't see concatenations).

// Base raised surface per status.
export const STATUS_SURFACE: Record<ArchiveDayStatus, string> = {
  OPEN: "surface-raised",
  IN_PROGRESS: "surface-yellow",
  WON: "surface-green",
  LOST: "surface-red",
};

// Recessed companion applied while the element is active/selected, in the
// matching color family plus the neutral selection ring (see app.css).
export const STATUS_SELECTED: Record<ArchiveDayStatus, string> = {
  OPEN: "surface-raised-selected",
  IN_PROGRESS: "surface-yellow-selected",
  WON: "surface-green-selected",
  LOST: "surface-red-selected",
};

// Selected border: same color family as the surface fill, a soft light tint in
// light mode (~200) and a deep shade in dark mode (~900). The `!` wins over the
// border color the surface-* utilities set.
export const STATUS_BORDER: Record<ArchiveDayStatus, string> = {
  OPEN: "border-zinc-200! dark:border-zinc-900!",
  IN_PROGRESS: "border-yellow-200! dark:border-yellow-900!",
  WON: "border-green-200! dark:border-green-900!",
  LOST: "border-red-200! dark:border-red-900!",
};
