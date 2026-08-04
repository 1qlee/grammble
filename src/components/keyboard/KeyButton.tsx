import clsx from "clsx";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Key } from "./Keyboard.types";

interface KeyButtonProps {
  keyIndex: number;
  keyName: Key;
  children: React.ReactNode;
  active: boolean;
  keyButtonRefs: RefObject<(HTMLButtonElement | null)[]>;
  setFocusedKeyIndex: Dispatch<SetStateAction<number | null>>;
  feedbackClass?: string;
}

export function KeyButton({
  active,
  keyButtonRefs,
  children,
  keyIndex,
  keyName,
  setFocusedKeyIndex,
  feedbackClass,
}: KeyButtonProps) {
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
      onMouseDown={(e) => e.preventDefault()}
      onFocus={() => setFocusedKeyIndex(keyIndex)}
      onBlur={() => setFocusedKeyIndex(null)}
      className="keyboard-key"
    >
      <span
        data-key-name={keyName}
        data-active={active ? "" : undefined}
        className={clsx("keyboard-key-char", feedbackClass)}
      >
        {children}
      </span>
    </button>
  );
}
