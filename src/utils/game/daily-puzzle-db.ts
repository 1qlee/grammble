import type { GameMode } from "./constants";
import { GAME_MODES } from "./constants";

// Server-only puzzle lookups. Kept in a separate module from the client-safe
// date helpers in daily-puzzle.ts: these reference Prisma (via dynamic import),
// so co-locating them with helpers imported by client components would drag the
// Prisma client and pg driver into the browser bundle (and break the client
// build). Only server code (trpc/router.ts) imports this file.

export async function getDailyPuzzle(date: string, mode: GameMode) {
  const { prismaClient } = await import("~/utils/db/prisma");

  const puzzle = await prismaClient.puzzle.findUnique({
    where: { date_mode: { date, mode } },
    include: { gram: true },
  });

  if (!puzzle) {
    throw new Error(`No puzzle found for date ${date} mode ${mode}`);
  }

  return puzzle;
}

export async function getAllDailyPuzzles(date: string) {
  const { prismaClient } = await import("~/utils/db/prisma");

  const puzzles = await prismaClient.puzzle.findMany({
    where: { date },
    include: { gram: true },
  });

  const byMode = new Map(puzzles.map((p) => [p.mode, p]));
  for (const mode of GAME_MODES) {
    if (!byMode.has(mode)) {
      throw new Error(`No puzzle found for date ${date} mode ${mode}`);
    }
  }
  return byMode as Map<GameMode, (typeof puzzles)[number]>;
}
