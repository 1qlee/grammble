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
