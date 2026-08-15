import type { LuckResult, LuckTier } from "~/utils/game/recap";
import { LUCK_TIER_BLURBS, LUCK_TIER_LABELS } from "./skillLuck.constants";

// Fortune (luck) is measured independently of the score: holding the player's guesses fixed, did the
// hidden answer fall to them more or less kindly than an average draw (see luck.ts). This panel is
// pure colour commentary and states outright that it does not touch the score. It shows a coarse
// five-step tier, NOT a percentile: the tiers rest on a synthetic distribution, so a precise "you
// beat N% of players" number would be a comparison against a model, not real people.

// The five tiers, unluckiest to luckiest, matching the segmented gauge left to right.
const TIER_ORDER: readonly LuckTier[] = [
  "very-unlucky",
  "unlucky",
  "average",
  "lucky",
  "very-lucky",
];

// Headline tint per tier: lucky reads green, unlucky amber, an average draw stays neutral zinc.
function toneFor(tier: LuckTier): string {
  if (tier === "very-lucky" || tier === "lucky")
    return "text-green-600 dark:text-green-400";
  if (tier === "very-unlucky" || tier === "unlucky")
    return "text-amber-600 dark:text-amber-400";
  return "text-zinc-600 dark:text-zinc-300";
}

// Fill for the lit segment, keyed to the same green/zinc/amber split as the headline. Solid color
// (matching the flat score pillars).
function activeFill(tier: LuckTier): string {
  if (tier === "very-lucky" || tier === "lucky")
    return "bg-green-500";
  if (tier === "very-unlucky" || tier === "unlucky")
    return "bg-amber-500";
  return "bg-zinc-500";
}

/**
 * The fortune readout for the overview slide: a tier headline, a five-step gauge with the game's
 * tier lit, and one line on what the board did. It is deliberately walled off from the score panel,
 * both visually and in copy, so luck reads as "how the board fell", never as points earned or lost,
 * and never as a rank against other players.
 */
export function FortunePanel({ luck }: { luck: LuckResult }) {
  const label = LUCK_TIER_LABELS[luck.tier];
  const blurb = LUCK_TIER_BLURBS[luck.tier];
  const tone = toneFor(luck.tier);
  const fill = activeFill(luck.tier);
  const activeIndex = TIER_ORDER.indexOf(luck.tier);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between gap-2">
        <span className="section-label">Fortune</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          Doesn't affect your score
        </span>
      </div>
      <span className={`text-2xl font-extrabold ${tone}`}>{label}</span>
      <div className="flex flex-col gap-1">
        <div
          className="flex gap-1"
          role="img"
          aria-label={`Fortune: ${label}`}
        >
          {TIER_ORDER.map((tier, i) => (
            <span
              key={tier}
              className={`h-2 flex-1 rounded-full ${
                i === activeIndex ? fill : "bg-zinc-200 dark:bg-zinc-800"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
          <span>Unlucky</span>
          <span>Lucky</span>
        </div>
      </div>
      <p className="text-accent text-sm leading-snug">{blurb}</p>
    </div>
  );
}
