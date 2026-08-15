import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// Grams are scored PER MODE. Each daily puzzle (6/7/8) now picks its own gram, so
// a gram's quality is measured independently for each mode against that mode's own
// answer pool and guess list -- a gram can be EASY in the 6-letter mode and
// invalid in the 8-letter mode.
//
// A word counts as a VIABLE guess for a mode only if it is:
//   1. Exactly the mode's length (gameplay charges for short guesses, so only
//      full-length words are realistically played -- see src/utils/game/score.ts).
//   2. Common enough -- Zipf frequency >= FREQ_THRESHOLD (drops obscure entries
//      like THERMS, SEDUMS).
//   3. Not a regular plural / 3rd-person-singular -- a common stem + "S" (CLAIMS,
//      SYSTEMS) is a cheap, never-the-answer guess that does not reflect genuine
//      vocabulary for the gram.
//   4. Not a proper noun -- names like SYDNEY, RODNEY, SIDNEY are recognizable
//      but are not vocabulary a player reaches for. Without this filter a gram
//      like DN scrapes past the supply floor on names (SYDNEY/SIDNEY/RODNEY)
//      while only KIDNEY / KIDNAP are real words. The excluded set is precomputed
//      in scripts/proper-nouns.json (generate-proper-nouns.py).
//
// A gram is valid for a mode when its viable count in that mode >= MIN_SUPPLY.
// Difficulty is the tercile of viable supply WITHIN that mode's own distribution.
// Frequencies come from scripts/word-frequencies.json (generate-word-frequencies.py).

const GRAM_LENGTH = 2;
const MODES = [6, 7, 8] as const;
type Mode = (typeof MODES)[number];

const FREQ_THRESHOLD = 3.3;
// Minimum count of clean (proper-noun-filtered) viable words for a gram to be
// valid in a mode. Raised from 5 once proper nouns were excluded: DN drops to 2
// real words (KIDNEY, KIDNAP), DW to 1 (MIDWAY), while word-rich grams keep 100+.
// Verified to strand zero answer words in every mode.
const MIN_SUPPLY = 7;

// Mode 6 (the shortest word) is the baseline test of whether a gram has genuine
// common vocabulary: longer words have more positions and pull in more obscure
// derived forms, so a gram weak at 6 letters can scrape past MIN_SUPPLY at 7/8 on
// marginal words (e.g. MS: 4 at six, 5 at seven). To prevent that, a gram that is
// INVALID in mode 6 may only be valid in a longer mode if it shows a STRONG
// supply there -- a genuine improvement, not a one-word squeak over the line.
const STRONG_SUPPLY = 15;

const scriptsDir = resolve(import.meta.dirname, "../scripts");
const assetsDir = resolve(import.meta.dirname, "../src/assets");

const answerFiles: Record<Mode, string> = {
  6: resolve(scriptsDir, "final-6-word-list.json"),
  7: resolve(scriptsDir, "final-7-word-list.json"),
  8: resolve(scriptsDir, "final-8-word-list.json"),
};
const guessFiles: Record<Mode, string> = {
  6: resolve(assetsDir, "six-guess-list.json"),
  7: resolve(assetsDir, "seven-guess-list.json"),
  8: resolve(assetsDir, "eight-guess-list.json"),
};

const loadUpper = (file: string): string[] =>
  (JSON.parse(readFileSync(file, "utf-8")) as string[]).map((w) =>
    w.toUpperCase(),
  );

const frequencies: Record<string, number> = JSON.parse(
  readFileSync(resolve(scriptsDir, "word-frequencies.json"), "utf-8"),
);
const dictionary = new Set(loadUpper(resolve(scriptsDir, "whitelist.json")));
const properNouns = new Set(
  loadUpper(resolve(scriptsDir, "proper-nouns.json")),
);

const answerWords: Record<Mode, string[]> = {
  6: loadUpper(answerFiles[6]),
  7: loadUpper(answerFiles[7]),
  8: loadUpper(answerFiles[8]),
};
const guessWords: Record<Mode, string[]> = {
  6: loadUpper(guessFiles[6]).filter((w) => w.length === 6),
  7: loadUpper(guessFiles[7]).filter((w) => w.length === 7),
  8: loadUpper(guessFiles[8]).filter((w) => w.length === 8),
};

function isRegularPlural(word: string): boolean {
  if (!word.endsWith("S")) return false;
  if (dictionary.has(word.slice(0, -1))) return true;
  if (word.endsWith("ES") && dictionary.has(word.slice(0, -2))) return true;
  return false;
}

function isViable(word: string): boolean {
  return (
    (frequencies[word] ?? 0) >= FREQ_THRESHOLD &&
    !isRegularPlural(word) &&
    !properNouns.has(word)
  );
}

function answerGrams(words: string[]): Set<string> {
  const set = new Set<string>();
  for (const word of words) {
    for (let i = 0; i <= word.length - GRAM_LENGTH; i++) {
      set.add(word.substring(i, i + GRAM_LENGTH));
    }
  }
  return set;
}

const countCache = new Map<string, number>();
function viableCount(gram: string, mode: Mode): number {
  const cacheKey = `${mode}:${gram}`;
  const cached = countCache.get(cacheKey);
  if (cached !== undefined) return cached;
  let count = 0;
  for (const word of guessWords[mode]) {
    if (word.includes(gram) && isViable(word)) count++;
  }
  countCache.set(cacheKey, count);
  return count;
}

// A gram qualifies for a mode if it clears MIN_SUPPLY there AND, for the longer
// modes, either it is already valid in the mode-6 baseline or it clears the
// STRONG_SUPPLY bar in this mode. See STRONG_SUPPLY above.
function isValidFor(gram: string, mode: Mode): boolean {
  const count = viableCount(gram, mode);
  if (count < MIN_SUPPLY) return false;
  if (mode === 6) return true;
  return viableCount(gram, 6) >= MIN_SUPPLY || count >= STRONG_SUPPLY;
}

type Difficulty = "EASY" | "MEDIUM" | "HARD";
type ModeEntry = { count: number; difficulty: Difficulty };
// gram -> { "6": ModeEntry, "7": ModeEntry, "8": ModeEntry }, only for modes the
// gram is valid in.
const gramScores: Record<string, Partial<Record<Mode, ModeEntry>>> = {};
const perModeSummary: Record<
  Mode,
  { valid: number; easy: number; medium: number; hard: number; p33: number; p67: number }
> = {} as never;

for (const mode of MODES) {
  const candidates = [...answerGrams(answerWords[mode])];
  const valid = candidates.filter((g) => isValidFor(g, mode));
  const supplyAsc = valid.map((g) => viableCount(g, mode)).sort((a, b) => a - b);
  const p33 = supplyAsc[Math.floor(supplyAsc.length / 3)];
  const p67 = supplyAsc[Math.floor((2 * supplyAsc.length) / 3)];
  const bucketFor = (c: number): Difficulty =>
    c >= p67 ? "EASY" : c >= p33 ? "MEDIUM" : "HARD";

  const summary = { valid: valid.length, easy: 0, medium: 0, hard: 0, p33, p67 };
  for (const gram of valid) {
    const count = viableCount(gram, mode);
    const difficulty = bucketFor(count);
    if (difficulty === "EASY") summary.easy++;
    else if (difficulty === "MEDIUM") summary.medium++;
    else summary.hard++;
    (gramScores[gram] ??= {})[mode] = { count, difficulty };
  }
  perModeSummary[mode] = summary;
}

// Sanity: every answer word in every mode must contain at least one gram valid
// FOR THAT MODE, or the seeder cannot place it.
const uncovered: string[] = [];
for (const mode of MODES) {
  for (const word of answerWords[mode]) {
    let ok = false;
    for (let i = 0; i <= word.length - GRAM_LENGTH; i++) {
      if (gramScores[word.substring(i, i + GRAM_LENGTH)]?.[mode]) {
        ok = true;
        break;
      }
    }
    if (!ok) uncovered.push(`${mode}:${word}`);
  }
}

writeFileSync(
  resolve(scriptsDir, "gram-scores.json"),
  JSON.stringify(gramScores, null, 2),
);

console.log(`Total distinct valid grams: ${Object.keys(gramScores).length}`);
for (const mode of MODES) {
  const s = perModeSummary[mode];
  console.log(
    `  mode ${mode}: valid=${s.valid}  E/M/H=${s.easy}/${s.medium}/${s.hard}  terciles p33=${s.p33} p67=${s.p67}`,
  );
}
console.log(`Answer words with no valid gram in their mode: ${uncovered.length}`);
if (uncovered.length > 0 && uncovered.length <= 20) {
  console.log(`  Uncovered: ${uncovered.join(", ")}`);
}
console.log(`Wrote gram-scores.json to ${scriptsDir}`);
