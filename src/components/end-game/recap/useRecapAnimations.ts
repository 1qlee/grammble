import { createContext, useContext, useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { prefersReducedMotion } from "~/utils/prefers-reduced-motion";

// Cascade timing for the overview panel: each `data-cascade` element fades and lifts into place one
// CASCADE_STEP after the one above it. A section's own contents (its odometer and bar fill) start
// CONTENT_OFFSET later so the number and fill move once the section itself has landed.
const CASCADE_START = 60;
const CASCADE_STEP = 80;
const CONTENT_OFFSET = 120;

// Whether the intro should actually play. The carousel unmounts and remounts a slide on every
// prev/next, so it flips this off once the intro has run: paging back to the overview then renders
// it already settled instead of replaying the cascade. Every animation below reads it from context
// rather than a prop, so it never has to be threaded through the panel's section components.
const RecapIntroContext = createContext(true);
export const RecapIntroProvider = RecapIntroContext.Provider;

/** True while the intro animations are still allowed to run. */
export function useRecapIntro(): boolean {
  return useContext(RecapIntroContext);
}

/** Start delay for the odometer/bar living inside the nth `data-cascade` element. */
export function contentDelay(index: number): number {
  return CASCADE_START + index * CASCADE_STEP + CONTENT_OFFSET;
}

/**
 * Fades + lifts every `[data-cascade]` descendant into place top to bottom on mount. The elements
 * render at `opacity-0` so nothing flashes before the first frame; this hook is what reveals them,
 * and it hard-sets them visible when the animation is skipped or torn down.
 */
export function useCascadeIn<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const enabled = useRecapIntro();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLElement>("[data-cascade]")];
    if (items.length === 0) return;

    const reveal = () => {
      for (const el of items) {
        el.style.opacity = "1";
        el.style.transform = "";
      }
    };

    if (!enabled || prefersReducedMotion()) {
      reveal();
      return;
    }

    const anim = animate(items, {
      opacity: [0, 1],
      translateY: [6, 0],
      duration: 420,
      delay: stagger(CASCADE_STEP, { start: CASCADE_START }),
      ease: "out(3)",
    });

    return () => {
      anim.pause();
      reveal();
    };
  }, [enabled]);

  return ref;
}

/**
 * Grows a bar's fill from empty to `width` percent. Used by the bars whose fill is a flex/block
 * child, where animating the width keeps neighbouring segments butted against each other.
 */
export function useBarFill(width: number, delay: number, duration = 700) {
  const ref = useRef<HTMLSpanElement>(null);
  const enabled = useRecapIntro();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!enabled || prefersReducedMotion()) {
      el.style.width = `${width}%`;
      return;
    }

    const anim = animate(el, {
      width: [`0%`, `${width}%`],
      duration,
      delay,
      ease: "out(3)",
    });

    return () => {
      anim.pause();
      el.style.width = `${width}%`;
    };
  }, [width, delay, duration, enabled]);

  return ref;
}

/**
 * Grows a column's fill up from the track's floor: height 0 -> `height` percent, bottom-anchored.
 * Used by the additive score pillars (base, opening), whose fill is an absolutely positioned child
 * pinned to the bottom of its track.
 */
export function useColumnFill(height: number, delay: number, duration = 700) {
  const ref = useRef<HTMLSpanElement>(null);
  const enabled = useRecapIntro();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!enabled || prefersReducedMotion()) {
      el.style.height = `${height}%`;
      return;
    }

    const anim = animate(el, {
      height: [`0%`, `${height}%`],
      duration,
      delay,
      ease: "out(3)",
    });

    return () => {
      anim.pause();
      el.style.height = `${height}%`;
    };
  }, [height, delay, duration, enabled]);

  return ref;
}

/**
 * Grows a diverging column's fill out from the center tick along the vertical axis: `negative`
 * anchors the scale to the fill's bottom edge so it sweeps downward, otherwise it sweeps up. The
 * fill is absolutely positioned, so scaling it is cheaper than tweening height and nothing shifts.
 */
export function useColumnMeterFill(negative: boolean, delay: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const enabled = useRecapIntro();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.transformOrigin = negative ? "center top" : "center bottom";

    if (!enabled || prefersReducedMotion()) {
      el.style.transform = "";
      return;
    }

    const anim = animate(el, {
      scaleY: [0, 1],
      duration: 700,
      delay,
      ease: "out(3)",
    });

    return () => {
      anim.pause();
      el.style.transform = "";
    };
  }, [negative, delay, enabled]);

  return ref;
}

/**
 * Grows a diverging meter's fill out from the center tick: `negative` anchors the scale to the
 * fill's right edge so it sweeps leftward. The fill is absolutely positioned, so scaling it is
 * cheaper than tweening width/left and nothing else shifts.
 */
export function useMeterFill(fillWidth: number, negative: boolean, delay: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const enabled = useRecapIntro();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.transformOrigin = negative ? "right center" : "left center";

    if (!enabled || prefersReducedMotion()) {
      el.style.transform = "";
      return;
    }

    const anim = animate(el, {
      scaleX: [0, 1],
      duration: 700,
      delay,
      ease: "out(3)",
    });

    return () => {
      anim.pause();
      el.style.transform = "";
    };
  }, [fillWidth, negative, delay, enabled]);

  return ref;
}
