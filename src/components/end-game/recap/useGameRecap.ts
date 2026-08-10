import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGameStore } from "~/stores/game-store";
import type { GameMode } from "~/utils/game/constants";
import { getRecapServerFn } from "~/utils/trpc/server-caller";
import {
  gramPlacementCaption,
  scoreSummary,
} from "~/utils/game/analysis-format";
import type {
  FrameLine,
  GramPlacement,
  LuckResult,
  ScoreContribution,
} from "~/utils/game/recap";
import {
  contributionLabel,
  frameLineLabel,
  OPENER_GRADE_KEYS,
  OPENER_MAX,
  openerLinePercent,
} from "./skillLuck.constants";
import { noteTiles, type NoteCell } from "~/utils/game/note-tiles";
import type { LetterFeedback } from "~/utils/game/types";

// The board context a note's tile attribution is resolved against: the played guesses, their
// feedback, and whether the game was won (the winning guess is excluded from some walks).
interface TileContext {
  guesses: string[];
  feedback: LetterFeedback[][];
  won: boolean;
}

// One bar on the opener slide: the gram tile placed within a row of blank tiles, sized to the
// share of possible answers that place it there. `position` is the gram's start slot in a word of
// `wordLength`; the row renders a real gram tile there and blank wells everywhere else.
export interface GramBar {
  gram: string;
  position: number;
  wordLength: number;
  pct: number;
  fraction: number;
  isChosen: boolean;
  isAligned: boolean;
}

// The whole analysis is now one carousel. Slide kinds:
//  - overview: additive score ledger (base + opening + skill) plus a separate fortune readout
//  - gram: the opening guess, framed as a bet on where the gram lives
//  - guess: each later guess, its narrowing of the field, word list, and skill change
export interface OverviewSlide {
  kind: "overview";
  // Additive breakdown of the score: base + opening + skill = score, surfaced as a ledger so the
  // player sees where the total came from (the base and opening dominate; skill adjusts). Luck is
  // NOT in the score; it is a separate fortune readout (see `fortune`).
  score: number;
  // Structural pedestal (starting floor, per-turn costs, solve bonus): the part of the base that is
  // not the player's opening play. base + opening === frame by construction.
  base: number;
  baseLines: FrameLine[];
  // The graded OPENING: what the opener earned on guess one (gram bet, distinct letters, full
  // length). Split out from the base so a fast win reads as "great opener", not "0 skill".
  opening: number;
  openingLines: FrameLine[];
  // Raw signed skill point swing on top of the baseline.
  skill: number;
  // Every nonzero skill contribution (sorted by magnitude), so the meter can expand into an
  // itemized breakdown of what drove it.
  contributions: ScoreContribution[];
  // How the board fell, measured independently of the score (see luck.ts). Rendered as its own
  // fortune readout, never mixed into the score pillars.
  fortune: LuckResult;
  // Guesses played, used to label the base row's turn-cost line.
  guessCount: number;
  // Plain-language read of where the score came from (leads with the solve).
  summary: string;
}

export interface GramSlide {
  kind: "gram";
  guessNumber: number;
  guess: string;
  caption: string;
  bars: GramBar[];
  skillDelta: number;
  // The opener's graded credit, shown on the opener slide so it reads as skillful even on a fast win.
  opening: number;
  // Score-breakdown lines for the opener: the graded opening (gram bet, letter spread, full length)
  // plus any opener skill, each with its point value. Sums to this slide's score change.
  notes: NoteItem[];
  // Field standing before the opener (the full opener pool) and after it, plus the survivor lists:
  // `answers` are the answer-length possible solutions (answerTotal is their full count) and `probes`
  // are the most useful shorter guesses to narrow further.
  before: number;
  after: number;
  answers: string[];
  answerTotal: number;
  probes: string[];
  // Other valid gram words to show when only the answer remains (see GuessNarrowing.otherWords).
  otherWords: string[];
  // Running total walking the recap: the score before this slide's contribution and after it. The
  // opener starts from the structural base and adds its Opening credit (plus any opener skill).
  scoreBefore: number;
  scoreAfter: number;
}

// The winning finish, present only on the final slide of a won game: how tight the endgame was and
// what other words were still in play when the answer was found. solvedWith is the size of the field
// the winning guess chose from (1 = fully deduced); finishBits is the luck of landing the answer out
// of that field (near 0 when deduced, larger when it was a stab from many survivors).
export interface FinishInfo {
  solvedWith: number;
  finishBits: number;
  alternatives: string[];
  moreAlternatives: number;
}

// One guess's narrowing on the whole-game path summary: the guessed word and the field size before
// and after it. A step where before === after (and after > 1) failed to cut the field.
export interface PathStep {
  guess: string;
  before: number;
  after: number;
}

export interface GuessSlide {
  kind: "guess";
  guessNumber: number;
  guess: string;
  skillDelta: number;
  before: number;
  after: number;
  // Survivor lists after this guess: `answers` are the answer-length possible solutions (answerTotal
  // is their full count), `probes` are the most useful shorter guesses to narrow further.
  answers: string[];
  answerTotal: number;
  probes: string[];
  // Other valid gram words to show when only the answer remains (see GuessNarrowing.otherWords).
  otherWords: string[];
  // Score-breakdown lines for this guess: each skill contribution with its point value.
  notes: NoteItem[];
  // Running total walking the recap: each guess adds its skill on top of the prior slide, so the
  // last guess's scoreAfter equals the overview total. (Distinct from before/after above, which
  // count still-valid words.)
  scoreBefore: number;
  scoreAfter: number;
  // Final-slide-only analysis: the finish read (won games only) and the whole-game narrowing path.
  finish?: FinishInfo;
  path?: PathStep[];
}

export type RecapSlide = OverviewSlide | GramSlide | GuessSlide;

export interface FormattedRecap {
  slides: RecapSlide[];
}

// One labelled line in a slide's score breakdown: what the item was and how many points it moved.
// `max` is the ceiling for graded items (the opener grade), so the line can read "+3/10"; it is
// absent for skill items, where no fixed maximum applies.
export interface NoteItem {
  label: string;
  points: number;
  max?: number;
  // Set for graded-opener lines: the criterion percentage shown in place of the raw point delta, from
  // the original weight-scaled points (before reconcileNotes rounds them for the slide's sum).
  percent?: string;
  // The contribution's stable key (see CONTRIBUTION_LABELS / FRAME_LABELS), kept so the recap can map
  // the note back to the board tiles it was earned on for the hover/tap highlight.
  key: string;
  // Board cells the contribution refers to (see noteTiles). Usually in this note's guess row, but a
  // neglect note points at an omitted letter's earliest appearance on an earlier row. Empty for keys
  // with no per-tile meaning (a length shortfall), which render as plain text.
  tiles: NoteCell[];
}

// Turn a guess's contributions into labelled score-breakdown lines, keeping raw (unrounded) point
// values so `reconcileNotes` can round them as a group against the slide's displayed delta. Items
// arrive pre-sorted by magnitude.
function noteItems(
  items: ScoreContribution[],
  gi: number,
  ctx: TileContext
): NoteItem[] {
  return items.map((it) => {
    const tiles = noteTiles(it.key, gi, ctx.guesses, ctx.feedback, ctx.won);
    return {
      label: contributionLabel(it.key, it.points, tiles.length),
      points: it.points,
      key: it.key,
      tiles,
    };
  });
}

// Rounds a slide's note points so they sum to exactly `target` -- the slide's displayed score change
// (Math.round(after) - Math.round(before)). Rounding each note on its own can make the itemized lines
// disagree with the headline delta: a lone ~1.5 contribution rounds to +2 while the running total
// only ticks +1 across a fractional boundary. We round each note, then fold the leftover crumb into
// the largest-magnitude line one unit at a time so a single note never flips sign from the crumb.
// A graded line is never pushed past its ceiling, though: a distinct-letters line worth 6.0 must not
// display "+7 / 6" just because a crumb landed on it. When the only remaining home is a maxed-out
// line, the crumb is left off rather than shown as an impossible value.
// Notes that land on zero are dropped last.
function reconcileNotes(notes: NoteItem[], target: number): NoteItem[] {
  const parts = notes.map((n) => ({ ...n, points: Math.round(n.points) }));
  let residual = target - parts.reduce((s, p) => s + p.points, 0);
  while (residual !== 0 && parts.length > 0) {
    const step = Math.sign(residual);
    let idx = -1;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      // Adding to a line already at its max would print a value above the ceiling; skip it.
      if (step > 0 && p.max != null && p.points >= p.max) continue;
      if (idx === -1 || Math.abs(p.points) > Math.abs(parts[idx].points)) idx = i;
    }
    if (idx === -1) break;
    parts[idx].points += step;
    residual -= step;
  }
  return parts.filter((n) => n.points !== 0);
}

// Splits the frame ledger into the structural pedestal (solve base, speed bonus) and the graded
// OPENING (the opener's gram bet, distinct letters, full-length choice). The opening is a credit
// earned on guess one; surfacing it on its own keeps a fast win from reading as "0 skill" when its
// skill lived entirely in the opener.
//
// The score's fractional-to-whole rounding crumb is NOT shown as its own line. The opening lines are
// rendered as percentages (see openerLinePercent), so they are not expected to sum to the opening
// total anyway -- that makes the opening total the natural, invisible home for the crumb. We keep the
// opening capped at OPENER_MAX so it never reads above its ceiling, and let the structural base absorb
// only the rare crumb overflow. base + opening === frame either way, so the pillars still reconcile
// exactly to the score.
function splitFrameLines(frameLines: FrameLine[]): {
  baseLines: FrameLine[];
  base: number;
  openingLines: FrameLine[];
  opening: number;
} {
  const openingLines = frameLines.filter((l) => OPENER_GRADE_KEYS.has(l.key));
  // Structural lines are the frame minus the opener grade AND minus the rounding crumb (never shown).
  const baseLines = frameLines.filter(
    (l) => !OPENER_GRADE_KEYS.has(l.key) && l.key !== "rounding"
  );
  const sum = (ls: FrameLine[]) =>
    Math.round(ls.reduce((s, l) => s + l.points, 0));
  const frame = sum(frameLines);
  const structural = sum(baseLines);
  // frame - structural is the opener grade plus the crumb; cap it at the opener ceiling.
  const opening = Math.min(OPENER_MAX, frame - structural);
  return {
    baseLines,
    base: frame - opening,
    openingLines,
    opening,
  };
}

function buildGramBars(gp: GramPlacement): GramBar[] {
  return gp.positions.map((p) => {
    const isChosen = gp.chosenPosition === p.position;
    return {
      gram: gp.gram,
      position: p.position,
      wordLength: gp.wordLength,
      pct: p.fraction > 0 ? Math.max(3, Math.round(p.fraction * 100)) : 0,
      fraction: p.fraction,
      isChosen,
      isAligned: isChosen && gp.chosenAligned,
    };
  });
}

// Shared so the click-time read and the open-time prefetch resolve to the exact same cache entry.
// The recap for a given (mode, date) is immutable once the game is terminal, so it never goes stale.
export function gameRecapQueryOptions(mode: GameMode, date: string) {
  return {
    queryKey: ["gameRecap", mode, date] as const,
    queryFn: () => getRecapServerFn({ data: { mode, date } }),
    staleTime: Infinity,
    retry: false,
  };
}

/**
 * Warms the recap cache while the end-game dialog is open, before the user taps the Coach CTA. Since
 * `gameRecapQueryOptions` is `staleTime: Infinity`, the later `useGameRecap` read inside ScoreAnalysis
 * hits a populated cache and renders the carousel with no loading state (and no modal height flash).
 * Gate `enabled` on premium + dialog-open; the hook only fires once the game is terminal.
 */
export function usePrefetchGameRecap(enabled: boolean): void {
  const queryClient = useQueryClient();
  const status = useGameStore((s) => s.status);
  const date = useGameStore((s) => s.date);
  const mode = useGameStore((s) => s.mode);
  const terminal = status === "WON" || status === "LOST";

  useEffect(() => {
    if (!enabled || !terminal || !date) return;
    queryClient.prefetchQuery(gameRecapQueryOptions(mode, date));
  }, [enabled, terminal, date, mode, queryClient]);
}

/**
 * Fetches the premium, solver-backed recap and formats it into a single per-guess carousel: an
 * overview (score breakdown plus a separate fortune readout), the opener (gram-placement odds), then
 * one slide per later guess with its narrowing, word list, and skill change. The heavy analysis runs
 * server-side (see game.getRecap); this hook only turns the structured result into human phrasing,
 * seeded by date + mode so the copy is stable across reopens. Disabled unless `enabled` (premium)
 * and terminal.
 */
export function useGameRecap(enabled: boolean): {
  recap: FormattedRecap | null;
  isLoading: boolean;
} {
  const status = useGameStore((s) => s.status);
  const date = useGameStore((s) => s.date);
  const mode = useGameStore((s) => s.mode);
  const guesses = useGameStore((s) => s.guesses);
  const feedback = useGameStore((s) => s.feedback);
  const terminal = status === "WON" || status === "LOST";

  const { data, isLoading } = useQuery({
    ...gameRecapQueryOptions(mode, date),
    enabled: enabled && terminal && !!date,
  });

  if (!data) return { recap: null, isLoading };

  const seed = `${date}:${mode}`;
  const { breakdown, narrowing, gramPlacement, luck } = data;
  const perGuess = breakdown.perGuess;
  const won = status === "WON";
  const guessCount = narrowing.perGuess.length;
  // Board context every note's tile attribution resolves against; the recap board renders these same
  // store rows, so a note's columns line up with the tiles the player sees.
  const tileCtx: TileContext = { guesses, feedback, won };

  const { baseLines, base, openingLines, opening } = splitFrameLines(
    breakdown.frameLines
  );

  const overview: OverviewSlide = {
    kind: "overview",
    score: breakdown.total,
    base,
    baseLines,
    opening,
    openingLines,
    skill: breakdown.skill,
    contributions: breakdown.contributions,
    fortune: luck,
    guessCount,
    summary: scoreSummary({ skill: breakdown.skill }, guessCount, won, seed),
  };

  // The running total starts at the structural base; every slide adds its own contribution so the
  // last guess lands exactly on the overview total (base + opening + skill).
  const openerSkillDelta = perGuess[0]?.skillDelta ?? 0;
  const openerAfter = base + opening + openerSkillDelta;

  // The opener's breakdown: the graded opening lines (the rounding crumb is not a player choice, so
  // it stays out) followed by any opener skill, rounded as a group so they sum to the opener's shown
  // score change rather than each drifting off it independently.
  const openerNotes: NoteItem[] = reconcileNotes(
    [
      ...openingLines
        .filter((l) => l.key !== "rounding")
        .map((l) => ({
          label: frameLineLabel(l.key, { points: l.points, max: l.max }),
          points: l.points,
          max: l.max,
          key: l.key,
          percent: openerLinePercent(l.points, l.max) ?? undefined,
          tiles: noteTiles(l.key, 0, guesses, feedback, won),
        })),
      ...noteItems(perGuess[0]?.items ?? [], 0, tileCtx),
    ],
    Math.round(openerAfter) - Math.round(base)
  );

  const opener: GramSlide = {
    kind: "gram",
    guessNumber: 1,
    guess: narrowing.perGuess[0]?.guess.toUpperCase() ?? "",
    caption: gramPlacementCaption(gramPlacement, seed),
    bars: buildGramBars(gramPlacement),
    skillDelta: openerSkillDelta,
    opening,
    notes: openerNotes,
    before: narrowing.perGuess[0]?.before ?? 0,
    after: narrowing.perGuess[0]?.after ?? 0,
    answers: narrowing.perGuess[0]?.answers ?? [],
    answerTotal: narrowing.perGuess[0]?.answerTotal ?? 0,
    probes: narrowing.perGuess[0]?.probes ?? [],
    otherWords: narrowing.perGuess[0]?.otherWords ?? [],
    scoreBefore: base,
    scoreAfter: openerAfter,
  };

  // One slide per guess after the opener (includes the winning guess). `running` accumulates the
  // score across the sequence, seeded by the opener's total.
  let running = openerAfter;
  const lastIdx = narrowing.perGuess.length - 1;
  const guessSlides: GuessSlide[] = narrowing.perGuess
    .slice(1)
    .map((step, i) => {
      const idx = i + 1;
      const pg = perGuess[idx];
      const skillDelta = pg?.skillDelta ?? 0;
      const scoreBefore = running;
      running += skillDelta;
      // The final slide carries the whole-game narrowing path, and on a win the finish read: the
      // field the winning guess chose from and the other words that were still standing.
      const isFinal = idx === lastIdx;
      const path: PathStep[] | undefined = isFinal
        ? narrowing.perGuess.map((g) => ({
            guess: g.guess.toUpperCase(),
            before: g.before,
            after: g.after,
          }))
        : undefined;
      let finish: FinishInfo | undefined;
      if (isFinal && narrowing.won && narrowing.solvedWith != null) {
        const answer = step.guess.toUpperCase();
        const alternatives = (narrowing.perGuess[idx - 1]?.answers ?? [])
          .map((w) => w.toUpperCase())
          .filter((w) => w !== answer)
          .slice(0, 6);
        finish = {
          solvedWith: narrowing.solvedWith,
          finishBits: luck.perGuess.find((g) => g.isWin)?.bits ?? luck.finishBits,
          alternatives,
          moreAlternatives: Math.max(
            0,
            narrowing.solvedWith - 1 - alternatives.length
          ),
        };
      }
      return {
        kind: "guess",
        guessNumber: idx + 1,
        guess: step.guess.toUpperCase(),
        skillDelta,
        before: step.before,
        after: step.after,
        answers: step.answers,
        answerTotal: step.answerTotal,
        probes: step.probes,
        otherWords: step.otherWords,
        notes: reconcileNotes(
          noteItems(pg?.items ?? [], idx, tileCtx),
          Math.round(running) - Math.round(scoreBefore)
        ),
        scoreBefore,
        scoreAfter: running,
        finish,
        path,
      };
    });

  return {
    recap: { slides: [overview, opener, ...guessSlides] },
    isLoading,
  };
}
