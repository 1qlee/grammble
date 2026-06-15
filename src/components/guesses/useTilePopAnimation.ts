import { useEffect, useRef } from "react";
import { animate, createScope, spring, type Scope } from "animejs";
import {
  TILE_POP_PEAK_DURATION_MS,
  TILE_POP_PEAK_SCALE,
  TILE_POP_SPRING_BOUNCE,
} from "~/utils/game/constants";

export function useTilePopAnimation(root: React.RefObject<HTMLElement | null>) {
  const scope = useRef<Scope | null>(null);

  useEffect(() => {
    scope.current = createScope({ root }).add(() => {
      animate(".tile:not(.tile-wide)", {
        scale: [
          {
            to: TILE_POP_PEAK_SCALE,
            ease: "inOut(3)",
            duration: TILE_POP_PEAK_DURATION_MS,
          },
          { to: 1, ease: spring({ bounce: TILE_POP_SPRING_BOUNCE }) },
        ],
      });
    });

    return () => scope.current?.revert();
  }, [root]);
}
