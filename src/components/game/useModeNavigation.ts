import { useNavigate } from "@tanstack/react-router";
import {
  MODE_ARCHIVE_ROUTE_BY_MODE,
  MODE_ROUTE_BY_MODE,
  type GameMode,
} from "~/utils/game/constants";
import { useAppDialogStore } from "~/hooks/useAppDialog";

// Shared lock + navigation logic for the mode selectors. A locked (premium)
// mode surfaces the upsell instead of navigating; the active mode is a no-op.
//
// `onLeave` lets a host that is itself a modal (e.g. the end-game dialog) close
// before the upsell opens. Without it, the upsell's portal marks the still-open
// host dialog `inert`/`aria-hidden` while it retains focus, which Headless UI
// (correctly) flags as an accessibility violation.
//
// `shouldKeepHostOpen` lets the host stay open across a navigation (e.g. the
// end-game dialog switching to an already-completed mode), where closing then
// reopening would be jarring. It does not apply to the upsell, which always
// requires the host to close first for the focus reason above.
//
// `archiveDate` marks the board as showing an archived puzzle for that date, so
// switching modes navigates to that same date's puzzle rather than today's daily.
export function useModeNavigation({
  current,
  isPremium,
  onLeave,
  shouldKeepHostOpen,
  archiveDate,
}: {
  current: GameMode;
  isPremium: boolean;
  onLeave?: () => void;
  shouldKeepHostOpen?: (mode: GameMode) => boolean;
  archiveDate?: string;
}) {
  const navigate = useNavigate();
  const openUpsell = useAppDialogStore((s) => s.open);

  const isLocked = (mode: GameMode) => mode !== "SIX" && !isPremium;

  const handleClick = (mode: GameMode) => {
    if (mode === current) return;

    if (isLocked(mode)) {
      // Drop focus first so the host dialog isn't left holding focus on a
      // subtree the upsell is about to hide from assistive tech.
      if (typeof document !== "undefined") {
        (document.activeElement as HTMLElement | null)?.blur();
      }
      onLeave?.();
      openUpsell("subscription", mode);
      return;
    }

    if (!shouldKeepHostOpen?.(mode)) {
      if (typeof document !== "undefined") {
        (document.activeElement as HTMLElement | null)?.blur();
      }
      onLeave?.();
    }
    if (archiveDate) {
      navigate({
        to: MODE_ARCHIVE_ROUTE_BY_MODE[mode],
        params: { date: archiveDate },
      });
      return;
    }
    navigate({ to: MODE_ROUTE_BY_MODE[mode] });
  };

  return { isLocked, handleClick };
}
