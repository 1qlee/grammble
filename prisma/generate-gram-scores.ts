import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const SCORE_THRESHOLD = 5;
const MAX_POSITIONS = 5;

const scriptsDir = resolve(import.meta.dirname, "../scripts");

const answerWords: string[] = JSON.parse(
  readFileSync(resolve(scriptsDir, "final-word-list.json"), "utf-8"),
);
const guessWords: string[] = JSON.parse(
  readFileSync(resolve(scriptsDir, "guess-list.json"), "utf-8"),
);

const gramsFromAnswers = new Set<string>();
for (const word of answerWords) {
  for (let i = 0; i < word.length - 1; i++) {
    gramsFromAnswers.add(word.substring(i, i + 2));
  }
}

type GramRecord = {
  gram: string;
  positions: number[];
  score: number;
  count: number;
};

const records: GramRecord[] = [];

for (const gram of gramsFromAnswers) {
  const positions = new Array(MAX_POSITIONS).fill(0);
  let count = 0;
  for (const word of guessWords) {
    if (word.includes(gram)) count++;
    for (let i = 0; i <= word.length - 2; i++) {
      if (word.substring(i, i + 2) === gram) positions[i]++;
    }
  }

  let product = 1;
  for (const c of positions) product *= Math.max(c, 1);
  const score = Math.round(product ** (1 / MAX_POSITIONS));

  records.push({ gram, positions, score, count });
}

type Difficulty = "EASY" | "MEDIUM" | "HARD";

const passingRecords = records.filter((r) => r.score >= SCORE_THRESHOLD);
const passingScoresAsc = passingRecords.map((r) => r.score).sort((a, b) => a - b);
const n = passingScoresAsc.length;
const p33 = passingScoresAsc[Math.floor(n / 3)];
const p67 = passingScoresAsc[Math.floor((2 * n) / 3)];

function bucketFor(score: number): Difficulty {
  if (score >= p67) return "EASY";
  if (score >= p33) return "MEDIUM";
  return "HARD";
}

const gramScores: Record<
  string,
  { score: number; count: number; difficulty: Difficulty }
> = {};
for (const r of passingRecords) {
  gramScores[r.gram] = {
    score: r.score,
    count: r.count,
    difficulty: bucketFor(r.score),
  };
}

const difficultyCounts = { EASY: 0, MEDIUM: 0, HARD: 0 };
for (const entry of Object.values(gramScores)) difficultyCounts[entry.difficulty]++;

const totalGrams = gramsFromAnswers.size;
const passingGrams = Object.keys(gramScores).length;
const rejectedGrams = totalGrams - passingGrams;

let wordsWithNoGram = 0;
const uncoveredWords: string[] = [];
for (const word of answerWords) {
  let hasPassingGram = false;
  for (let i = 0; i < word.length - 1; i++) {
    const gram = word.substring(i, i + 2);
    if (gramScores[gram]) {
      hasPassingGram = true;
      break;
    }
  }
  if (!hasPassingGram) {
    wordsWithNoGram++;
    uncoveredWords.push(word);
  }
}

writeFileSync(
  resolve(scriptsDir, "gram-scores.json"),
  JSON.stringify(gramScores, null, 2),
);

const sortedByScore = [...records].sort((a, b) => b.score - a.score);
const passingSorted = sortedByScore.filter((r) => r.score >= SCORE_THRESHOLD);
const scores = sortedByScore.map((r) => r.score);
const min = scores[scores.length - 1];
const max = scores[0];
const median = scores[Math.floor(scores.length / 2)];
const p10 = scores[Math.floor(scores.length * 0.9)];
const p25 = scores[Math.floor(scores.length * 0.75)];
const p75 = scores[Math.floor(scores.length * 0.25)];
const p90 = scores[Math.floor(scores.length * 0.1)];

const fmt = (r: GramRecord) =>
  `  ${r.gram}  score=${r.score.toString().padStart(4)}  [${r.positions.join(", ")}]`;

console.log(`Total unique grams from answers: ${totalGrams}`);
console.log(`Passing grams (>= ${SCORE_THRESHOLD}): ${passingGrams}`);
console.log(`Rejected grams: ${rejectedGrams}`);
console.log(`Answer words with no passing gram: ${wordsWithNoGram}`);
if (uncoveredWords.length > 0 && uncoveredWords.length <= 20) {
  console.log(`  Uncovered: ${uncoveredWords.join(", ")}`);
}
console.log("");
console.log("Score distribution:");
console.log(`  min=${min}  p10=${p10}  p25=${p25}  median=${median}  p75=${p75}  p90=${p90}  max=${max}`);
console.log("");
console.log("Top 10 grams:");
for (const r of sortedByScore.slice(0, 10)) console.log(fmt(r));
console.log("");
console.log("Bottom 10 passing grams:");
for (const r of passingSorted.slice(-10)) console.log(fmt(r));
console.log("");
console.log("");
console.log(`Difficulty buckets (tercile cutoffs: p33=${p33}, p67=${p67}):`);
console.log(
  `  EASY=${difficultyCounts.EASY}  MEDIUM=${difficultyCounts.MEDIUM}  HARD=${difficultyCounts.HARD}`,
);
console.log("");
console.log(`Wrote gram-scores.json to ${scriptsDir}`);
