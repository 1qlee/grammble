import { useEffect, useLayoutEffect } from "react";

// useLayoutEffect warns during SSR; fall back to useEffect on the server. Use
// this when an effect must run before the browser paints (e.g. seeding state
// that the first painted frame depends on) without tripping the SSR warning.
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
