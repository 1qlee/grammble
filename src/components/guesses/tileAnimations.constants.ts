import { cubicBezier } from "animejs";

export const CHAR_IN = {
  translateY: [
    { from: -3, to: 1, duration: 100 },
    { to: 0, duration: 50 },
  ],
  scale: [
    { from: 0.98, to: 1.02, duration: 100 },
    { to: 1, duration: 50 },
  ],
  ease: cubicBezier(0.2, 0.8, 0.3, 1.1),
};

export const CHAR_OUT = {
  translateY: 4,
  opacity: 0,
  duration: 100,
  ease: cubicBezier(0.2, 0.8, 0.3, 1.1),
};
