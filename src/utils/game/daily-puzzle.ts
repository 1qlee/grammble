// Client-safe daily-puzzle helpers only. Server-only puzzle lookups (which touch
// Prisma) live in daily-puzzle-db.ts so this module can be imported by client
// components without pulling the Prisma client into the browser bundle.

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
