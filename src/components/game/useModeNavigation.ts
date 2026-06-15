import { useNavigate } from "@tanstack/react-router";
import { MODE_ROUTE_BY_MODE, type GameMode } from "~/utils/game/constants";
import { useAppDialogStore } from "~/hooks/useAppDialog";

// Shared lock + navigation logic for the mode selectors. A locked (premium)
// mode surfaces the upsell instead of navigating; the active mode is a no-op.
//
// `onLeave` lets a host that is itself a modal (e.g. the end-game dialog) close
// before the upsell opens. Without it, the upsell's portal marks the still-open
// host dialog `inert`/`aria-hidden` while it retains focus, which Headless UI
// (correctly) flags as an accessibility violation.
export function useModeNavigation(
  current: GameMode,
  isPremium: boolean,
  onLeave?: () => void,
) {
  const navigate = useNavigate();
  const openUpsell = useAppDialogStore((s) => s.open);

  const isLocked = (mode: GameMode) => mode !== "SIX" && !isPremium;

  const handleClick = (mode: GameMode) => {
    if (mode === current) return;

    // Drop focus first so the host dialog isn't left holding focus on a subtree
    // the upsell is about to hide from assistive tech.
    if (typeof document !== "undefined") {
      (document.activeElement as HTMLElement | null)?.blur();
    }
    onLeave?.();

    if (isLocked(mode)) {
      openUpsell("subscription", mode);
      return;
    }
    navigate({ to: MODE_ROUTE_BY_MODE[mode] });
  };

  return { isLocked, handleClick };
}
