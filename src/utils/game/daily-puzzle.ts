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

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Renders a puzzle's `YYYY-MM-DD` date for the scoreboard: "Today" for the
// current daily puzzle, "Jun 24" for another date this year, and "Jun 24, '26"
// when the puzzle is from a different year than today.
export function formatPuzzleDate(date: string): string {
  const today = getDateString();
  if (date === today) return "Today";

  const [year, month, day] = date.split("-").map(Number);
  const label = `${MONTHS[month - 1]} ${day}`;

  const currentYear = Number(today.slice(0, 4));
  return year === currentYear
    ? label
    : `${label}, '${String(year).slice(-2)}`;
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
