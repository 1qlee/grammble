import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Transition } from "@headlessui/react";
import { animate } from "animejs";
import { X } from "lucide-react";
import { useGameStore } from "~/stores/game-store";

export type ToastType = "info" | "warning" | "success" | "error";

const SURFACE_BY_TYPE: Record<ToastType, string> = {
  info: "surface-raised",
  success: "surface-green",
  warning: "surface-yellow",
  error: "surface-red",
};

const DISMISS_MS = 2500;
const SWIPE_THRESHOLD = 4;
const MAX_DRAG = 40;

export default function Toast() {
  const toast = useGameStore((s) => s.toast);
  const setToast = useGameStore((s) => s.setToast);
  const [cached, setCached] = useState<typeof toast>(null);
  const dragRef = useRef<HTMLDivElement | null>(null);
  const shakeRef = useRef<HTMLDivElement | null>(null);

  const shakeIfError = (t: typeof toast) => {
    if ((t?.type === "error" || t?.shake) && shakeRef.current) {
      animate(shakeRef.current, {
        x: [
          { to: -8, duration: 60 },
          { to: 8, duration: 60 },
          { to: -6, duration: 60 },
          { to: 6, duration: 60 },
          { to: 0, duration: 60 },
        ],
        ease: "inOut(2)",
      });
    }
  };

  useEffect(() => {
    if (!toast) return;
    setCached(toast);
    shakeIfError(toast);
    const id = window.setTimeout(() => setToast(null), DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [toast, setToast]);

  useEffect(() => {
    const el = dragRef.current;
    if (!cached || !el) return;

    let instance: { revert: () => void } | null = null;
    let cancelled = false;

    import("animejs").then(({ createDraggable }) => {
      if (cancelled) return;
      instance = createDraggable(el, {
        y: true,
        x: false,
        container: [-MAX_DRAG, 0, MAX_DRAG, 0],
        containerFriction: 0.8,
        releaseContainerFriction: 0.9,
        cursor: { onHover: "grab", onGrab: "grabbing" },
        releaseEase: "out(3)",
        onRelease: (self: any) => {
          if (Math.abs(self.y) >= SWIPE_THRESHOLD) {
            setToast(null);
          } else {
            self.reset();
          }
        },
      } as any);
    });

    return () => {
      cancelled = true;
      instance?.revert();
    };
  }, [cached, setToast]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed inset-x-0 top-0 z-[9999] flex justify-center pt-4 pointer-events-none"
    >
      <Transition
        show={!!toast}
        as="div"
        enter="transition duration-200 ease-out"
        enterFrom="opacity-0 -translate-y-4"
        enterTo="opacity-100 translate-y-0"
        leave="transition duration-150 ease-in"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 -translate-y-4"
        afterEnter={() => shakeIfError(cached)}
        afterLeave={() => setCached(null)}
      >
        {cached && (
          <div
            ref={dragRef}
            role="status"
            style={{ touchAction: "none" }}
            className="pointer-events-auto select-none"
            // The toast renders outside any open Dialog's panel, so a pointer
            // interaction here would bubble to Headless UI's outside-click
            // listener and dismiss the Dialog. Stop it at the toast surface so
            // swiping or X-ing the toast leaves the Dialog mounted.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div ref={shakeRef}>
            <div
              className={clsx(
                SURFACE_BY_TYPE[cached.type],
                "rounded-lg text-sm p-2 pr-8 relative min-w-[200px]",
              )}
            >
              <span>{cached.message}</span>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setToast(null)}
                className={clsx(
                  "absolute top-1/2 -translate-y-1/2 right-2",
                  "inline-flex items-center justify-center w-5 h-5 rounded",
                  "opacity-70 hover:opacity-100 focus:opacity-100",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-current",
                )}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            </div>
          </div>
        )}
      </Transition>
    </div>
  );
}
