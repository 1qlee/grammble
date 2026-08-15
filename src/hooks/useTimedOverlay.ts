import { useEffect, useRef, useState } from "react";

// Minimum time the overlay stays fully on screen before it may fade out, so a
// near-instant load doesn't produce a jarring flash. FADE_MS is kept in sync
// with the fade-out duration applied in GameLoadingOverlay.
const MIN_VISIBLE_MS = 500;
const FADE_MS = 300;

// Decouples "is the work still loading" (`active`) from "is the overlay on
// screen". The overlay shows immediately (no fade-in), honors a minimum visible
// window, then fades out before unmounting.
export function useTimedOverlay(active: boolean) {
  const [shouldRender, setShouldRender] = useState(active);
  const [isVisible, setIsVisible] = useState(true);
  const mountedAtRef = useRef<number | null>(null);
  const hideTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Record when the overlay first appeared so the minimum window can be timed.
  useEffect(() => {
    mountedAtRef.current = Date.now();
  }, []);

  // Once the work is done, hold for the remainder of the minimum window, then
  // fade out and unmount.
  useEffect(() => {
    if (active) return;

    const elapsed =
      mountedAtRef.current === null
        ? Infinity
        : Date.now() - mountedAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    const fadeTimer = setTimeout(() => {
      setIsVisible(false);
      hideTimersRef.current.push(
        setTimeout(() => setShouldRender(false), FADE_MS),
      );
    }, remaining);
    hideTimersRef.current.push(fadeTimer);

    return () => {
      hideTimersRef.current.forEach(clearTimeout);
      hideTimersRef.current = [];
    };
  }, [active]);

  return { shouldRender, isVisible };
}
