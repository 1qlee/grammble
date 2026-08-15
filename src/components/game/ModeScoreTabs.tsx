import { CirclePlay, Crown } from "lucide-react";
import {
  GAME_MODES,
  WORD_LENGTH_BY_MODE,
  type GameMode,
} from "~/utils/game/constants";
import type { ArchiveDayStatus } from "~/trpc/router";
import { useModeNavigation } from "./useModeNavigation";
import {
  STATUS_BORDER,
  STATUS_SELECTED,
  STATUS_SURFACE,
} from "./statusSurfaces.constants";

interface ModeScoreTabsProps {
  current: GameMode;
  isPremium: boolean;
  // Per-mode score for the shown puzzle, used only for the WON score band. A
  // loss also carries a numeric score, so this can't imply the keycap color.
  scoreByMode: Partial<Record<GameMode, number | null>>;
  // Per-mode game state driving the keycap color. This is the authoritative
  // source for won/lost/in-progress; a missing mode reads as OPEN (not played).
  statusByMode?: Partial<Record<GameMode, ArchiveDayStatus>>;
  // Called before a click navigates or opens the upsell, so the host dialog can
  // close itself first (see `useModeNavigation`).
  onLeave?: () => void;
  // When provided, selecting an unlocked mode calls this instead of navigating
  // to that mode's board. Used by the archive dialog, where the tabs choose
  // which mode a past puzzle will be played in rather than loading a game
  // immediately. Locked modes still fall through to the upsell.
  onSelectMode?: (mode: GameMode) => void;
  // When the host board is showing an archived puzzle, switching modes should
  // navigate to that same date's puzzle rather than today's daily. Forwarded to
  // `useModeNavigation`. Ignored when `onSelectMode` handles the click.
  archiveDate?: string;
}

// Keycap geometry scales off the shared `--tab-size`, with a 30px fallback for
// standalone use in the end-game dialog (where the scoreboard vars are unset).
const tileStyle = {
  width: "var(--tab-size, 30px)",
  height: "calc(var(--tab-size, 30px) * 1.4)",
  borderRadius: "calc(var(--tab-size, 30px) * 0.3)",
} as React.CSSProperties;

const numStyle = {
  fontSize: "var(--tab-font, 13px)",
} as React.CSSProperties;

const bandStyle = {
  height: "calc(var(--tab-size, 30px) * 0.5)",
  fontSize: "calc(var(--tab-font, 13px) * 0.72)",
} as React.CSSProperties;

export default function ModeScoreTabs({
  current,
  isPremium,
  scoreByMode,
  statusByMode,
  onLeave,
  onSelectMode,
  archiveDate,
}: ModeScoreTabsProps) {
  const { isLocked, handleClick: navigateToMode } = useModeNavigation({
    current,
    isPremium,
    onLeave,
    archiveDate,
    // Keep the end-game dialog open when switching to a mode that is already
    // completed; it just re-renders with that mode's results.
    shouldKeepHostOpen: (mode) => typeof scoreByMode[mode] === "number",
  });

  const handleClick = (mode: GameMode) => {
    if (mode === current) return;
    // Selection mode (archive): an unlocked tap just sets the active mode and
    // leaves the dialog open. Locked taps still fall through to the upsell.
    if (onSelectMode && !isLocked(mode)) {
      onSelectMode(mode);
      return;
    }
    navigateToMode(mode);
  };

  return (
    <div className="flex" style={{ gap: "calc(var(--tab-size, 30px) * 0.17)" }}>
      {GAME_MODES.map((mode) => {
        const locked = isLocked(mode);
        const active = mode === current;
        const modeScore = scoreByMode[mode];
        // Status is authoritative for the color; a loss carries a numeric score
        // too, so it can't be inferred from `modeScore`. Absent = not played.
        const modeStatus: ArchiveDayStatus = statusByMode?.[mode] ?? "OPEN";

        // Status color language shared with ModeTabs / the archive calendar. The
        // active keycap swaps its raised highlight for the matching depressed
        // companion so it reads as pushed in; gradient surfaces hide a hover
        // background, so hover feedback rides brightness instead.
        const surfaceClasses = locked
          ? "surface-raised text-zinc-500! opacity-60 hover:opacity-100 hover:brightness-95 dark:hover:brightness-110"
          : active
            ? `${STATUS_SURFACE[modeStatus]} ${STATUS_SELECTED[modeStatus]}`
            : `${STATUS_SURFACE[modeStatus]} opacity-60 hover:opacity-100 hover:brightness-95 dark:hover:brightness-110`;

        // Selected keycap border: same color family as its surface, a deeper
        // shade for contrast (see STATUS_BORDER). The selection ring is carried
        // by the `surface-*-selected` utility above.
        const activeBorder = active && !locked ? STATUS_BORDER[modeStatus] : "";

        const numClasses = locked
          ? "text-zinc-500"
          : modeStatus === "WON"
            ? "text-green-900 dark:text-green-50"
            : modeStatus === "LOST"
              ? "text-red-900 dark:text-red-50"
              : modeStatus === "IN_PROGRESS"
                ? "text-yellow-900 dark:text-yellow-50"
                : "text-zinc-700 dark:text-zinc-200";

        const stateLabel = locked
          ? " (premium)"
          : modeStatus === "WON"
            ? ` (${modeScore} pts)`
            : modeStatus === "LOST"
              ? " (failed)"
              : modeStatus === "IN_PROGRESS"
                ? " (in progress)"
                : " (not played)";

        return (
          <button
            key={mode}
            type="button"
            onClick={() => handleClick(mode)}
            aria-pressed={active}
            aria-label={`${WORD_LENGTH_BY_MODE[mode]}-letter mode${stateLabel}`}
            className={`relative flex cursor-pointer flex-col overflow-hidden border text-left transition-all duration-150 ${surfaceClasses} ${activeBorder}`}
            style={tileStyle}
          >
            <span
              className={`grid flex-1 place-items-center font-extrabold leading-none ${numClasses}`}
              style={numStyle}
            >
              {WORD_LENGTH_BY_MODE[mode]}
            </span>

            {locked ? (
              <span
                className="flex items-center justify-center border-t border-zinc-300/70 bg-black/5 text-yellow-400 dark:border-zinc-600/70 dark:bg-black/20"
                style={bandStyle}
              >
                <Crown className="h-2.5 w-2.5 fill-yellow-400" aria-hidden="true" />
              </span>
            ) : modeStatus === "WON" ? (
              <span className="flex items-center justify-center gap-px bg-green-900/20 font-bold text-green-100 tabular-nums leading-none dark:bg-black/20" style={bandStyle} > {modeScore}</span>
            ) : modeStatus === "LOST" ? (
              <span className="flex items-center justify-center gap-px bg-red-900/20 font-bold text-red-100 tabular-nums leading-none dark:bg-black/20" style={bandStyle} > {modeScore}</span>
            ) : modeStatus === "IN_PROGRESS" ? (
              <span className="flex items-center justify-center bg-yellow-900/20 text-yellow-100 dark:bg-black/20" style={bandStyle}>
                <CirclePlay className="h-2.5 w-2.5" aria-hidden="true" />
              </span>
            ) : (
              <span
                className="flex items-center justify-center bg-black/5 text-zinc-400 dark:bg-white/5 dark:text-zinc-500"
                style={bandStyle}
              >
                <CirclePlay className="h-2.5 w-2.5" aria-hidden="true" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
