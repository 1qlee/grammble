import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import Dialog from "~/components/ui/Dialog";
import ArchiveCalendar from "./archive/ArchiveCalendar";
import ArchiveDetailPanel from "./archive/ArchiveDetailPanel";
import ModeScoreTabs from "./ModeScoreTabs";
import { useArchiveCalendar } from "./archive/useArchiveCalendar";
import { useGameStore } from "~/stores/game-store";
import { archiveDayScoresQueryOptions } from "./archive/archiveQueries";
import { buildModeStatuses } from "./modeStatus";
import { GAME_MODES, type GameMode } from "~/utils/game/constants";
import type { ArchiveDayStatus } from "~/trpc/router";

interface ArchiveDialogProps {
  mode: GameMode;
  isPremium: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  // Invoked when a day's action button is pressed. The route/loader plumbing to
  // actually load a past puzzle into the board is a separate follow-up.
  onPlay?: (date: string, status: ArchiveDayStatus, mode: GameMode) => void;
}

export default function ArchiveDialog({
  mode,
  isPremium,
  isOpen,
  setIsOpen,
  onPlay,
}: ArchiveDialogProps) {
  // The mode whose puzzles the archive is currently browsing. Seeded from the
  // board's mode and re-synced each time the dialog opens; the header tabs let
  // the user switch it in place (see `ModeScoreTabs`) so a past puzzle can be
  // set up to play in a different mode without leaving the dialog.
  const [selectedMode, setSelectedMode] = useState(mode);
  useEffect(() => {
    if (isOpen) setSelectedMode(mode);
  }, [isOpen, mode]);

  // Anchor the calendar to the puzzle currently on the board so the archive
  // opens on that date rather than always jumping to today.
  const currentDate = useGameStore((s) => s.date);

  // Live board result, used to override its own mode/date immediately. Neither
  // the frozen `dailies` context, the (invalidated but possibly mid-refetch)
  // archive-scores query, nor the month query reflects a game just finished this
  // session, so mirror ModeTabs and overlay the store status/score. The override
  // flows into the calendar cells (via the hook), the header tabs, and the score
  // band below.
  const boardStatus = useGameStore((s) => s.status);
  const boardScore = useGameStore((s) => s.score);
  const boardStarted = useGameStore((s) => s.currentGuessIndex > 0);
  // Don't override with IN_PROGRESS until a guess is in, so an untouched active
  // mode keeps its default state; a terminal result always reflects at once.
  const liveStatus =
    boardStatus === "IN_PROGRESS" && !boardStarted ? undefined : boardStatus;
  const liveOverride = useMemo(
    () =>
      liveStatus
        ? { mode, date: currentDate, status: liveStatus }
        : undefined,
    [liveStatus, mode, currentDate],
  );

  const cal = useArchiveCalendar(
    selectedMode,
    isOpen,
    currentDate,
    liveOverride,
  );
  const selectedIsBoardDate = cal.selectedDate === currentDate;

  // Today's per-mode results from the app-load context, used as the header tab
  // fallback while the selected day's scores load (and the common case, since
  // the calendar defaults its selection to today).
  const { dailies } = useRouteContext({ from: "__root__" });
  const todayScoreByMode = useMemo(() => {
    const map: Partial<Record<GameMode, number | null>> = {};
    for (const m of GAME_MODES) {
      const gs = dailies[m]?.gameState;
      if (gs && gs.status !== "IN_PROGRESS") map[m] = gs.score;
    }
    return map;
  }, [dailies]);

  // Per-mode scores for whichever day is selected in the calendar, so the header
  // tabs reflect that day's results across modes (not just today's).
  const { data: selectedScores } = useQuery({
    ...archiveDayScoresQueryOptions(cal.selectedDate ?? ""),
    enabled: isOpen && !!cal.selectedDate,
  });
  const isToday = cal.selectedDate === cal.today;

  // The score band pulls just the numeric score out of the selected day's
  // sessions (today falls back to the app-load context).
  const selectedScoreByMode = useMemo(() => {
    if (!selectedScores) return undefined;
    const map: Partial<Record<GameMode, number | null>> = {};
    for (const m of GAME_MODES) {
      const session = selectedScores[m];
      if (session) map[m] = session.score;
    }
    return map;
  }, [selectedScores]);
  const scoreByMode = useMemo(() => {
    const base = selectedScoreByMode ?? (isToday ? todayScoreByMode : {});
    // Overlay the live board score onto its own mode so a WON/LOST band shows
    // the right number on the same date the game was just played, rather than a
    // colored band with a stale/absent score.
    if (
      selectedIsBoardDate &&
      (boardStatus === "WON" || boardStatus === "LOST") &&
      boardScore !== null
    ) {
      return { ...base, [mode]: boardScore };
    }
    return base;
  }, [
    selectedScoreByMode,
    isToday,
    todayScoreByMode,
    selectedIsBoardDate,
    boardStatus,
    boardScore,
    mode,
  ]);

  // Keycap colors follow the full game state. For today, read `dailies` so
  // in-progress modes show yellow; for a past day the fetched sessions carry the
  // authoritative won/lost/in-progress status, and untouched modes read as open.
  const statusByMode = useMemo(
    () =>
      buildModeStatuses({
        isArchive: !isToday,
        dailies,
        archiveSessions: selectedScores,
        liveMode: selectedIsBoardDate ? mode : undefined,
        liveStatus: selectedIsBoardDate ? liveStatus : undefined,
      }),
    [isToday, dailies, selectedScores, selectedIsBoardDate, mode, liveStatus],
  );

  return (
    <Dialog isOpen={isOpen} setIsOpen={setIsOpen}>
      <div className="p-5 pt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-extrabold tracking-tight">
            Past puzzles
          </h2>
          <ModeScoreTabs
            current={selectedMode}
            isPremium={isPremium}
            scoreByMode={scoreByMode}
            statusByMode={statusByMode}
            onLeave={() => setIsOpen(false)}
            onSelectMode={setSelectedMode}
          />
        </div>

        {cal.error ? (
          <p className="py-8 text-center text-sm text-accent">{cal.error}</p>
        ) : (
          <>
            {/* The grid structure is known from the view month alone, so it
                renders immediately; only the per-day status fills in once the
                fetch resolves (see `loading`), avoiding a spinner-to-grid pop. */}
            <ArchiveCalendar
              monthLabel={cal.monthLabel}
              cells={cal.cells}
              loading={cal.loading}
              selectedDate={cal.selectedDate}
              onSelect={cal.selectDate}
              onPrefetch={cal.prefetchPuzzle}
              canGoPrev={cal.canGoPrev}
              canGoNext={cal.canGoNext}
              onPrev={cal.goPrevMonth}
              onNext={cal.goNextMonth}
            />

            <ArchiveDetailPanel
              day={cal.selectedDay}
              today={cal.today}
              onPlay={
                onPlay
                  ? (date, status) => onPlay(date, status, selectedMode)
                  : undefined
              }
            />
          </>
        )}
      </div>
    </Dialog>
  );
}
