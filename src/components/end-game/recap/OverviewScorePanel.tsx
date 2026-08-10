import { useState } from "react";
import type { FrameLine, ScoreContribution } from "~/utils/game/recap";
import { Odometer } from "../stats/Odometer";
import {
  AXIS_END_LABELS,
  contributionLabel,
  frameLineLabel,
  OPENER_GRADE_KEYS,
  openerLinePercent,
} from "./skillLuck.constants";
import {
  contentDelay,
  useCascadeIn,
  useColumnFill,
  useColumnMeterFill,
  useRecapIntro,
} from "./useRecapAnimations";

// Collapse the raw skill contributions (which can repeat a key across guesses) into one signed line
// per key, largest magnitude first, dropping anything that rounds to nil. Drives the skill pillar
// breakdown the same way frameLines drives the base breakdown.
function aggregateByKey(
  contributions: ScoreContribution[]
): { key: string; points: number }[] {
  const byKey = new Map<string, number>();
  for (const c of contributions) {
    byKey.set(c.key, (byKey.get(c.key) ?? 0) + c.points);
  }
  return [...byKey.entries()]
    .map(([key, points]) => ({ key, points: Math.round(points * 10) / 10 }))
    .filter((it) => Math.abs(it.points) >= 0.05)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
}

function signedPoints(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

// Visual clamp for the diverging skill pillar: a raw swing of this many points deflects the fill
// fully to one edge. Chosen for feel, not a hard score bound (the true bounds live in the
// server-only scorer). +4 skill therefore reads as a small nudge above center.
const METER_RANGE = 20;

function signedLabel(n: number): string {
  if (n === 0) return "±0";
  return n > 0 ? `+${n}` : `${n}`;
}

// Shared track styling: every pillar well is a flat zinc-100 light / zinc-900 dark surface,
// bordered one shade off. Fills are solid colors wherever their color appears.
const TRACK =
  "rounded-lg border border-zinc-300 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900";
const FILL_BLUE = "bg-blue-500";
const FILL_AMBER = "bg-amber-500";
const FILL_ZINC = "bg-zinc-500";
const FILL_BASE = "bg-green-500";
const FILL_OPENING = "bg-purple-500";

// Text + fill colors for a signed skill value: a gain reads blue, a penalty amber, zero neutral zinc.
function axisStyle(value: number) {
  if (value > 0)
    return { tone: "text-blue-600 dark:text-blue-400", fill: FILL_BLUE };
  if (value < 0)
    return { tone: "text-amber-600 dark:text-amber-400", fill: FILL_AMBER };
  return { tone: "text-zinc-500 dark:text-zinc-400", fill: FILL_ZINC };
}

// The ring that tints a pillar on hover/active, keyed to that pillar's own fill color so the
// highlight reads as "this green/purple/blue/yellow one" rather than a neutral selection.
const PILLAR_RING: Record<string, { active: string; hover: string }> = {
  base: {
    active: "ring-green-500 dark:ring-green-400",
    hover: "group-hover:ring-green-300 dark:group-hover:ring-green-600",
  },
  opening: {
    active: "ring-purple-500 dark:ring-purple-400",
    hover: "group-hover:ring-purple-300 dark:group-hover:ring-purple-600",
  },
  skill: {
    active: "ring-blue-500 dark:ring-blue-400",
    hover: "group-hover:ring-blue-300 dark:group-hover:ring-blue-600",
  },
};

// Marks a section as a cascade step. It starts transparent only when the cascade is actually going
// to run, so a slide that renders with the intro already spent is visible on its first paint.
function useCascadeStep(): { "data-cascade": true; className: string } {
  return {
    "data-cascade": true,
    className: useRecapIntro() ? "opacity-0" : "",
  };
}

function ScoreHeader({ score, delay }: { score: number; delay: number }) {
  const plays = useRecapIntro();
  return (
    <span className="leading-none tabular-nums">
      <Odometer
        value={score}
        delay={delay}
        duration={900}
        animate={plays}
        className="text-6xl font-extrabold"
      />
      <span className="text-accent text-lg font-medium"> / 100</span>
    </span>
  );
}

// One line of a score ledger: a labeled additive/subtractive component, its signed points tinted
// green for a credit and amber for a cost. Shared by every pillar's breakdown.
function LedgerLine({
  label,
  points,
  max,
  percent,
}: {
  label: string;
  points: number;
  max?: number;
  percent?: string;
}) {
  const tone =
    points > 0
      ? "text-green-600 dark:text-green-400"
      : points < 0
        ? "text-amber-600 dark:text-amber-400"
        : "text-zinc-500 dark:text-zinc-400";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-accent">{label}</span>
      <span className="tabular-nums">
        {percent != null ? (
          // A graded-opener line reads as its criterion percentage, not a raw point count.
          <span className={`font-bold ${tone}`}>{percent}</span>
        ) : (
          <>
            <span className={`font-bold ${tone}`}>{signedPoints(points)}</span>
            {max != null && (
              <span className="text-zinc-400 dark:text-zinc-500"> / {max}</span>
            )}
          </>
        )}
      </span>
    </div>
  );
}

// One line in a pillar's expandable breakdown. `max` is the ceiling for graded opener items, so the
// line can read "+3/10"; absent for structural and skill lines that have no fixed maximum.
interface BreakdownLine {
  label: string;
  points: number;
  max?: number;
  // Set for graded-opener lines: the criterion percentage shown in place of the raw point count.
  percent?: string;
}

// A pillar's data: an additive credit (base, opening) fills bottom-up on a 0-100 scale; the diverging
// skill axis fills out from the center tick, up for a gain and down for a penalty.
type Pillar =
  | {
    kind: "additive";
    key: string;
    label: string;
    value: number;
    fill: string;
    lines: BreakdownLine[];
  }
  | {
    kind: "diverging";
    key: string;
    label: string;
    value: number;
    axis: "skill";
    lines: BreakdownLine[];
  };

const TRACK_HEIGHT = 132;

// The fill for one pillar's track. Additive fills grow up from the floor to `value` percent;
// diverging fills grow out from the center line, their height the magnitude clamped to METER_RANGE.
function PillarFill({ pillar, delay }: { pillar: Pillar; delay: number }) {
  if (pillar.kind === "additive") {
    const height = Math.max(0, Math.min(100, pillar.value));
    return (
      <AdditiveFill
        height={height}
        fill={pillar.fill}
        delay={delay}
      />
    );
  }
  const { fill } = axisStyle(pillar.value);
  const clamped = Math.max(-1, Math.min(1, pillar.value / METER_RANGE));
  const mag = Math.abs(clamped) * 50;
  return (
    <DivergingFill
      fill={fill}
      mag={mag}
      negative={pillar.value < 0}
      delay={delay}
    />
  );
}

function AdditiveFill({
  height,
  fill,
  delay,
}: {
  height: number;
  fill: string;
  delay: number;
}) {
  const ref = useColumnFill(height, delay);
  return (
    <span
      ref={ref}
      className={`absolute inset-x-0 bottom-0 rounded-[5px] ${fill}`}
      style={{ height: 0 }}
    />
  );
}

function DivergingFill({
  fill,
  mag,
  negative,
  delay,
}: {
  fill: string;
  mag: number;
  negative: boolean;
  delay: number;
}) {
  const ref = useColumnMeterFill(negative, delay);
  return (
    <>
      <span className="absolute inset-x-1 top-1/2 -translate-y-1/2 border-t-2 border-dotted border-zinc-500 dark:border-zinc-400" />
      <span
        ref={ref}
        className={`absolute inset-x-0 rounded-[5px] ${fill}`}
        style={
          negative
            ? { top: "50%", height: `${mag}%` }
            : { bottom: "50%", height: `${mag}%` }
        }
      />
    </>
  );
}

// A single pillar: its track + fill, and beneath it the animated value and label. The whole pillar
// is the toggle for its breakdown, so the bar, the number, and the label are one click target.
function PillarColumn({
  pillar,
  open,
  onToggle,
  delay,
}: {
  pillar: Pillar;
  open: boolean;
  onToggle: () => void;
  delay: number;
}) {
  const plays = useRecapIntro();
  const tone =
    pillar.kind === "diverging"
      ? axisStyle(pillar.value).tone
      : "text-zinc-900 dark:text-zinc-100";
  const ring = PILLAR_RING[pillar.key] ?? {
    active: "ring-zinc-400 dark:ring-zinc-500",
    hover: "group-hover:ring-zinc-300 dark:group-hover:ring-zinc-600",
  };
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${pillar.label} breakdown`}
      className="group flex cursor-pointer flex-col items-center gap-2.5 focus:outline-none"
    >
      <span
        className={`relative w-full overflow-hidden transition-shadow ${TRACK} ${open ? `ring-2 ${ring.active}` : `group-hover:ring-2 ${ring.hover}`
          }`}
        style={{ height: TRACK_HEIGHT }}
      >
        <PillarFill
          pillar={pillar}
          delay={delay}
        />
      </span>
      <span className="flex flex-col items-center gap-0.5">
        <Odometer
          value={pillar.value}
          delay={delay}
          format={pillar.kind === "diverging" ? signedLabel : undefined}
          animate={plays}
          className={`text-base font-bold tabular-nums ${tone}`}
        />
        <span className="section-label">{pillar.label}</span>
      </span>
    </button>
  );
}

// The breakdown that drops open beneath the pillar row for the selected pillar. It animates height
// via a 0fr<->1fr grid-rows transition (to the content's natural height, no fixed pixel value).
function PillarBreakdown({ pillar }: { pillar: Pillar | null }) {
  const axisEnds =
    pillar?.kind === "diverging" ? AXIS_END_LABELS[pillar.axis] : null;
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-out ${pillar ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
    >
      <div className="overflow-hidden">
        <div className="mt-4 flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          {pillar && (
            <>
              <div className="flex items-baseline justify-between">
                <span className="section-label">{pillar.label}</span>
                <span className="text-accent text-xs font-bold tabular-nums">
                  {pillar.kind === "diverging"
                    ? signedLabel(pillar.value)
                    : pillar.value}
                </span>
              </div>
              {pillar.lines.length > 0 ? (
                pillar.lines.map((line, i) => (
                  <LedgerLine
                    key={i}
                    label={line.label}
                    points={line.points}
                    max={line.max}
                    percent={line.percent}
                  />
                ))
              ) : (
                <p className="text-accent text-xs">
                  {axisEnds
                    ? `No swing this game (${axisEnds.low} to ${axisEnds.high}).`
                    : "Nothing to break down."}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Overview scorecard: the score out of 100, then one row of pillars for the components that build
 * it. Base and opening fill bottom-up on a 0-100 scale; skill diverges from a center line. Tapping
 * any pillar drops its itemized breakdown open below the row. `base + opening + skill === score` by
 * construction, so the pillars are exact, not an approximation. Luck is not here: how the board fell
 * is a separate fortune readout (see FortunePanel), never mixed into the score.
 */
export function OverviewScorePanel({
  score,
  base,
  baseLines,
  opening,
  openingLines,
  skill,
  contributions,
  guessCount,
}: {
  score: number;
  base: number;
  baseLines: FrameLine[];
  opening: number;
  openingLines: FrameLine[];
  skill: number;
  contributions: ScoreContribution[];
  guessCount: number;
}) {
  // The base is the bulk of every score, so its ledger opens by default and lifts in with the rest
  // of the cascade, showing a worked example of the breakdown the pillars toggle.
  const [openKey, setOpenKey] = useState<string | null>("base");
  const ref = useCascadeIn<HTMLDivElement>();
  const step = useCascadeStep();

  const skillItems = aggregateByKey(contributions);
  const hasOpening = opening !== 0 || openingLines.length > 0;

  const pillars: Pillar[] = [
    {
      kind: "additive",
      key: "base",
      label: "Base",
      value: base,
      fill: FILL_BASE,
      lines: baseLines.map((l) => ({
        label: frameLineLabel(l.key, {
          guessCount,
          points: l.points,
          max: l.max,
        }),
        points: l.points,
        max: l.max,
      })),
    },
    ...(hasOpening
      ? [
        {
          kind: "additive" as const,
          key: "opening",
          label: "Opener",
          value: opening,
          fill: FILL_OPENING,
          lines: openingLines.map((l) => ({
            label: frameLineLabel(l.key, {
              guessCount,
              points: l.points,
              max: l.max,
            }),
            points: l.points,
            max: l.max,
            // Graded-opener lines display their criterion percentage; the rounding crumb stays raw.
            percent: OPENER_GRADE_KEYS.has(l.key)
              ? (openerLinePercent(l.points, l.max) ?? undefined)
              : undefined,
          })),
        },
      ]
      : []),
    {
      kind: "diverging",
      key: "skill",
      label: "Skill",
      value: skill,
      axis: "skill",
      lines: skillItems.map((it) => ({
        label: contributionLabel(it.key, it.points),
        points: it.points,
      })),
    },
  ];

  const openPillar = pillars.find((p) => p.key === openKey) ?? null;

  return (
    <div
      ref={ref}
      className="flex flex-col gap-4"
    >
      <div {...step}>
        <ScoreHeader
          score={score}
          delay={contentDelay(0)}
        />
      </div>
      <div {...step}>
        <p className="text-accent text-sm leading-snug">
          Your score is a{" "}
          <span className="font-semibold text-green-600 dark:text-green-400">
            base
          </span>{" "}
          for solving plus what your{" "}
          <span className="font-semibold text-purple-600 dark:text-purple-400">
            opener
          </span>{" "}
          earned, nudged by the{" "}
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            skill
          </span>{" "}
          of
          every guess after. Tap a pillar to see what drove it.
        </p>
      </div>
      <div {...step}>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${pillars.length}, minmax(0, 1fr))`,
            }}
          >
            {pillars.map((pillar, i) => (
              <PillarColumn
                key={pillar.key}
                pillar={pillar}
                open={openKey === pillar.key}
                onToggle={() =>
                  setOpenKey((k) => (k === pillar.key ? null : pillar.key))
                }
                delay={contentDelay(2) + i * 120}
              />
            ))}
          </div>
          <PillarBreakdown pillar={openPillar} />
        </div>
      </div>
    </div>
  );
}
