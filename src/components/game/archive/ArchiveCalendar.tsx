import { ChevronLeft, ChevronRight } from "lucide-react";
import ArchiveDayCell from "./ArchiveDayCell";
import type { CalendarCell } from "./useArchiveCalendar";

interface ArchiveCalendarProps {
  monthLabel: string;
  cells: CalendarCell[];
  // True while the month's per-day status is still loading; the grid renders
  // immediately and the cells show a neutral skeleton until it resolves.
  loading: boolean;
  selectedDate: string | null;
  onSelect: (date: string) => void;
  onPrefetch: (date: string) => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default function ArchiveCalendar({
  monthLabel,
  cells,
  loading,
  selectedDate,
  onSelect,
  onPrefetch,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}: ArchiveCalendarProps) {
  // Month arrows share the raised-surface button system used by the mode tabs.
  // Disabled arrows fall back to the grayed-out `surface-absent` so they read as
  // inert without a bespoke opacity/color stack. Gradient surfaces hide a hover
  // background, so hover feedback rides brightness.
  const arrowBase =
    "grid size-[30px] place-items-center rounded-[10px] transition-all";
  const arrowEnabled =
    "surface-raised cursor-pointer text-zinc-600 hover:brightness-95 dark:text-zinc-300 dark:hover:brightness-110";
  const arrowDisabled =
    "surface-absent cursor-default text-zinc-400! dark:text-zinc-500!";
  const prevClass = `${arrowBase} ${canGoPrev ? arrowEnabled : arrowDisabled}`;
  const nextClass = `${arrowBase} ${canGoNext ? arrowEnabled : arrowDisabled}`;

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoPrev}
          aria-label="Previous month"
          className={prevClass}
        >
          <ChevronLeft className="size-[15px]" strokeWidth={2.4} />
        </button>
        <div className="text-base font-bold tabular-nums tracking-tight">
          {monthLabel}
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label="Next month"
          className={nextClass}
        >
          <ChevronRight className="size-[15px]" strokeWidth={2.4} />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-[7px]">
        {DOW.map((d, i) => (
          <span
            key={i}
            className="text-center font-mono text-[10.5px] font-semibold tracking-wider text-zinc-400"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[7px]">
        {cells.map((cell) =>
          cell.kind === "blank" ? (
            <div key={cell.key} className="aspect-square" />
          ) : (
            <ArchiveDayCell
              key={cell.key}
              cell={cell}
              loading={loading}
              isSelected={selectedDate === cell.date}
              onSelect={onSelect}
              onPrefetch={onPrefetch}
            />
          ),
        )}
      </div>
    </div>
  );
}
