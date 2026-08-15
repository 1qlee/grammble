import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { prefersReducedMotion } from "~/utils/prefers-reduced-motion";

export function Odometer({
  value,
  from = 0,
  delay = 0,
  duration = 800,
  suffix = "",
  format,
  animate: shouldAnimate = true,
  className,
}: {
  value: number;
  from?: number;
  delay?: number;
  duration?: number;
  suffix?: string;
  /** Renders each tick's rounded value. Overrides `suffix`; use for signed or unit-bearing text. */
  format?: (n: number) => string;
  animate?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const write = (n: number) => {
      const rounded = Math.round(n);
      el.textContent = format ? format(rounded) : `${rounded}${suffix}`;
    };

    if (!shouldAnimate || prefersReducedMotion()) {
      write(value);
      return;
    }

    const proxy = { n: from };
    write(from);
    const anim = animate(proxy, {
      n: value,
      duration,
      delay,
      ease: "out(3)",
      onUpdate: () => write(proxy.n),
    });

    return () => {
      anim.pause();
      write(value);
    };
  }, [value, from, delay, duration, suffix, format, shouldAnimate]);

  return <span ref={ref} className={className} />;
}
