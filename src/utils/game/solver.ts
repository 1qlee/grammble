import { computeFeedback } from "./feedback";
import { getGuessSet } from "./word-list";
import { getAnswerList } from "./answer-list";
import type { LetterFeedback } from "./types";
import type { GameMode } from "./constants";
import { WORD_LENGTH_BY_MODE } from "./constants";
import type {
  GramPositionStat,
  GuessNarrowing,
  NarrowingResult,
} from "./recap";

// SERVER-ONLY. Reasons about the puzzle the way the player can: it tracks the
// set of *guessable* words still consistent with the gram and the feedback so
// far, and reports how each guess shrank that set. We narrow over the guess
// pool, not the (secret, tiny) answer pool, so "down to one" reflects genuine
// deduction the player could make rather than an artifact of the curated answer
// list. Depends on the guess pool (word-list.ts) — do not import from client.

// Cap on the answer-length survivor sample the per-guess slide lists. The opener can leave hundreds
// standing; sending them all would bloat the payload and the UI, so we send an alphabetical prefix
// and the true remaining total (GuessNarrowing.answerTotal) carries the full count.
const REMAINING_SAMPLE_CAP = 24;

// Cap on the "useful guesses" probe list. These are ranked, not a prefix, so a short list is enough
// to surface the strongest few moves without turning the sub-section into a wall of words.
const PROBE_CAP = 6;

function feedbackEqual(a: LetterFeedback[], b: LetterFeedback[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Information gain of playing `guess` now, measured over the still-possible answer-length words: we
// bucket those answers by the feedback the guess would return against each, then take the Shannon
// entropy (in bits) of the bucket-size distribution. A guess that drives every answer into its own
// bucket scores high; one that returns the same pattern for all of them scores 0 (it tells you
// nothing). This is the standard "which probe splits the field best" metric, restricted to the
// words that could actually be the answer. Returns 0 when there is nothing left to distinguish.
//
// The gram tiles ARE part of the bucket key, so gram position counts by default: a probe that reveals
// whether the answer's gram sits in a still-contested spot earns credit for it. This self-regulates
// against gram position that no longer matters -- once every surviving answer places the gram in the
// same spot, the probe's gram tiles return the same pattern for all of them, contributing zero to the
// split, so the ranking falls back to the letter clues with no special-casing needed.
function splitEntropy(
  guess: string,
  answers: string[],
  gram: string,
): number {
  if (answers.length <= 1) return 0;
  const buckets = new Map<string, number>();
  let scored = 0;
  for (const ans of answers) {
    let key: string;
    try {
      key = computeFeedback(guess, ans, gram).join("");
    } catch {
      // A candidate the guess cannot even be scored against carries no signal; skip it.
      continue;
    }
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
    scored++;
  }
  if (scored === 0) return 0;
  let bits = 0;
  for (const count of buckets.values()) {
    const p = count / scored;
    bits -= p * Math.log2(p);
  }
  return bits;
}

// How much a probe should be demoted for playing against what the player already knows, mirroring the
// skill model in score.ts: it rewards breadth (distinct fresh letters) and charges waste (reusing a
// known-absent letter) and repeats (the same letter twice buys no new information). Gram letters are
// excluded — the gram sits in every probe by construction, so it is neither fresh nor wasteful. The
// penalty is a per-offending-letter deduction in bits, kept small so a genuinely sharper split still
// wins, but enough that a letter-diverse full word beats a degenerate one at comparable information.
const WASTE_BITS_PENALTY = 0.12;
const REPEAT_BITS_PENALTY = 0.12;

function probeQuality(
  probe: string,
  gramLetters: Set<string>,
  deadLetters: Set<string>,
): { penalty: number; distinct: number } {
  const nonGram = probe.split("").filter((c) => !gramLetters.has(c));
  const distinct = new Set(nonGram).size;
  const repeats = nonGram.length - distinct;
  const waste = nonGram.filter((c) => deadLetters.has(c)).length;
  return {
    penalty: repeats * REPEAT_BITS_PENALTY + waste * WASTE_BITS_PENALTY,
    distinct,
  };
}

// The sharpest next guesses available, aligned with how the game actually scores play. `probePool` is
// every guessable word containing the gram; we restrict it here to full answer-length words, because a
// sub-length guess is penalised by the skill model (length deficit) and recommending one is confusing
// advice a player would not want to spend a turn on. Among full-length words we rank primarily by
// splitEntropy (a probe earns its place by narrowing the field), then demote words that waste known-
// dead letters or repeat letters and prefer more letter-diverse words — the same breadth-over-waste
// preference the score rewards. The caller strips out the current candidates and already-played words
// before ranking, so this list is pure narrowing advice distinct from the likely-answers list. We keep
// only probes that genuinely split the field (entropy > 0), cap the list, and when a single answer
// remains there is nothing to narrow, so this is empty by construction.
function rankProbes(
  probePool: string[],
  answerSurvivors: string[],
  gram: string,
  answerLength: number,
  deadLetters: Set<string>,
): string[] {
  if (answerSurvivors.length <= 1) return [];
  const gramLetters = new Set(gram.toUpperCase().split(""));
  return probePool
    .filter((w) => w.length === answerLength)
    .map((w) => {
      const bits = splitEntropy(w, answerSurvivors, gram);
      const { penalty, distinct } = probeQuality(w, gramLetters, deadLetters);
      return { w, bits, score: bits - penalty, distinct };
    })
    .filter((e) => e.bits > 0)
    .sort(
      (a, b) =>
        b.score - a.score || b.distinct - a.distinct || (a.w < b.w ? -1 : 1),
    )
    .slice(0, PROBE_CAP)
    .map((e) => e.w);
}

// Once the field is down to a single answer there is nothing left to narrow, so `rankProbes` returns
// empty. We still surface a few other valid words that contain the gram (drawn from the whole guess
// pool, minus the answer and already-played words) purely as inspiration -- a reminder of what was
// playable for a stuck player, even though none of these can be the answer any more. The pool is
// alphabetised and sampled at an even stride so the handful shown has variety and stays identical
// across reopens (no randomness, matching the rest of the deterministic recap).
function sampleOtherWords(
  pool: string[],
  excluded: Set<string>,
  cap: number,
): string[] {
  const words = pool.filter((w) => !excluded.has(w)).sort();
  if (words.length <= cap) return words;
  const stride = words.length / cap;
  const out: string[] = [];
  for (let i = 0; i < cap; i++) out.push(words[Math.floor(i * stride)]);
  return out;
}

/**
 * The candidate words for a gram: every guessable word that contains the gram
 * as a substring, plus the answer itself (a few answers are not in the guess
 * pool, and the answer must always be a candidate). This is the field of words
 * a player could still be considering before any guess.
 */
export async function candidatesForGram(
  mode: GameMode,
  gram: string,
  answer: string,
): Promise<string[]> {
  const set = await getGuessSet(mode);
  const g = gram.toUpperCase();
  const a = answer.toUpperCase();
  const candidates = new Set<string>();
  for (const w of set) {
    const up = w.toUpperCase();
    if (up.includes(g)) candidates.add(up);
  }
  if (a.includes(g)) candidates.add(a);
  return [...candidates];
}

/**
 * How the gram is distributed across start positions in the ANSWER pool (not the
 * guess pool — the odds a placement is correct are about real answers). For each
 * start index a gram can occupy in a word of `wordLength`, the share of possible
 * answers that place the gram there. A word with the gram twice counts toward
 * both positions, so fractions are per-position probabilities, not a partition.
 */
export async function gramPlacementDistribution(
  mode: GameMode,
  gram: string,
  wordLength: number,
): Promise<GramPositionStat[]> {
  const list = await getAnswerList(mode);
  const g = gram.toUpperCase();
  const answers = list
    .map((w) => w.toUpperCase())
    .filter((w) => w.includes(g));
  const total = answers.length;
  const lastStart = wordLength - g.length;
  const stats: GramPositionStat[] = [];

  for (let p = 0; p <= lastStart; p++) {
    let count = 0;
    for (const w of answers) if (w.startsWith(g, p)) count++;
    stats.push({
      position: p,
      count,
      fraction: total > 0 ? count / total : 0,
    });
  }
  return stats;
}

/**
 * Replays a finished game against the candidate pool: for each guess, how many
 * answers were still possible before it and how many survived the feedback it
 * returned. `solvedWith` captures the field size entering the winning guess, so
 * a caller can tell a fully-deduced solve (1) from a lucky finish (many).
 */
export async function computeNarrowing(input: {
  mode: GameMode;
  gram: string;
  answer: string;
  guesses: string[];
  feedback: LetterFeedback[][];
  won: boolean;
}): Promise<NarrowingResult> {
  const guesses = input.guesses.filter((g) => g.length > 0);
  const answerLength = WORD_LENGTH_BY_MODE[input.mode];
  const fullPool = await candidatesForGram(
    input.mode,
    input.gram,
    input.answer,
  );
  // The full universe of narrowing probes: every guessable word containing the gram at any valid
  // length, captured before we restrict the answer field. Sharp guesses are ranked out of this whole
  // pool (not just still-valid or answer-length words) so a strong full-length probe surfaces even
  // when it has been ruled out as the answer.
  const probeUniverse = [...fullPool];
  // The narrowing story counts only words that could actually be the solution. The answer is always
  // answer-length, so shorter valid guesses are narrowing tools (surfaced as probes), never words
  // "still standing" as possible answers. Counting them would inflate the survivor total above the
  // likely-answers list it sits beside.
  let candidates = fullPool.filter((w) => w.length === answerLength);
  const start = candidates.length;
  const perGuess: GuessNarrowing[] = [];
  let solvedWith: number | null = null;
  // Letters the player has confirmed absent (guessed but not in the answer). A probe that reuses one
  // wastes the turn, so rankProbes demotes it — matching the score model's waste penalty. Accumulates
  // as guesses are replayed. Gram letters are always in the answer, so they never enter this set.
  const answerUpper = input.answer.toUpperCase();
  const deadLetters = new Set<string>();

  for (let i = 0; i < guesses.length; i++) {
    const fb = input.feedback[i];
    if (!fb) break;
    const guess = guesses[i].toUpperCase();
    const before = candidates.length;
    if (input.won && i === guesses.length - 1) solvedWith = before;
    for (const c of guess) if (!answerUpper.includes(c)) deadLetters.add(c);

    candidates = candidates.filter((cand) => {
      try {
        return feedbackEqual(computeFeedback(guess, cand, input.gram), fb);
      } catch {
        // A candidate that cannot even be scored against this guess (should not
        // happen, since every candidate contains the gram) is simply dropped.
        return false;
      }
    });

    // The still-standing possible answers (candidates are already answer-length). Sharp guesses are
    // the best words to narrow them further, drawn from the whole gram pool at any length minus the
    // current candidates (already shown as likely answers) and any already-played word, so the two
    // lists stay distinct. The winning guess itself is dropped from the answer list (it is the
    // answer, not a "still-possible" word to consider).
    const answerSurvivors = candidates.filter((w) => w !== guess);
    const excluded = new Set([
      ...answerSurvivors,
      ...guesses.slice(0, i + 1).map((g) => g.toUpperCase()),
    ]);
    const answers = [...answerSurvivors].sort().slice(0, REMAINING_SAMPLE_CAP);
    const probes = rankProbes(
      probeUniverse.filter((w) => !excluded.has(w)),
      answerSurvivors,
      input.gram,
      answerLength,
      deadLetters,
    );
    // When a single answer remains, probes is empty; fall back to a varied sample of other valid gram
    // words so the slide can still show "what was playable" instead of nothing. Only answer-length
    // words are shown -- shorter valid guesses are narrowing tools, not words the player could have
    // landed the answer with, so they do not belong in this "what was playable" list.
    const otherWords =
      answerSurvivors.length <= 1
        ? sampleOtherWords(
            probeUniverse.filter((w) => w.length === answerLength),
            excluded,
            PROBE_CAP,
          )
        : [];

    perGuess.push({
      guess: guesses[i],
      before,
      after: candidates.length,
      answers,
      answerTotal: answerSurvivors.length,
      probes,
      otherWords,
    });
  }

  return {
    start,
    perGuess,
    solvedWith,
    guessCount: guesses.length,
    won: input.won,
  };
}

/**
 * Answer-length candidate count ENTERING each guess: out[i] is how many words could still be the
 * answer given the feedback from guesses 0..i-1, before guess i was played (the true answer is always
 * among them until it is guessed). This is the lean count-only sibling of computeNarrowing, used by
 * the scorer's exploration relief: when out[i] === 1 only the answer still fits, so any further probe
 * is forced clue-gathering rather than narrowing. Shorter valid guesses are narrowing tools, never
 * possible answers, so only answer-length candidates are counted (mirroring computeNarrowing).
 */
export async function candidatePoolByGuess(input: {
  mode: GameMode;
  gram: string;
  answer: string;
  guesses: string[];
  feedback: LetterFeedback[][];
}): Promise<number[]> {
  const guesses = input.guesses.filter((g) => g.length > 0);
  const answerLength = WORD_LENGTH_BY_MODE[input.mode];
  const fullPool = await candidatesForGram(input.mode, input.gram, input.answer);
  let candidates = fullPool.filter((w) => w.length === answerLength);
  const out: number[] = [];
  for (let i = 0; i < guesses.length; i++) {
    // Count entering guess i (before its own feedback is applied).
    out.push(candidates.length);
    const fb = input.feedback[i];
    if (!fb) break;
    const guess = guesses[i].toUpperCase();
    candidates = candidates.filter((cand) => {
      try {
        return feedbackEqual(computeFeedback(guess, cand, input.gram), fb);
      } catch {
        return false;
      }
    });
  }
  // A missing feedback row stops elimination; fill any remaining guesses with the last known count so
  // the array is always guess-aligned for the scorer.
  while (out.length < guesses.length) out.push(candidates.length);
  return out;
}
