import { useMemo } from "react";
import { Circle, CircleCheck, CircleX, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import {
  GAME_MODES,
  WORD_LENGTH_BY_MODE,
  type GameMode,
} from "~/utils/game/constants";
import StackedLabel from "~/components/ui/StackedLabel";
import { useGameStore } from "~/stores/game-store";
import { useModeNavigation } from "./useModeNavigation";
import { archiveDayScoresQueryOptions } from "./archive/archiveQueries";
import { buildModeStatuses } from "./modeStatus";
import {
  STATUS_BORDER,
  STATUS_SELECTED,
  STATUS_SURFACE,
} from "./statusSurfaces.constants";

interface ModeTabsProps {
  current: GameMode;
  isPremium: boolean;
  showLabel?: boolean;
}

// Pip size/typography ride the shared scoreboard scale vars so the pips track
// the tile grid.
const pipStyle = {
  width: "var(--tab-size, 30px)",
  height: "var(--tab-size, 30px)",
  borderRadius: "calc(var(--tab-size, 30px) * 0.3)",
  fontSize: "var(--tab-font, 13px)",
} as React.CSSProperties;

export default function ModeTabs({
  current,
  isPremium,
  showLabel = true,
}: ModeTabsProps) {
  const status = useGameStore((s) => s.status);
  // A fresh game is "IN_PROGRESS" from load, so gate the live override on an
  // actual submitted guess; otherwise the untouched active tab reads as
  // in-progress (yellow) instead of its default state.
  const hasStarted = useGameStore((s) => s.currentGuessIndex > 0);
  // On a loaded archived puzzle, switching modes should stay on that puzzle's
  // date rather than jumping to today's daily.
  const isArchive = useGameStore((s) => s.isArchive);
  const boardDate = useGameStore((s) => s.date);
  const { isLocked, handleClick } = useModeNavigation({
    current,
    isPremium,
    archiveDate: isArchive ? boardDate : undefined,
  });
  // Per-mode completion comes from the app-load context. The active mode is
  // overridden with the live store status so a game finished this session
  // reflects immediately rather than the stale load-time state.
  const { dailies } = useRouteContext({ from: "__root__" });

  // On an archived board the tabs must reflect that specific date's sessions,
  // not today's. The daily route context only knows today's games, so fetch the
  // archived date's per-mode terminal scores instead (mirrors EndGameDialog).
  // Archive access is premium-only, so `isArchive` implies an authed user.
  const { data: archiveDayScores } = useQuery({
    ...archiveDayScoresQueryOptions(boardDate),
    enabled: isArchive,
  });

  // Per-mode game state in the shared OPEN/IN_PROGRESS/WON/LOST language, with
  // the active mode overridden by the live store status so a game played this
  // session reflects immediately rather than the load-time state.
  const statusByMode = useMemo(
    () =>
      buildModeStatuses({
        isArchive,
        dailies,
        archiveSessions: archiveDayScores,
        liveMode: current,
        // Don't override with IN_PROGRESS until a guess is in; a terminal result
        // (WON/LOST) always reflects immediately.
        liveStatus:
          status === "IN_PROGRESS" && !hasStarted ? undefined : status,
      }),
    [isArchive, archiveDayScores, dailies, status, hasStarted, current],
  );

  return (
    <div
      className="inline-flex flex-col items-center"
      style={{ gap: "var(--sb-label-gap)" }}
    >
      {showLabel && <StackedLabel>Mode</StackedLabel>}

      <div
        className="flex items-center"
        style={{
          gap: "calc(var(--tab-size, 30px) * 0.17)",
          height: "var(--sb-gram-h)",
        }}
      >
        {GAME_MODES.map((mode) => {
          const locked = isLocked(mode);
          const active = mode === current;
          const modeStatus = statusByMode[mode] ?? "OPEN";

          // Tabs share the status color language (see statusSurfaces). Locked
          // tabs keep the neutral raised surface with muted text. The active tab
          // swaps its raised highlight for the matching depressed companion so
          // it reads as pushed in. Gradient surfaces hide a hover
          // background-color, so hover feedback rides brightness instead.
          const surfaceClasses = locked
            ? "surface-raised text-zinc-500! opacity-60 hover:opacity-100 hover:brightness-95 dark:hover:brightness-110"
            : active
              ? `${STATUS_SURFACE[modeStatus]} ${STATUS_SELECTED[modeStatus]}`
              : `${STATUS_SURFACE[modeStatus]} opacity-60 hover:opacity-100 hover:brightness-95 dark:hover:brightness-110`;

          // Selected pip: same-family border in a deeper shade than its surface
          // fill for contrast (see STATUS_BORDER). The selection ring is carried
          // by the `surface-*-selected` utility above.
          const activeBorder = active && !locked ? STATUS_BORDER[modeStatus] : "";

          const stateLabel = locked
            ? " (premium)"
            : modeStatus === "WON"
              ? " (won)"
              : modeStatus === "LOST"
                ? " (lost)"
                : modeStatus === "IN_PROGRESS"
                  ? " (in progress)"
                  : "";

          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleClick(mode)}
              aria-pressed={active}
              aria-label={`${WORD_LENGTH_BY_MODE[mode]}-letter mode${stateLabel}`}
              className={`relative grid cursor-pointer place-items-center border font-bold leading-none transition-all duration-150 ${surfaceClasses} ${activeBorder}`}
              style={pipStyle}
            >
              {WORD_LENGTH_BY_MODE[mode]}
              {locked && (
                <span className="absolute -top-1 -right-1 flex rounded-full bg-white p-px text-yellow-400 dark:bg-zinc-900">
                  <Crown
                    className="h-2.5 w-2.5 fill-yellow-400"
                    aria-hidden="true"
                  />
                </span>
              )}
              {!locked && modeStatus === "WON" && (
                <span className="absolute -top-1 -right-1 flex rounded-full bg-white p-px text-green-600 dark:bg-zinc-900">
                  <CircleCheck
                    className="h-2.5 w-2.5 fill-green-500 text-white dark:text-zinc-900"
                    aria-hidden="true"
                  />
                </span>
              )}
              {!locked && modeStatus === "LOST" && (
                <span className="absolute -top-1 -right-1 flex rounded-full bg-white p-px text-red-600 dark:bg-zinc-900">
                  <CircleX
                    className="h-2.5 w-2.5 fill-red-500 text-white dark:text-zinc-900"
                    aria-hidden="true"
                  />
                </span>
              )}
              {!locked && modeStatus === "IN_PROGRESS" && (
                <span className="absolute -top-1 -right-1 flex rounded-full bg-white p-px text-yellow-500 dark:bg-zinc-900">
                  <Circle
                    className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400"
                    aria-hidden="true"
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
