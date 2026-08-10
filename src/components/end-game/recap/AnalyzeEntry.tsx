import { ChevronRight, Crown, Sparkles } from "lucide-react";
import { useAppDialogStore } from "~/hooks/useAppDialog";

/**
 * Call-to-action beneath the stats grid that opens the Coach analysis view.
 * Free users see a gold crown hint that opens the subscription upsell dialog.
 */
export function AnalyzeEntry({
  isPremium,
  onOpen,
}: {
  isPremium: boolean;
  onOpen: () => void;
}) {
  const openAppDialog = useAppDialogStore((s) => s.open);

  if (!isPremium) {
    return (
      <button
        type="button"
        onClick={() => openAppDialog("subscription")}
        className="endgame-section-gold flex w-full cursor-pointer items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="coach-icon !bg-white/70 border border-yellow-500">
            <Crown className="h-4 w-4 fill-yellow-500 text-yellow-500" />
          </span>
          <span className="text-sm font-medium text-zinc-900">
            Unlock comprehensive analysis of your play with a Grammble Premium subscription.
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-yellow-800" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="endgame-section-gold flex w-full cursor-pointer items-center justify-between gap-3 text-left"
    >
      <span className="flex items-center gap-2">
        <span className="coach-icon !bg-white/70 border border-yellow-500">
          <Sparkles className="h-4 w-4 fill-yellow-500 text-yellow-500" />
        </span>
        <span className="text-sm font-medium text-zinc-900">
          Analyze your game with the Grammble bot
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-yellow-800" />
    </button>
  );
}
