import { useCountdown } from "./useCountdown";

export function CountdownTimer() {
  const { countdown, date } = useCountdown();

  return (
    <div className=" flex items-center justify-center gap-4 rounded-2xl p-2">
      <p className="text-sm font-medium text-accent">
        Next game in <span className="font-bold text-zinc-900 dark:text-zinc-100">{countdown}</span>
        {date && ` on ${date}`}.
      </p>
    </div>
  );
}
