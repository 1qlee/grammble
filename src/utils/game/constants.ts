export type GameMode = "SIX" | "SEVEN" | "EIGHT";

export const GAME_MODES: GameMode[] = ["SIX", "SEVEN", "EIGHT"];
export const DEFAULT_GAME_MODE: GameMode = "SIX";

export const WORD_LENGTH_BY_MODE: Record<GameMode, number> = {
  SIX: 6,
  SEVEN: 7,
  EIGHT: 8,
};

export const GUESS_MIN_LENGTH_BY_MODE: Record<GameMode, number> = {
  SIX: 4,
  SEVEN: 4,
  EIGHT: 4,
};

export const GUESS_MAX_LENGTH_BY_MODE: Record<GameMode, number> = {
  SIX: 6,
  SEVEN: 7,
  EIGHT: 8,
};

export const MAX_GUESSES = 6;
export const MIN_GUESS_LENGTH = 4;
export const GRAM_LENGTH = 2;

// Legacy alias for default mode (6-letter)
export const WORD_LENGTH = WORD_LENGTH_BY_MODE[DEFAULT_GAME_MODE];

// Each mode is a first-class route. Use this for type-safe navigate/Link targets.
export const MODE_ROUTE_BY_MODE: Record<GameMode, "/six" | "/seven" | "/eight"> = {
  SIX: "/six",
  SEVEN: "/seven",
  EIGHT: "/eight",
};

export const TILE_POP_PEAK_DURATION_MS = 200;
export const TILE_POP_PEAK_SCALE = 1.1;
export const TILE_POP_SPRING_BOUNCE = 0.7;
