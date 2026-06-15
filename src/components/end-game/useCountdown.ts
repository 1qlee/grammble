import { useEffect, useState } from "react";

const PUZZLE_TIMEZONE = "America/Los_Angeles";

const tzPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PUZZLE_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600).toString().padStart(2, "0");
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function msUntilNextPuzzleReset(): number {
  const now = new Date();
  const parts = tzPartsFormatter.formatToParts(now).reduce<Record<string, string>>(
    (acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    },
    {},
  );
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const elapsed = hour * 3600 + minute * 60 + second;
  const remainingSec = 24 * 3600 - elapsed;
  return remainingSec * 1000 - now.getMilliseconds();
}

export function useCountdown() {
  const [remaining, setRemaining] = useState(msUntilNextPuzzleReset);
  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(msUntilNextPuzzleReset());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  return formatCountdown(remaining);
}
