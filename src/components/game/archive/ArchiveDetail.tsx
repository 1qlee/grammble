import { Play, SearchCheck } from "lucide-react";
import Button from "~/components/buttons/Button";
import type { ArchiveDay, ArchiveDayStatus } from "~/trpc/router";

interface ArchiveDetailProps {
  day: ArchiveDay;
  isToday: boolean;
  onPlay?: (date: string, status: ArchiveDayStatus) => void;
}

function parseDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const STATE_META: Record<
  ArchiveDayStatus,
  {
    label: string;
    dot: string;
    card: string;
    accent: string;
    action: string;
    variant: "gold" | "green" | "yellow" | "red";
    gold: boolean;
  }
> = {
  OPEN: {
    label: "Not started",
    dot: "bg-zinc-400",
    card: "border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800",
    accent: "text-zinc-500 dark:text-zinc-400",
    action: "Play",
    variant: "gold",
    gold: true,
  },
  IN_PROGRESS: {
    label: "In progress",
    dot: "bg-yellow-500",
    card: "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/40",
    accent: "text-yellow-700 dark:text-yellow-400",
    action: "Resume",
    variant: "yellow",
    gold: true,
  },
  WON: {
    label: "Solved",
    dot: "bg-green-500",
    card: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40",
    accent: "text-green-700 dark:text-green-400",
    action: "Review",
    variant: "green",
    gold: false,
  },
  LOST: {
    label: "Not solved",
    dot: "bg-red-500",
    card: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
    accent: "text-red-700 dark:text-red-400",
    action: "Review",
    variant: "red",
    gold: false,
  },
};

export default function ArchiveDetail({
  day,
  isToday,
  onPlay,
}: ArchiveDetailProps) {
  const meta = STATE_META[day.status];
  const dateLabel = parseDate(day.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className={`mt-4 rounded-lg border ${meta.card}`}>
      <div className="flex justify-between items-center p-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-xs">
              <span className={`font-semibold ${meta.accent}`}>
                Puzzle {day.number}
              </span>
              <span className="font-bold">{" "}({day.gram})</span>
            </div>

            <div className="flex items-center gap-1 text-xs font-semibold">
              <span className={`size-[6px] shrink-0 rounded-full ${meta.dot}`} />
              <span>{meta.label}</span>
            </div>
          </div>
          <div className="mt-px text-[15px] font-bold tracking-tight">
            {dateLabel}
          </div>
        </div>
        <Button
          type="button"
          size="none"
          variant={meta.variant}
          onClick={() => onPlay?.(day.date, day.status)}
          className="px-3 py-2 text-[13px]"
          style={{ borderRadius: "12px / 16px" }}
        >
          {meta.gold ? (
            <Play className="size-3.5 fill-current" />
          ) : (
            <SearchCheck className="size-3.5" />
          )}
          {meta.action}
        </Button>
      </div>
    </div>
  );
}
