import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "../prisma-generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

// --- Config ---
const START_DATE = "2026-04-23"; // First puzzle date
const NUM_DAYS = 365; // How many days to seed
const SEED = 42; // PRNG seed for reproducible shuffle

// Two hidden words are "too similar" if one contains the other (e.g. ACCUSE /
// ACCUSER) or if they match on at least this fraction of positions over the
// shorter word's length.
const SIMILARITY_THRESHOLD = 0.6;
// How many distinct 6-letter candidates to try before giving up on a gram.
const MAX_SIX_TRIES = 25;

type GameMode = "SIX" | "SEVEN" | "EIGHT";
const MODES: GameMode[] = ["SIX", "SEVEN", "EIGHT"];

// --- Prisma ---
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// --- Load data ---
const scriptsDir = resolve(import.meta.dirname, "../scripts");

const answerPools: Record<GameMode, string[]> = {
  SIX: JSON.parse(
    readFileSync(resolve(scriptsDir, "final-6-word-list.json"), "utf-8"),
  ),
  SEVEN: JSON.parse(
    readFileSync(resolve(scriptsDir, "final-7-word-list.json"), "utf-8"),
  ),
  EIGHT: JSON.parse(
    readFileSync(resolve(scriptsDir, "final-8-word-list.json"), "utf-8"),
  ),
};

type Difficulty = "EASY" | "MEDIUM" | "HARD";
const gramScores: Record<
  string,
  { score: number; count: number; difficulty: Difficulty }
> = JSON.parse(readFileSync(resolve(scriptsDir, "gram-scores.json"), "utf-8"));

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

// --- Similarity check between two hidden words ---
function tooSimilar(a: string, b: string): boolean {
  // Containment covers prefix/suffix cases like ACCUSE / ACCUSER.
  if (a.includes(b) || b.includes(a)) return true;
  const min = Math.min(a.length, b.length);
  let matches = 0;
  for (let i = 0; i < min; i++) {
    if (a[i] === b[i]) matches++;
  }
  return matches / min >= SIMILARITY_THRESHOLD;
}

// --- Build gram -> per-mode candidate answers ---
// Only grams that appear in gram-scores are considered, and a gram is only
// usable for a day if it has at least one answer in every mode's pool.
function buildGramIndex(): Map<string, Record<GameMode, string[]>> {
  const idx = new Map<string, Record<GameMode, string[]>>();
  for (const mode of MODES) {
    for (const word of answerPools[mode]) {
      const seen = new Set<string>();
      for (let i = 0; i < word.length - 1; i++) {
        const letters = word.substring(i, i + 2);
        if (seen.has(letters)) continue;
        seen.add(letters);
        if (gramScores[letters] == null) continue;
        let entry = idx.get(letters);
        if (entry == null) {
          entry = { SIX: [], SEVEN: [], EIGHT: [] };
          idx.set(letters, entry);
        }
        entry[mode].push(word);
      }
    }
  }
  return idx;
}

// --- Select a non-similar 6/7/8 word triple for a gram ---
function selectTriple(
  cands: Record<GameMode, string[]>,
  usedWords: Set<string>,
  rng: () => number,
): Record<GameMode, string> | null {
  const sixList = shuffle(
    cands.SIX.filter((w) => !usedWords.has(w)),
    rng,
  );
  const sevenList = shuffle(
    cands.SEVEN.filter((w) => !usedWords.has(w)),
    rng,
  );
  const eightList = shuffle(
    cands.EIGHT.filter((w) => !usedWords.has(w)),
    rng,
  );

  for (const six of sixList.slice(0, MAX_SIX_TRIES)) {
    for (const seven of sevenList) {
      if (tooSimilar(six, seven)) continue;
      for (const eight of eightList) {
        if (tooSimilar(six, eight) || tooSimilar(seven, eight)) continue;
        return { SIX: six, SEVEN: seven, EIGHT: eight };
      }
    }
  }
  return null;
}

// --- Main ---
async function main() {
  const rng = mulberry32(SEED);

  // Track gram usage state during seeding
  const gramUsage = new Map<
    string,
    { timesUsed: number; lastDate: string | null }
  >();
  const existingGrams = await prisma.gram.findMany();
  for (const g of existingGrams) {
    gramUsage.set(g.letters, {
      timesUsed: g.timesUsed,
      lastDate: g.lastUsedDate,
    });
  }

  // Answers already used by existing puzzles must not be reused.
  const usedWords = new Set<string>();
  const existingPuzzles = await prisma.puzzle.findMany({
    select: { date: true, number: true, word: true },
  });
  for (const p of existingPuzzles) usedWords.add(p.word);
  const existingDates = new Set(existingPuzzles.map((p) => p.date));
  let nextNumber =
    existingPuzzles.reduce((max, p) => (p.number > max ? p.number : max), 0) + 1;

  // Build the gram index and keep only grams usable across all three modes.
  const gramIndex = buildGramIndex();
  const usableGrams = [...gramIndex.keys()].filter((g) => {
    const c = gramIndex.get(g)!;
    return c.SIX.length > 0 && c.SEVEN.length > 0 && c.EIGHT.length > 0;
  });
  console.log(
    `Grams: ${gramIndex.size} scored, ${usableGrams.length} usable across all 3 modes`,
  );

  // Generate dates
  const startDate = new Date(START_DATE + "T00:00:00Z");
  const dates: string[] = [];
  for (let i = 0; i < NUM_DAYS; i++) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  // UTC day-of-week (0=Sun..6=Sat) -> target difficulty
  const difficultySchedule: Difficulty[] = [
    "HARD", // Sun
    "EASY", // Mon
    "EASY", // Tue
    "MEDIUM", // Wed
    "MEDIUM", // Thu
    "MEDIUM", // Fri
    "HARD", // Sat
  ];
  const difficultyRank: Record<Difficulty, number> = {
    EASY: 0,
    MEDIUM: 1,
    HARD: 2,
  };

  let created = 0;
  let skipped = 0;
  const scheduleHits = { EASY: 0, MEDIUM: 0, HARD: 0 };
  const scheduleMisses = { EASY: 0, MEDIUM: 0, HARD: 0 };

  for (const date of dates) {
    if (existingDates.has(date)) {
      skipped++;
      continue;
    }

    const targetDifficulty =
      difficultySchedule[new Date(date + "T00:00:00Z").getUTCDay()];
    const targetRank = difficultyRank[targetDifficulty];

    // Rank usable grams: closeness to target difficulty, then prefer unused,
    // then least-recently-used, then highest score (most guess words).
    const ranked = [...usableGrams].sort((a, b) => {
      const ea = gramScores[a];
      const eb = gramScores[b];
      const distA = Math.abs(difficultyRank[ea.difficulty] - targetRank);
      const distB = Math.abs(difficultyRank[eb.difficulty] - targetRank);
      if (distA !== distB) return distA - distB;

      const usageA = gramUsage.get(a);
      const usageB = gramUsage.get(b);
      const timesA = usageA?.timesUsed ?? 0;
      const timesB = usageB?.timesUsed ?? 0;
      if (timesA === 0 && timesB > 0) return -1;
      if (timesB === 0 && timesA > 0) return 1;
      if (timesA > 0 && timesB > 0) {
        const dateA = usageA?.lastDate ?? "";
        const dateB = usageB?.lastDate ?? "";
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;
      }
      return eb.score - ea.score;
    });

    // Walk ranked grams until one yields a valid (non-similar, unused) triple.
    let chosenGram: string | null = null;
    let triple: Record<GameMode, string> | null = null;
    for (const gram of ranked) {
      const t = selectTriple(gramIndex.get(gram)!, usedWords, rng);
      if (t != null) {
        chosenGram = gram;
        triple = t;
        break;
      }
    }

    if (chosenGram == null || triple == null) {
      console.warn(`No gram could produce a triple for ${date}, skipping`);
      continue;
    }

    const gramEntry = gramScores[chosenGram];
    if (gramEntry.difficulty === targetDifficulty) {
      scheduleHits[targetDifficulty]++;
    } else {
      scheduleMisses[targetDifficulty]++;
    }

    // Upsert the shared Gram record once for the day.
    const gramRecord = await prisma.gram.upsert({
      where: { letters: chosenGram },
      create: {
        letters: chosenGram,
        guessWordCount: gramEntry.count,
        score: gramEntry.score,
        difficulty: gramEntry.difficulty,
        timesUsed: 1,
        lastUsedDate: date,
      },
      update: {
        timesUsed: { increment: 1 },
        lastUsedDate: date,
      },
    });

    const prev = gramUsage.get(chosenGram);
    gramUsage.set(chosenGram, {
      timesUsed: (prev?.timesUsed ?? 0) + 1,
      lastDate: date,
    });

    // Create one puzzle per mode, sharing the day's number and gram.
    for (const mode of MODES) {
      const word = triple[mode];
      usedWords.add(word);
      await prisma.puzzle.create({
        data: {
          date,
          number: nextNumber,
          mode,
          gramId: gramRecord.id,
          word,
        },
      });
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
    `Schedule hits  — EASY=${scheduleHits.EASY}  MEDIUM=${scheduleHits.MEDIUM}  HARD=${scheduleHits.HARD}`,
  );
  console.log(
    `Schedule misses — EASY=${scheduleMisses.EASY}  MEDIUM=${scheduleMisses.MEDIUM}  HARD=${scheduleMisses.HARD}`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
