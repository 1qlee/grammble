import { Check } from "lucide-react";
import type { CalendarCell } from "./useArchiveCalendar";
import type { ArchiveDayStatus } from "~/trpc/router";
import {
  STATUS_BORDER,
  STATUS_SELECTED,
  STATUS_SURFACE,
} from "../statusSurfaces.constants";

interface ArchiveDayCellProps {
  cell: Extract<CalendarCell, { kind: "day" }>;
  // The month's status is still loading; non-future days render as a neutral
  // skeleton rather than the "no puzzle" inert look, so they don't flash from
  // inert to interactive once the data arrives.
  loading: boolean;
  isSelected: boolean;
  onSelect: (date: string) => void;
  onPrefetch: (date: string) => void;
}

// Same depressed surface gated behind :active for the press feedback on
// unselected cells. Local to the calendar (the tabs don't use press feedback).
// Spelled out as full literals so Tailwind's scanner emits the active-variant
// rules (it can't see dynamically concatenated classes).
const ACTIVE_DEPRESSED_CLASS: Record<ArchiveDayStatus, string> = {
  OPEN: "active:surface-raised-depressed",
  IN_PROGRESS: "active:surface-yellow-depressed",
  WON: "active:surface-green-depressed",
  LOST: "active:surface-red-depressed",
};

export default function ArchiveDayCell({
  cell,
  loading,
  isSelected,
  onSelect,
  onPrefetch,
}: ArchiveDayCellProps) {
  const base =
    "relative grid aspect-square w-full place-items-center rounded-[14px_/_11px] border font-mono text-sm font-semibold tabular-nums";

  // Future dates are always inert and dashed; their state is known without the
  // fetch, so they never show the loading skeleton.
  if (cell.isFuture) {
    return (
      <div
        className={`${base} border-dashed border-zinc-200 bg-zinc-50 text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-700`}
      >
        <span>{cell.day}</span>
      </div>
    );
  }

  // Past/today cells whose status hasn't resolved yet: neutral skeleton so the
  // grid layout is stable and only the surface color fills in on load.
  if (loading && !cell.playable) {
    return (
      <div
        className={`${base} animate-pulse border-zinc-100 bg-zinc-100 text-zinc-300 dark:border-zinc-800/60 dark:bg-zinc-800/40 dark:text-zinc-700`}
      >
        <span>{cell.day}</span>
      </div>
    );
  }

  // Resolved past date with no puzzle: inert.
  if (!cell.playable) {
    return (
      <div
        className={`${base} border-zinc-100 bg-zinc-50 text-zinc-300 dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:text-zinc-700`}
      >
        <span>{cell.day}</span>
      </div>
    );
  }

  const status = cell.data!.status;
  const shiftNum =
    status === "IN_PROGRESS" || status === "LOST" || status === "WON";

  // The selected cell gets a same-family, darker border so it's clear which day
  // is open. The `!` wins over the border color the surface-* utilities set,
  // since both are single-class utilities in the same layer.
  const emphasisBorder = isSelected ? STATUS_BORDER[status] : "";
  // Won days bold their number; the shared surface map carries color only.
  const wonBold = status === "WON" ? "font-bold" : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(cell.date)}
      onMouseEnter={() => onPrefetch(cell.date)}
      onFocus={() => onPrefetch(cell.date)}
      aria-label={`Puzzle for day ${cell.day}`}
      aria-pressed={isSelected}
      className={`${base} cursor-pointer transition-all duration-100 ${emphasisBorder} ${STATUS_SURFACE[status]} ${wonBold} ${isSelected
        ? `${STATUS_SELECTED[status]}`
        : `hover:-translate-y-px active:translate-y-px ${ACTIVE_DEPRESSED_CLASS[status]}`
        }`}
    >
      <span className={shiftNum ? "-translate-y-[3px]" : undefined}>
        {cell.day}
      </span>

      {status === "IN_PROGRESS" && (
        <span className="absolute bottom-[5px] left-1/2 size-2 -translate-x-1/2 rounded-full bg-yellow-500 dark:bg-yellow-400" />
      )}
      {status === "WON" && (
        <Check
          className="absolute bottom-[3px] left-1/2 size-3.5 -translate-x-1/2 text-green-700 dark:text-green-300"
          strokeWidth={3}
        />
      )}
      {status === "LOST" && (
        <span className="absolute bottom-[2px] left-1/2 -translate-x-1/2 text-base font-extrabold leading-none text-red-700 dark:text-red-300">
          ×
        </span>
      )}
    </button>
  );
}
