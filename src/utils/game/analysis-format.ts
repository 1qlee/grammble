import type { GameAnalysis, Observation } from "~/utils/game/analysis";
import type { GramPlacement } from "~/utils/game/recap";
import {
  OBSERVATION_PHRASES,
  SUMMARY_PHRASES,
} from "~/utils/game/analysis-phrases.constants";

export interface FormattedAnalysis {
  headline: string;
  positives: string[];
  negatives: string[];
}

// djb2 string hash, kept deterministic so a given game always renders the same
// phrasing (no Math.random): reopening the dialog must not reshuffle the copy.
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick(variants: string[], key: string): string {
  return variants[hash(key) % variants.length];
}

function fill(
  template: string,
  data: { letter?: string; guessNumber?: number; count?: number },
  guessCount: number
): string {
  const count = data.count ?? 0;
  return template
    .replaceAll("{letter}", data.letter ?? "")
    .replaceAll(
      "{guess}",
      data.guessNumber ? `guess ${data.guessNumber}` : "a later guess"
    )
    .replaceAll("{count}", String(count))
    .replaceAll("{s}", count === 1 ? "" : "s")
    .replaceAll("{n}", String(guessCount));
}

function formatObservation(o: Observation, seed: string, n: number): string {
  const key = `${seed}:${o.type}:${o.letter ?? ""}:${o.guessNumber ?? 0}`;
  return fill(pick(OBSERVATION_PHRASES[o.type], key), o, n);
}

// Human name for a gram start position within a word of `wordLength`.
function positionLabel(
  position: number,
  wordLength: number,
  gramLength: number
): string {
  if (position === 0) return "the start";
  if (position === wordLength - gramLength) return "the end";
  return `position ${position + 1}`;
}

const GRAM_CAPTIONS = {
  // Player's opening placement matched the answer's position (gramCorrect).
  aligned: [
    "You opened with the gram at {chosenLabel} and nailed it. {chosenPct}% of possible answers keep it there.",
    "Straight to the right spot: the gram really was at {chosenLabel}, where {chosenPct}% of answers hold it.",
    "Your opener placed the gram at {chosenLabel} and it held. {chosenPct}% of possible answers agree.",
  ],
  // Player chose the statistically most common spot, but this answer was an exception.
  oddsWrong: [
    "You played the odds at {chosenLabel} ({topPct}% of answers keep the gram there), but this puzzle tucked it at {answerLabel}.",
    "Smart bet: {chosenLabel} is the gram's most common home ({topPct}%). This answer was the exception, hiding it at {answerLabel}.",
    "The gram usually sits at {chosenLabel} ({topPct}%), so opening there was sound, but today it lived at {answerLabel}.",
  ],
  // Player placed the gram somewhere other than the answer's spot and other than the top spot.
  missed: [
    "Your opener put the gram at {chosenLabel} ({chosenPct}%), but it actually sat at {answerLabel}. The likeliest spot was {topLabel} ({topPct}%).",
    "You tried {chosenLabel} ({chosenPct}% of answers); the gram was really at {answerLabel}, and it most often lives at {topLabel} ({topPct}%).",
    "Not quite: the gram hid at {answerLabel}, not {chosenLabel}. Most answers keep it at {topLabel} ({topPct}%).",
  ],
  // No usable opening guess; just describe the prior.
  prior: [
    "Across every possible answer, the gram sits at {topLabel} most often ({topPct}%).",
    "The gram's most common home is {topLabel}, covering {topPct}% of possible answers.",
    "Where does the gram live? Most often at {topLabel} ({topPct}% of answers).",
  ],
};

/**
 * Caption for the first-guess slide: frames the opener as a bet on where the gram lives and
 * compares it to both the prior odds and where the gram actually sat. Distinguishes "played the
 * odds but the answer was an exception" from a genuine misread, so it never says "you tried the
 * end, but the gram sits at the end."
 */
export function gramPlacementCaption(gp: GramPlacement, seed: string): string {
  const top = gp.positions.reduce(
    (best, p) => (p.fraction > best.fraction ? p : best),
    gp.positions[0] ?? { position: 0, count: 0, fraction: 0 }
  );
  const topLabel = positionLabel(top.position, gp.wordLength, gp.gramLength);
  const topPct = Math.round(top.fraction * 100);
  const answerLabel = positionLabel(
    gp.answerPosition,
    gp.wordLength,
    gp.gramLength
  );

  const bucket =
    gp.chosenPosition == null
      ? "prior"
      : gp.chosenAligned
        ? "aligned"
        : gp.chosenPosition === top.position
          ? "oddsWrong"
          : "missed";
  const chosen =
    gp.chosenPosition != null
      ? gp.positions.find((p) => p.position === gp.chosenPosition)
      : undefined;
  const chosenLabel =
    gp.chosenPosition != null
      ? positionLabel(gp.chosenPosition, gp.wordLength, gp.gramLength)
      : "";
  const chosenPct = chosen ? Math.round(chosen.fraction * 100) : 0;

  return pick(GRAM_CAPTIONS[bucket], `${seed}:gram:${bucket}`)
    .replaceAll("{topLabel}", topLabel)
    .replaceAll("{topPct}", String(topPct))
    .replaceAll("{chosenLabel}", chosenLabel)
    .replaceAll("{chosenPct}", String(chosenPct))
    .replaceAll("{answerLabel}", answerLabel);
}

// --- Additive score summary --------------------------------------------------------------------
// The score is dominated by the guess-count baseline (`frame`), with skill and luck as smaller
// signed adjustments on top (frame + skill + luck = total). This summary says that plainly: it
// leads with the solve, then names whichever adjustment actually moved the needle, so a fast win
// never reads as "no skill = bad play."

// A raw skill/luck point swing at or above this is worth calling out; below it, the axis was
// effectively flat.
const NOTABLE_ADJUSTMENT = 4;

const SCORE_LEAD = [
  "Winning in {n} guess{es} is where most of your score comes from.",
  "A {n}-guess solve carries the bulk of this score.",
  "Most of these points are for solving it in {n} guess{es}.",
];

const ADJUSTMENTS = {
  neutral: [
    "Your play barely moved it from there.",
    "From there, the guesses that followed changed little.",
  ],
  skillUp: [
    "Clean, efficient play nudged it higher.",
    "Sharp moves added a little on top.",
  ],
  skillDown: [
    "A few wasted moves trimmed it slightly.",
    "Some guesses retread known ground, costing a bit.",
  ],
};

/**
 * Plain-language read of WHERE the score came from: the solve (guess count) plus the dominant skill
 * adjustment. Seeded so phrasing is stable across reopens. Handles the one-guess ace and losses as
 * special cases, since neither is a "solved in N, adjusted by skill" story. Luck is not part of the
 * score, so it never appears here (it has its own fortune readout).
 */
export function scoreSummary(
  parts: { skill: number },
  guessCount: number,
  won: boolean,
  seed: string
): string {
  if (!won) {
    return "You ran out of guesses. The score reflects how much of the answer you uncovered and how cleanly you played.";
  }
  if (guessCount <= 1) {
    return "A one-guess ace. You cannot score higher than this.";
  }

  const lead = pick(SCORE_LEAD, `${seed}:scorelead:${guessCount}`)
    .replaceAll("{n}", String(guessCount))
    .replaceAll("{es}", guessCount === 1 ? "" : "es");

  const { skill } = parts;
  let key: keyof typeof ADJUSTMENTS;
  if (Math.abs(skill) < NOTABLE_ADJUSTMENT) {
    key = "neutral";
  } else {
    key = skill > 0 ? "skillUp" : "skillDown";
  }
  const tail = pick(ADJUSTMENTS[key], `${seed}:scoreadj:${key}`);

  return `${lead} ${tail}`;
}

export function formatAnalysis(a: GameAnalysis): FormattedAnalysis {
  const headline = fill(
    pick(SUMMARY_PHRASES[a.summary], `${a.seed}:summary:${a.summary}`),
    {},
    a.guessCount
  );
  return {
    headline,
    positives: a.positives.map((o) =>
      formatObservation(o, a.seed, a.guessCount)
    ),
    negatives: a.negatives.map((o) =>
      formatObservation(o, a.seed, a.guessCount)
    ),
  };
}
