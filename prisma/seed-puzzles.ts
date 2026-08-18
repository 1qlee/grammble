import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "../prisma-generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

// --- Config ---
const START_DATE = "2026-08-08"; // First puzzle date (puzzle #1)
const NUM_DAYS = 365; // How many days to seed
const SEED = 42; // PRNG seed for reproducible shuffle

// Two hidden words on the SAME day are "too similar" if one contains the other
// or they match on at least this fraction of positions over the shorter word.
const SIMILARITY_THRESHOLD = 0.6;
// How many candidate answers to try per gram before moving to the next gram.
const MAX_ANSWER_TRIES = 25;

type GameMode = "SIX" | "SEVEN" | "EIGHT";
const MODES: GameMode[] = ["SIX", "SEVEN", "EIGHT"];
type ModeKey = "6" | "7" | "8";
const MODE_KEY: Record<GameMode, ModeKey> = { SIX: "6", SEVEN: "7", EIGHT: "8" };

// Grams that must never be used as a daily puzzle in any mode, regardless of score.
const EXCLUDED_GRAMS = new Set<string>(["AE"]);

// --- Prisma ---
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// --- Load data ---
const assetsDir = resolve(import.meta.dirname, "../src/assets");
const dataDir = resolve(import.meta.dirname, "./data");

const answerPools: Record<GameMode, string[]> = {
  SIX: JSON.parse(
    readFileSync(resolve(assetsDir, "final-6-word-list.json"), "utf-8"),
  ),
  SEVEN: JSON.parse(
    readFileSync(resolve(assetsDir, "final-7-word-list.json"), "utf-8"),
  ),
  EIGHT: JSON.parse(
    readFileSync(resolve(assetsDir, "final-8-word-list.json"), "utf-8"),
  ),
};

type Difficulty = "EASY" | "MEDIUM" | "HARD";
type ModeEntry = { count: number; difficulty: Difficulty };
// gram -> per-mode entry (a mode key is present only when the gram is valid there).
const gramScores: Record<string, Partial<Record<ModeKey, ModeEntry>>> =
  JSON.parse(readFileSync(resolve(dataDir, "gram-scores.json"), "utf-8"));

// --- Seeded PRNG (mulberry32) ---
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(array: T[], rng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// --- Similarity between two same-day hidden words ---
function tooSimilar(a: string, b: string): boolean {
  if (a.includes(b) || b.includes(a)) return true;
  const min = Math.min(a.length, b.length);
  let matches = 0;
  for (let i = 0; i < min; i++) if (a[i] === b[i]) matches++;
  return matches / min >= SIMILARITY_THRESHOLD;
}

// --- Per-mode gram -> candidate answers index ---
// For each mode, map every gram that is valid IN THAT MODE to the answers
// containing it. A gram is only a candidate for a mode if gramScores[gram][mode].
function buildGramIndex(): Record<GameMode, Map<string, string[]>> {
  const idx: Record<GameMode, Map<string, string[]>> = {
    SIX: new Map(),
    SEVEN: new Map(),
    EIGHT: new Map(),
  };
  for (const mode of MODES) {
    const key = MODE_KEY[mode];
    for (const word of answerPools[mode]) {
      const seen = new Set<string>();
      for (let i = 0; i < word.length - 1; i++) {
        const letters = word.substring(i, i + 2);
        if (seen.has(letters)) continue;
        seen.add(letters);
        if (EXCLUDED_GRAMS.has(letters)) continue;
        if (gramScores[letters]?.[key] == null) continue;
        let list = idx[mode].get(letters);
        if (list == null) {
          list = [];
          idx[mode].set(letters, list);
        }
        list.push(word);
      }
    }
  }
  return idx;
}

const difficultyRank: Record<Difficulty, number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
};

// Per-mode usage state, used to keep the daily combination fresh: prefer grams
// never used in this mode, then least-recently-used.
type ModeUsage = Map<string, { timesUsed: number; lastDate: string | null }>;

// Pick a gram + answer for one mode: closest to the target difficulty, then
// freshest (unused first, then oldest), avoiding grams already chosen for other
// modes today and answers too similar to the day's other answers.
function selectForMode(
  mode: GameMode,
  target: Difficulty,
  gramIndex: Map<string, string[]>,
  usage: ModeUsage,
  excludeGrams: Set<string>,
  chosenAnswers: string[],
  usedWords: Set<string>,
  rng: () => number,
): { gram: string; answer: string; entry: ModeEntry } | null {
  const key = MODE_KEY[mode];
  const targetRank = difficultyRank[target];

  // Shuffle first so equally-ranked grams break ties randomly (but reproducibly).
  const ranked = shuffle([...gramIndex.keys()], rng)
    .filter((g) => !excludeGrams.has(g))
    .sort((a, b) => {
      const ea = gramScores[a]![key]!;
      const eb = gramScores[b]![key]!;
      const distA = Math.abs(difficultyRank[ea.difficulty] - targetRank);
      const distB = Math.abs(difficultyRank[eb.difficulty] - targetRank);
      if (distA !== distB) return distA - distB;

      const ua = usage.get(a);
      const ub = usage.get(b);
      const tA = ua?.timesUsed ?? 0;
      const tB = ub?.timesUsed ?? 0;
      if (tA === 0 && tB > 0) return -1;
      if (tB === 0 && tA > 0) return 1;
      if (tA > 0 && tB > 0) {
        const dA = ua?.lastDate ?? "";
        const dB = ub?.lastDate ?? "";
        if (dA !== dB) return dA < dB ? -1 : 1;
      }
      return 0;
    });

  for (const gram of ranked) {
    const answers = shuffle(
      gramIndex.get(gram)!.filter((w) => !usedWords.has(w)),
      rng,
    ).slice(0, MAX_ANSWER_TRIES);
    for (const answer of answers) {
      if (chosenAnswers.some((other) => tooSimilar(answer, other))) continue;
      return { gram, answer, entry: gramScores[gram]![key]! };
    }
  }
  return null;
}

// --- Main ---
async function main() {
  const rng = mulberry32(SEED);

  // Global gram registry usage (across modes) for the Gram rows.
  const gramUsage = new Map<
    string,
    { timesUsed: number; lastDate: string | null }
  >();
  // Per-mode usage, for freshness of the daily combination.
  const modeUsage: Record<GameMode, ModeUsage> = {
    SIX: new Map(),
    SEVEN: new Map(),
    EIGHT: new Map(),
  };

  const existingGrams = await prisma.gram.findMany();
  for (const g of existingGrams) {
    gramUsage.set(g.letters, { timesUsed: g.timesUsed, lastDate: g.lastUsedDate });
  }

  const usedWords = new Set<string>();
  const existingPuzzles = await prisma.puzzle.findMany({
    select: { date: true, number: true, word: true, mode: true, gram: true },
  });
  for (const p of existingPuzzles) {
    usedWords.add(p.word);
    const u = modeUsage[p.mode as GameMode];
    const prev = u.get(p.gram.letters);
    u.set(p.gram.letters, {
      timesUsed: (prev?.timesUsed ?? 0) + 1,
      lastDate:
        prev?.lastDate && prev.lastDate > p.date ? prev.lastDate : p.date,
    });
  }
  const existingDates = new Set(existingPuzzles.map((p) => p.date));
  let nextNumber =
    existingPuzzles.reduce((max, p) => (p.number > max ? p.number : max), 0) + 1;

  const gramIndex = buildGramIndex();
  console.log(
    `Valid grams per mode -- 6:${gramIndex.SIX.size}  7:${gramIndex.SEVEN.size}  8:${gramIndex.EIGHT.size}`,
  );

  // Dates
  const startDate = new Date(START_DATE + "T00:00:00Z");
  const dates: string[] = [];
  for (let i = 0; i < NUM_DAYS; i++) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  // UTC day-of-week (0=Sun..6=Sat) -> target difficulty (applied per mode)
  const difficultySchedule: Difficulty[] = [
    "HARD", // Sun
    "EASY", // Mon
    "EASY", // Tue
    "MEDIUM", // Wed
    "MEDIUM", // Thu
    "MEDIUM", // Fri
    "HARD", // Sat
  ];

  let created = 0;
  let skipped = 0;
  const scheduleHits = { EASY: 0, MEDIUM: 0, HARD: 0 };
  const scheduleMisses = { EASY: 0, MEDIUM: 0, HARD: 0 };

  for (const date of dates) {
    if (existingDates.has(date)) {
      skipped++;
      continue;
    }

    const target =
      difficultySchedule[new Date(date + "T00:00:00Z").getUTCDay()];

    // Pick a distinct gram + answer for each mode.
    const picks: Record<
      GameMode,
      { gram: string; answer: string; entry: ModeEntry }
    > = {} as never;
    const excludeGrams = new Set<string>();
    const chosenAnswers: string[] = [];
    let ok = true;
    for (const mode of MODES) {
      const pick = selectForMode(
        mode,
        target,
        gramIndex[mode],
        modeUsage[mode],
        excludeGrams,
        chosenAnswers,
        usedWords,
        rng,
      );
      if (pick == null) {
        ok = false;
        break;
      }
      picks[mode] = pick;
      excludeGrams.add(pick.gram); // grams differ across modes within the day
      chosenAnswers.push(pick.answer);
    }

    if (!ok) {
      console.warn(`Could not assemble all 3 modes for ${date}, skipping`);
      continue;
    }

    for (const mode of MODES) {
      const { gram, answer, entry } = picks[mode];
      const gramRecord = await prisma.gram.upsert({
        where: { letters: gram },
        create: {
          letters: gram,
          timesUsed: 1,
          lastUsedDate: date,
        },
        update: {
          timesUsed: { increment: 1 },
          lastUsedDate: date,
        },
      });

      await prisma.puzzle.create({
        data: {
          date,
          number: nextNumber,
          mode,
          gramId: gramRecord.id,
          word: answer,
          difficulty: entry.difficulty,
          guessWordCount: entry.count,
        },
      });

      usedWords.add(answer);
      const prevGlobal = gramUsage.get(gram);
      gramUsage.set(gram, {
        timesUsed: (prevGlobal?.timesUsed ?? 0) + 1,
        lastDate: date,
      });
      const u = modeUsage[mode];
      const prevMode = u.get(gram);
      u.set(gram, {
        timesUsed: (prevMode?.timesUsed ?? 0) + 1,
        lastDate: date,
      });

      if (entry.difficulty === target) scheduleHits[target]++;
      else scheduleMisses[target]++;
    }

    nextNumber++;
    created++;
  }

  console.log(
    `Created ${created} day(s) (${created * MODES.length} puzzles), skipped ${skipped} existing dates`,
  );
  console.log(
    `Unique grams used: ${gramUsage.size}, total gram records: ${await prisma.gram.count()}`,
  );
  console.log(
    `Per-mode difficulty match (hit/total): EASY=${scheduleHits.EASY}/${scheduleHits.EASY + scheduleMisses.EASY}  MEDIUM=${scheduleHits.MEDIUM}/${scheduleHits.MEDIUM + scheduleMisses.MEDIUM}  HARD=${scheduleHits.HARD}/${scheduleHits.HARD + scheduleMisses.HARD}`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
