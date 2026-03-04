import { Delete } from "lucide-react";
import { KeyboardRows } from "./Keyboard.data";
import clsx from "clsx";
import { useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Key } from "./Keyboard.types";

import useKeyboardInput from "./useKeyboardInput";
import { useKeyboardNavigation } from "./useKeyboardNavigation";

function Key({
  active,
  keyButtonRefs,
  children,
  keyIndex,
  keyName,
  setFocusedKeyIndex,
}: {
  keyIndex: number;
  keyName: Key;
  children: React.ReactNode;
  active: boolean;
  keyButtonRefs: RefObject<(HTMLButtonElement | null)[]>;
  setFocusedKeyIndex: Dispatch<SetStateAction<number | null>>;
}) {
  return (
    <button
      ref={(el) => {
        if (keyIndex >= 0) {
          keyButtonRefs.current[keyIndex] = el;
        }
      }}
      data-key-name={keyName}
      data-key-index={keyIndex}
      data-state={active ? "active" : "inactive"}
      onFocus={() => setFocusedKeyIndex(keyIndex)}
      onBlur={() => setFocusedKeyIndex(null)}
      className="keyboard-key"
    >
      <span
        data-key-name={keyName}
        className={clsx(
          "transition-all duration-100 ease-in-out flex items-center justify-center h-full w-full rounded-lg -translate-y-[4px]",
          "bg-white dark:bg-zinc-700",
          "shadow-[0_4px_8px_rgba(0,0,0,0.1),0_4px_0px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_8px_var(--color-zinc-800),0_4px_0px_var(--color-zinc-900)]",
          active ? "translate-y-0 shadow-none" : ""
        )}
      >
        {children}
      </span>
    </button>
  );
}

export default function Keyboard() {
  const keyButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { allKeys, focusedKeyIndex, setFocusedKeyIndex } =
    useKeyboardNavigation(keyButtonRefs);

  const {
    selectedKeys,
    setSelectedKeys,
    handleKeyPointerDown,
    handleKeyPointerUp,
  } = useKeyboardInput(focusedKeyIndex, allKeys);

  return (
    <div
      className="w-full py-1 select-none"
      data-keyboard-container
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        const keyElement = target.closest('[data-key-name]') as HTMLElement;

        if (keyElement?.dataset?.keyName) {
          handleKeyPointerDown(
            keyElement.dataset.keyName as Key
          );
        }
      }}
      onPointerUp={(e) => {
        const target = e.target as HTMLElement;
        const keyElement = target.closest('[data-key-name]') as HTMLElement;

        if (keyElement?.dataset?.keyName) {
          handleKeyPointerUp(keyElement.dataset.keyName as Key);
        }
      }}
    >
      {(() => {
        return KeyboardRows.map((row, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className={clsx(
              "mb-2 grid w-full touch-manipulation px-2",
              [
                "grid-cols-10",
                "[grid-template-columns:0.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_0.5fr]",
                "[grid-template-columns:1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1.5fr]",
                "[grid-template-columns:repeat(3,1fr)]",
              ][rowIndex]
            )}
          >
            {row.map((key, index) => {
              const isActiveKey = selectedKeys.includes(key as Key);
              const keyIndex = allKeys.indexOf(key);

              if (key === "spacer") {
                return <div key={`spacer-${rowIndex}-${index}`} />;
              }

              if (key === "Backspace") {
                return (
                  <Key
                    key={`row-${rowIndex}-key-${index}-${key}`}
                    active={isActiveKey}
                    keyName={key}
                    keyIndex={keyIndex}
                    setFocusedKeyIndex={setFocusedKeyIndex}
                    keyButtonRefs={keyButtonRefs}
                  >
                    <Delete className="w-5 h-5" />
                  </Key>
                );
              }
              if (key === "Gram") {
                return (
                  <Key
                    key={`row-${rowIndex}-key-${index}-${key}`}
                    active={isActiveKey}
                    keyName={key}
                    keyIndex={keyIndex}
                    setFocusedKeyIndex={setFocusedKeyIndex}
                    keyButtonRefs={keyButtonRefs}
                  >
                    ST
                  </Key>
                );
              }

              return (
                <Key
                  key={`row-${rowIndex}-key-${index}-${key}`}
                  active={isActiveKey}
                  keyName={key}
                  keyIndex={keyIndex}
                  setFocusedKeyIndex={setFocusedKeyIndex}
                  keyButtonRefs={keyButtonRefs}
                >
                  {key}
                </Key>
              );
            })}
          </div>
        ));
      })()}
    </div>
  );
}
