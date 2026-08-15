import { useCallback, useEffect, useRef, useState } from "react";
import { animate } from "animejs";

type AnimeParams = Parameters<typeof animate>[1];

export function useAnimeMount<T extends HTMLElement>(
  animateIn: AnimeParams,
  animateOut: AnimeParams,
) {
  const ref = useRef<T>(null);
  const [mounted, setMounted] = useState(true);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    animate(ref.current, animateIn);
  }, []);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;

    if (!ref.current) {
      setMounted(false);
      return;
    }
    animate(ref.current, {
      ...animateOut,
      onComplete: () => setMounted(false),
    });
  }, [animateOut]);

  return { ref, mounted, dismiss };
}
