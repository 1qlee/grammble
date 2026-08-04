import { useEffect, useState } from "react";
import { prefersReducedMotion } from "~/utils/prefers-reduced-motion";

// Flips from false to true after `delayMs`, driving CSS-transition reveals in
// the end-game cascade. Resolves to true immediately when reduced motion is
// requested or when `animate` is false (so unanimated renders show final state).
export function useDelayedFlag(delayMs: number, animate = true): boolean {
  const skip = !animate || prefersReducedMotion();
  const [on, setOn] = useState(() => skip);

  useEffect(() => {
    if (skip) {
      setOn(true);
      return;
    }
    const id = window.setTimeout(() => setOn(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs, skip]);

  return on;
}
