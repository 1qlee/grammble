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

// Archive (past-puzzle) route per mode, taking a `$date` param. Used to switch
// modes while staying on a loaded archived puzzle's date.
export const MODE_ARCHIVE_ROUTE_BY_MODE: Record<
  GameMode,
  "/six/$date" | "/seven/$date" | "/eight/$date"
> = {
  SIX: "/six/$date",
  SEVEN: "/seven/$date",
  EIGHT: "/eight/$date",
};
