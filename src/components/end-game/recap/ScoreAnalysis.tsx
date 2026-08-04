import { useGameRecap } from "./useGameRecap";
import { RecapCarousel } from "./RecapCarousel";

/**
 * Premium game recap carousel, shown once the user opens the analysis view.
 * Only premium users can reach this (the AnalyzeEntry CTA is non-interactive
 * for free users), and the analysis is computed server-side (game.getRecap),
 * so the gate is enforced there too.
 */
export function ScoreAnalysis({ isPremium }: { isPremium: boolean }) {
  const { recap, isLoading } = useGameRecap(isPremium);

  if (!recap) {
    // Prefetch (usePrefetchGameRecap) almost always warms the cache before the user reaches this
    // view, so this branch is a rare fallback for a fast click on a slow response. Reserve the
    // carousel's height so a cache miss animates in place instead of collapsing then expanding the
    // modal (the panel is content-sized up to max-h-90vh, so a one-line box would shrink it).
    if (isLoading)
      return (
        <div className="flex min-h-[60vh] flex-1 flex-col gap-4">
          <div className="scrollbar-thin min-h-0 flex-1 overflow-hidden pr-3">
            <div className="flex animate-pulse flex-col gap-4">
              <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-40 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-24 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-16 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
          <p className="text-accent shrink-0 text-center text-xs">
            Analyzing your game...
          </p>
        </div>
      );
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RecapCarousel slides={recap.slides} />
    </div>
  );
}
