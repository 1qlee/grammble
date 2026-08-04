// Staggered timing for the end-game reveal cascade. Each step fires shortly
// after the previous one (top to bottom: score -> tiles -> bars -> lifetime
// stats) without waiting for it to finish, so the animations overlap. Values
// are milliseconds from when the dialog opens.
const STEP = 50;

export const CASCADE = {
  score: { delay: STEP * 0, duration: 1000 },
  clip: { delay: STEP * 1, duration: 550 },
  bars: { delay: STEP * 2, duration: 600 },
  stats: { delay: STEP * 3, duration: 900, stagger: STEP },
} as const;
