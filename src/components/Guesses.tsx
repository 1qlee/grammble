import { useGame } from "../context/GameProvider";
import clsx from "clsx";
import { animate, createScope, spring, type Scope } from "animejs";
import { useEffect, useRef } from "react";
import { Transition } from "@headlessui/react";

export default function Guesses() {
  const { state } = useGame();
  const { guesses, currentGuessIndex } = state;
  const scope = useRef<Scope>(null);
  const root = useRef<HTMLDivElement>(null);
  const rows = 6;
  const cols = 6;

  useEffect(() => {
    scope.current = createScope({ root }).add(self => {
      animate('.tile', {
        scale: [
          { to: 1.1, ease: 'inOut(3)', duration: 200 },
          { to: 1, ease: spring({ bounce: .7 }) }
        ],
      })
    })

    return () => scope.current?.revert()
  }, [])

  return (
    <div ref={root} className="flex flex-col gap-1 py-8">
      {Array.from({ length: rows }, (_, rowIndex) => {
        const guess = guesses[rowIndex] ?? "";
        const isCurrentRow = rowIndex === currentGuessIndex;
        // For current row, show all characters typed (no limit) + at least 6 empty tiles
        // For other rows, show exactly 6 columns
        const numCols = isCurrentRow ? Math.max(cols, guess.length) : cols;

        return (
          <div key={rowIndex} className="grid gap-1 mb-1 mx-auto" style={{ gridTemplateColumns: `repeat(${numCols}, 52px)` }}>
            {Array.from({ length: numCols }, (_, colIndex) => {
              const char = guess[colIndex] ?? "";
              const hasChar = char !== "";

              return (
                <div
                  key={colIndex}
                  className={clsx(
                    "tile flex h-[52px] w-[52px] outline-none grow items-center justify-center rounded-lg text-xl transition-all duration-100 cursor-pointer select-none [&:not(:last-child)]:mr-1 perspective-normal",
                    "border border-b-zinc-400/75 border-t-zinc-300 border-zinc-200 dark:border-zinc-700 dark:border-t-zinc-700 dark:border-b-zinc-700/75",
                    "focus:shadow-[0_0_16px_4px_#fff] focus:border-b-zinc-900 dark:focus:shadow-[0_0_16px_4px_var(--color-zinc-700)] dark:focus:border-b-zinc-100",
                    hasChar ? "bg-zinc-200 dark:bg-zinc-700/40" : "bg-transparent"
                  )}
                >
                  <Transition show={hasChar}>
                    <span className={clsx(
                      "transition duration-200 flex items-center justify-center h-full w-full rounded-lg -translate-y-[2px] translate-z-0 transform-3d",
                      // Entering styles
                      'data-enter:duration-100 ease-in data-enter:data-closed:-translate-y-2 data-enter:data-closed:translate-z-8',
                      // Leaving styles
                      'data-leave:duration-50 data-leave:data-closed:opacity-50 data-leave:data-closed:-translate-y-1 data-leave:data-closed:translate-z-8',
                      "bg-white dark:bg-zinc-700",
                      "shadow-[0_4px_8px_rgba(0,0,0,0.1),0_4px_0px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_8px_var(--color-zinc-800),0_2px_0px_var(--color-zinc-900)]",
                    )}>{char}</span>
                  </Transition>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
