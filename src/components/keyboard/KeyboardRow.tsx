import { Check, Delete } from "lucide-react";
import clsx from "clsx";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Key } from "./Keyboard.types";
import { KeyButton } from "./KeyButton";
import type { KeyFeedback } from "./useKeyFeedback";

const KEY_FEEDBACK_CLASSES: Record<KeyFeedback, string> = {
  correct: "keyboard-key-correct",
  misplaced: "keyboard-key-misplaced",
  absent: "keyboard-key-absent",
};

const ROW_GRID_CLASSES = [
  "grid-cols-10",
  "[grid-template-columns:0.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_0.5fr]",
  "[grid-template-columns:1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1.5fr]",
  "[grid-template-columns:repeat(3,1fr)]",
];

interface KeyboardRowProps {
  row: Key[];
  rowIndex: number;
  allKeys: Key[];
  selectedKeys: Key[];
  keyFeedback: Record<string, KeyFeedback>;
  gramFeedback: KeyFeedback | null;
  gram: string;
  confirmPending: boolean;
  keyButtonRefs: RefObject<(HTMLButtonElement | null)[]>;
  setFocusedKeyIndex: Dispatch<SetStateAction<number | null>>;
}

export function KeyboardRow({
  row,
  rowIndex,
  allKeys,
  selectedKeys,
  keyFeedback,
  gramFeedback,
  gram,
  confirmPending,
  keyButtonRefs,
  setFocusedKeyIndex,
}: KeyboardRowProps) {
  return (
    <div
      className={clsx(
        "mb-2 grid w-full touch-manipulation px-2",
        ROW_GRID_CLASSES[rowIndex],
      )}
    >
      {row.map((key, index) => {
        if (key === "spacer") {
          return <div key={`spacer-${rowIndex}-${index}`} />;
        }

        const active = selectedKeys.includes(key);
        const keyIndex = allKeys.indexOf(key);
        const reactKey = `row-${rowIndex}-key-${index}-${key}`;
        const sharedProps = {
          active,
          keyName: key,
          keyIndex,
          keyButtonRefs,
          setFocusedKeyIndex,
        };

        if (key === "Backspace") {
          return (
            <KeyButton key={reactKey} {...sharedProps}>
              <Delete size="1.25em" />
            </KeyButton>
          );
        }

        if (key === "Enter") {
          return (
            <KeyButton
              key={reactKey}
              {...sharedProps}
              feedbackClass={confirmPending ? "keyboard-key-confirm" : undefined}
            >
              {confirmPending ? <Check size="1.25em" /> : "Enter"}
            </KeyButton>
          );
        }

        if (key === "Gram") {
          return (
            <KeyButton
              key={reactKey}
              {...sharedProps}
              feedbackClass={
                gramFeedback ? KEY_FEEDBACK_CLASSES[gramFeedback] : undefined
              }
            >
              {gram ? gram.toUpperCase() : "ST"}
            </KeyButton>
          );
        }

        const status = keyFeedback[key];
        const feedbackClass = status ? KEY_FEEDBACK_CLASSES[status] : undefined;

        return (
          <KeyButton key={reactKey} {...sharedProps} feedbackClass={feedbackClass}>
            {key}
          </KeyButton>
        );
      })}
    </div>
  );
}
