import { MAX_GUESSES } from "~/utils/game/constants";

export type Stats = {
  played: number;
  wins: number;
  losses: number;
  currentStreak: number;
  maxStreak: number;
  distribution: number[];
  lastPuzzleNumber: number | null;
  totalScore: number;
  bestScore: number;
};

export const EMPTY_STATS: Stats = {
  played: 0,
  wins: 0,
  losses: 0,
  currentStreak: 0,
  maxStreak: 0,
  distribution: Array(MAX_GUESSES).fill(0),
  lastPuzzleNumber: null,
  totalScore: 0,
  bestScore: 0,
};

export function applyTerminalToStats(
  prev: Stats,
  outcome: "WON" | "LOST",
  guessCount: number,
  puzzleNumber: number,
  score: number,
): Stats {
  if (prev.lastPuzzleNumber === puzzleNumber) return prev;

  const won = outcome === "WON";
  const continued = prev.lastPuzzleNumber === puzzleNumber - 1;

  const currentStreak = won ? (continued ? prev.currentStreak + 1 : 1) : 0;
  const maxStreak = Math.max(prev.maxStreak, currentStreak);

  const distribution = [...prev.distribution];
  if (won && guessCount >= 1 && guessCount <= MAX_GUESSES) {
    distribution[guessCount - 1] += 1;
  }

  return {
    played: prev.played + 1,
    wins: prev.wins + (won ? 1 : 0),
    losses: prev.losses + (won ? 0 : 1),
    currentStreak,
    maxStreak,
    distribution,
    lastPuzzleNumber: puzzleNumber,
    totalScore: prev.totalScore + score,
    bestScore: Math.max(prev.bestScore, score),
  };
}

// Fold a completed archive replay into lifetime stats. Unlike
// applyTerminalToStats, this deliberately leaves all streak state untouched
// (currentStreak, maxStreak, lastPuzzleNumber): those are sequential by daily
// puzzle number, so an older replayed puzzle would corrupt them. Everything
// else (played, wins/losses, distribution, scores) counts. There is no
// double-count guard here; the caller guarantees each puzzle folds in once (a
// GameSession transitions to terminal exactly once).
export function applyArchiveToStats(
  prev: Stats,
  outcome: "WON" | "LOST",
  guessCount: number,
  score: number,
): Stats {
  const won = outcome === "WON";
  const distribution = [...prev.distribution];
  if (won && guessCount >= 1 && guessCount <= MAX_GUESSES) {
    distribution[guessCount - 1] += 1;
  }
  return {
    ...prev,
    played: prev.played + 1,
    wins: prev.wins + (won ? 1 : 0),
    losses: prev.losses + (won ? 0 : 1),
    distribution,
    totalScore: prev.totalScore + score,
    bestScore: Math.max(prev.bestScore, score),
  };
}

// Best-effort reverse of applyTerminalToStats: reconstruct the stats as they
// were before the just-finished game so the end-game odometers can count up
// from the player's prior values. Returns null when there is no prior game to
// animate from (first play, or this game has not been folded into `stats` yet).
// bestScore is unknowable when this game set or tied the record, so it is left
// unchanged; maxStreak uses a heuristic that is exact during an active best run.
export function derivePreviousStats(
  stats: Stats,
  outcome: "WON" | "LOST",
  guessCount: number,
  puzzleNumber: number,
  score: number,
): Stats | null {
  if (stats.lastPuzzleNumber !== puzzleNumber) return null;
  if (stats.played <= 1) return null;

  const won = outcome === "WON";
  const distribution = [...stats.distribution];
  if (won && guessCount >= 1 && guessCount <= distribution.length) {
    distribution[guessCount - 1] = Math.max(0, distribution[guessCount - 1] - 1);
  }

  const currentStreak = won
    ? Math.max(0, stats.currentStreak - 1)
    : stats.currentStreak;
  const maxStreak =
    won && stats.currentStreak === stats.maxStreak && stats.maxStreak > 0
      ? stats.maxStreak - 1
      : stats.maxStreak;

  return {
    played: stats.played - 1,
    wins: stats.wins - (won ? 1 : 0),
    losses: stats.losses - (won ? 0 : 1),
    currentStreak,
    maxStreak,
    distribution,
    lastPuzzleNumber: null,
    totalScore: stats.totalScore - score,
    bestScore: stats.bestScore,
  };
}
