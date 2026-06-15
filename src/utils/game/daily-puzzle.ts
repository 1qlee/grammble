import type { GameMode } from "./constants";
import { GAME_MODES } from "./constants";

const PUZZLE_TIMEZONE = "America/Los_Angeles";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PUZZLE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getDateString(): string {
  return dateFormatter.format(new Date());
}

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
