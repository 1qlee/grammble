import { MAX_GUESSES } from "~/utils/game/constants";
import type { LetterFeedback } from "~/utils/game/types";

type ThemeColors = {
  correct: string;
  misplaced: string;
  absent: string;
  empty: string;
  bg: string;
  text: string;
};

// Mirrors the Tailwind classes used by MiniGrid for each theme.
const THEME_COLORS: Record<"light" | "dark", ThemeColors> = {
  light: {
    correct: "#4ade80", // green-400
    misplaced: "#facc15", // yellow-400
    absent: "#d4d4d8", // zinc-300
    empty: "#e4e4e7", // zinc-200
    bg: "#ffffff",
    text: "#18181b", // zinc-900
  },
  dark: {
    correct: "#16a34a", // green-600
    misplaced: "#ca8a04", // yellow-600
    absent: "#71717a", // zinc-500
    empty: "#3f3f46", // zinc-700
    bg: "#18181b", // zinc-900
    text: "#f4f4f5", // zinc-100
  },
};

// High-contrast overrides applied on top of the theme palette when color-blind
// mode is on. Only the feedback fills change (matching the board/keyboard and
// the shared emoji); background, text, absent and empty stay theme-driven.
const COLOR_BLIND_FILLS = {
  correct: "#f5793a",
  misplaced: "#85c0f9",
} as const;

function colorFor(cell: LetterFeedback, colors: ThemeColors): string {
  switch (cell) {
    case "correct":
    case "gramCorrect":
      return colors.correct;
    case "misplaced":
    case "gramMisplaced":
      return colors.misplaced;
    case "absent":
      return colors.absent;
    case "blank":
      // Offset blank tile: a column the slid word left empty.
      return colors.empty;
  }
}

const FONT_FAMILY =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * Renders a shareable result card to a PNG blob: the caption lines (header,
 * score) are baked in above the grid, which uses the same colors as MiniGrid.
 * Drawn directly to canvas (no DOM capture) since it's just text + squares.
 */
export function renderGridImage(
  feedback: LetterFeedback[][],
  wordLength: number,
  theme: "light" | "dark",
  captionLines: string[],
  colorBlind = false,
  scale = 28, // px per cell; higher = crisper
): Promise<Blob | null> {
  const colors: ThemeColors = colorBlind
    ? { ...THEME_COLORS[theme], ...COLOR_BLIND_FILLS }
    : THEME_COLORS[theme];
  const gap = Math.round(scale * 0.14);
  const radius = Math.round(scale * 0.12);
  const pad = Math.round(scale * 0.7);

  const headerFont = `600 ${Math.round(scale * 0.6)}px ${FONT_FAMILY}`;
  const lineHeight = Math.round(scale * 0.9);
  const captionGap = Math.round(scale * 0.5);

  const gridWidth = wordLength * scale + (wordLength - 1) * gap;
  const gridHeight = MAX_GUESSES * scale + (MAX_GUESSES - 1) * gap;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  // Measure caption to size the canvas (measureText works before sizing).
  ctx.font = headerFont;
  const captionWidth = captionLines.reduce(
    (max, line) => Math.max(max, ctx.measureText(line).width),
    0,
  );
  const captionBlock = captionLines.length
    ? captionLines.length * lineHeight + captionGap
    : 0;

  const contentWidth = Math.max(gridWidth, captionWidth);
  const w = contentWidth + pad * 2;
  const h = gridHeight + captionBlock + pad * 2;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  ctx.scale(dpr, dpr);

  // Background.
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);

  // Caption lines.
  ctx.fillStyle = colors.text;
  ctx.font = headerFont;
  ctx.textBaseline = "top";
  captionLines.forEach((line, i) => {
    ctx.fillText(line, pad, pad + i * lineHeight);
  });

  // Grid.
  const gridTop = pad + captionBlock;
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = feedback[r] ?? [];
    for (let c = 0; c < wordLength; c++) {
      const cell = row[c];
      ctx.fillStyle = cell ? colorFor(cell, colors) : colors.empty;
      const x = pad + c * (scale + gap);
      const y = gridTop + r * (scale + gap);
      ctx.beginPath();
      ctx.roundRect(x, y, scale, scale, radius);
      ctx.fill();
    }
  }

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
