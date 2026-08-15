import { useCallback, useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  archiveMonthQueryOptions,
  archivePuzzleQueryOptions,
} from "./archiveQueries";
import { getDateString } from "~/utils/game/daily-puzzle";
import type { GameMode } from "~/utils/game/constants";
import type { ArchiveData, ArchiveDay, ArchiveDayStatus } from "~/trpc/router";

// The live board result, overlaid onto its own day so a game just finished this
// session reflects in the calendar ahead of the invalidated month query's
// refetch. Applied only when the viewed mode matches and that day is present.
export type ArchiveLiveOverride = {
  mode: GameMode;
  date: string;
  status: ArchiveDayStatus;
};

function prevMonth(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1];
}

function nextMonth(year: number, month: number): [number, number] {
  return month === 12 ? [year + 1, 1] : [year, month + 1];
}

export type CalendarCell =
  | { kind: "blank"; key: string }
  | {
      kind: "day";
      key: string;
      day: number;
      date: string;
      isToday: boolean;
      isFuture: boolean;
      // Playable days are the only ones that have a puzzle on or before today.
      playable: boolean;
      data: ArchiveDay | null;
    };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Owns the archive calendar's view month, server data, and selection. Fetches
// through the archive server fn whenever the modal is open and the month moves.
// `anchorDate` is the date of the puzzle currently loaded on the board; the
// calendar opens to its month and defaults its selection to it (falling back to
// today when it is empty, e.g. before any puzzle has loaded).
export function useArchiveCalendar(
  mode: GameMode,
  isOpen: boolean,
  anchorDate: string,
  liveOverride?: ArchiveLiveOverride,
) {
  const today = useMemo(() => getDateString(), []);
  const [todayYear, todayMonth] = useMemo(() => {
    const [y, m] = today.split("-").map(Number);
    return [y, m] as const;
  }, [today]);

  // The day the calendar centers on. Prefer the loaded puzzle's date; before a
  // puzzle has loaded (empty date) fall back to today.
  const anchor = anchorDate || today;
  const [anchorYear, anchorMonth] = useMemo(() => {
    const [y, m] = anchor.split("-").map(Number);
    return [y, m] as const;
  }, [anchor]);

  const queryClient = useQueryClient();
  const [viewYear, setViewYear] = useState(anchorYear);
  const [viewMonth, setViewMonth] = useState(anchorMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Snap back to the anchor month and select the anchor day each time the modal
  // reopens. Set the selection directly (rather than clearing it and letting the
  // data effect below re-derive it): on a cache hit the month data reference is
  // unchanged, so that effect would not re-run and the selection would be lost.
  // The anchor is the loaded puzzle's date, so it is always a valid playable day.
  useEffect(() => {
    if (isOpen) {
      setViewYear(anchorYear);
      setViewMonth(anchorMonth);
      setSelectedDate(anchor);
    }
  }, [isOpen, anchor, anchorYear, anchorMonth]);

  const query = useQuery({
    ...archiveMonthQueryOptions(mode, viewYear, viewMonth),
    enabled: isOpen,
    // Hold the outgoing month's data while a new query key resolves. This keeps
    // a switched mode (same month) from flashing an empty grid and, crucially,
    // stops `selectedDay` from briefly going null mid-switch, which would tear
    // down the detail panel. Month navigation still shows the skeleton via the
    // `loading` guard below, since the placeholder is then a different month.
    placeholderData: keepPreviousData,
  });
  const data: ArchiveData | null = query.data ?? null;
  // The placeholder above can be a different month while navigating; treat the
  // grid as loading until the data actually matches the view being rendered so
  // the skeleton still shows on month changes (but not on a same-month switch).
  const isViewData =
    !!data && data.year === viewYear && data.month === viewMonth;
  const loading = query.isFetching && !isViewData;
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to load archive."
    : null;

  useEffect(() => {
    if (query.error) console.error("getArchive failed:", query.error);
  }, [query.error]);

  // Pick the selection whenever a month's data arrives (initial load, month
  // change, or a cache hit). Guard against stale data from a previous month
  // that may still be in `query.data` mid-transition.
  useEffect(() => {
    if (!data || data.year !== viewYear || data.month !== viewMonth) return;
    const dates = data.days.map((d) => d.date);
    // Keep a still-valid selection so switching mode (which refetches the same
    // month for the new mode) holds the chosen day. Otherwise prefer the
    // anchored day, falling back to the most recent playable day in the month.
    setSelectedDate((prev) =>
      prev && dates.includes(prev)
        ? prev
        : dates.includes(anchor)
          ? anchor
          : dates.length
            ? dates[dates.length - 1]
            : null,
    );
  }, [data, viewYear, viewMonth, anchor]);

  // Warm the cache for the adjacent months so navigating the calendar is
  // instant. Going back in time (older months) is the common path, so prefetch
  // the previous month whenever one exists; also prefetch the next month when
  // it is reachable (not yet at the current month).
  useEffect(() => {
    if (!isOpen || !data || data.year !== viewYear || data.month !== viewMonth) {
      return;
    }
    if (data.hasPrev) {
      const [py, pm] = prevMonth(viewYear, viewMonth);
      queryClient.prefetchQuery(archiveMonthQueryOptions(mode, py, pm));
    }
    const atCurrentMonth = viewYear === todayYear && viewMonth === todayMonth;
    if (!atCurrentMonth) {
      const [ny, nm] = nextMonth(viewYear, viewMonth);
      queryClient.prefetchQuery(archiveMonthQueryOptions(mode, ny, nm));
    }
  }, [
    isOpen,
    data,
    viewYear,
    viewMonth,
    mode,
    todayYear,
    todayMonth,
    queryClient,
  ]);

  // Warm the replay-puzzle cache so clicking Play loads the board instantly.
  // The route loader reads through the same cache (ensureQueryData), so a
  // prefetched day skips the fetch entirely on navigation.
  const prefetchPuzzle = useCallback(
    (date: string) => {
      queryClient.prefetchQuery(archivePuzzleQueryOptions(mode, date));
    },
    [queryClient, mode],
  );

  const daysByDate = useMemo(() => {
    const map = new Map<string, ArchiveDay>();
    data?.days.forEach((d) => map.set(d.date, d));
    // Overlay the live board result onto its own day (same mode only) so the
    // just-finished game's cell and detail reflect immediately, ahead of the
    // month query's refetch. Only override an existing day; a synthesized one
    // would lack the puzzle number/gram.
    if (liveOverride && liveOverride.mode === mode) {
      const day = map.get(liveOverride.date);
      if (day) map.set(day.date, { ...day, status: liveOverride.status });
    }
    return map;
  }, [data, liveOverride, mode]);

  const cells = useMemo<CalendarCell[]>(() => {
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
    const result: CalendarCell[] = [];
    for (let i = 0; i < firstWeekday; i++) {
      result.push({ kind: "blank", key: `b${i}` });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${viewYear}-${pad(viewMonth)}-${pad(day)}`;
      const dayData = daysByDate.get(date) ?? null;
      result.push({
        kind: "day",
        key: date,
        day,
        date,
        isToday: date === today,
        isFuture: date > today,
        playable: dayData !== null,
        data: dayData,
      });
    }
    return result;
  }, [viewYear, viewMonth, daysByDate, today]);

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth],
  );

  const canGoNext =
    viewYear < todayYear || (viewYear === todayYear && viewMonth < todayMonth);
  const canGoPrev = data?.hasPrev ?? false;

  const goPrevMonth = useCallback(() => {
    setViewYear((y) => (viewMonth === 1 ? y - 1 : y));
    setViewMonth((m) => (m === 1 ? 12 : m - 1));
  }, [viewMonth]);

  const goNextMonth = useCallback(() => {
    setViewYear((y) => (viewMonth === 12 ? y + 1 : y));
    setViewMonth((m) => (m === 12 ? 1 : m + 1));
  }, [viewMonth]);

  const selectedDay = selectedDate
    ? (daysByDate.get(selectedDate) ?? null)
    : null;

  // Prefetch the active selection's puzzle (covers the default pick and any
  // click/keyboard selection); hovering a cell warms it even earlier.
  useEffect(() => {
    if (selectedDate && daysByDate.has(selectedDate)) {
      prefetchPuzzle(selectedDate);
    }
  }, [selectedDate, daysByDate, prefetchPuzzle]);

  return {
    today,
    monthLabel,
    cells,
    loading,
    error,
    canGoPrev,
    canGoNext,
    goPrevMonth,
    goNextMonth,
    selectedDate,
    selectDate: setSelectedDate,
    selectedDay,
    prefetchPuzzle,
    monthSolvedCount: data?.monthSolvedCount ?? 0,
    currentStreak: data?.currentStreak ?? 0,
  };
}
