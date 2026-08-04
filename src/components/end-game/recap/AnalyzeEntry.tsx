import { ChevronRight, Crown, Sparkles } from "lucide-react";

/**
 * Call-to-action beneath the stats grid that opens the Coach analysis view.
 * Free users see a gold crown hint; tapping through still reveals the premium teaser.
 */
export function AnalyzeEntry({
  isPremium,
  onOpen,
}: {
  isPremium: boolean;
  onOpen: () => void;
}) {
  if (!isPremium) {
    return (
      <div className="endgame-section-raised flex w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-2">
          <span className="coach-icon !bg-zinc-100 dark:!bg-zinc-800 border border-yellow-400">
            <Crown className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          </span>
          <span className="text-sm font-medium">
            Unlock comprehensive analysis of your play with a Grammble Premium subscription.
          </span>
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="endgame-section-raised flex w-full cursor-pointer items-center justify-between gap-3 text-left transition-transform"
    >
      <span className="flex items-center gap-2">
        <span className="coach-icon !bg-zinc-100 dark:!bg-zinc-800 border border-yellow-400">
          <Sparkles className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        </span>
        <span className="text-sm font-medium">
          Analyze your game with the Grammble bot
        </span>
      </span>
      <ChevronRight className="text-accent h-4 w-4 shrink-0" />
    </button>
  );
}
