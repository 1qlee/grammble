import { useRef } from "react";
import { KeyboardRows } from "./Keyboard.data";
import type { Key } from "./Keyboard.types";

import useKeyboardInput from "./useKeyboardInput";
import { useKeyboardNavigation } from "./useKeyboardNavigation";
import { useKeyFeedback } from "./useKeyFeedback";
import { useSubmitGuess } from "~/hooks/useSubmitGuess";
import { useGameStore } from "~/stores/game-store";
import { KeyboardRow } from "./KeyboardRow";

export default function Keyboard() {
  const keyButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { allKeys, focusedKeyIndex, setFocusedKeyIndex } =
    useKeyboardNavigation(keyButtonRefs);

  const gram = useGameStore((s) => s.gram);
  const status = useGameStore((s) => s.status);
  const isGameOver = status !== "IN_PROGRESS";

  const { keyFeedback, gramFeedback } = useKeyFeedback();

  const { submit } = useSubmitGuess();
  const { selectedKeys, handleKeyPointerDown, handleKeyPointerUp } =
    useKeyboardInput(focusedKeyIndex, allKeys, submit);

  const handlePointer =
    (handler: (key: Key) => void) =>
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isGameOver) return;
      const target = e.target as HTMLElement;
      const keyElement = target.closest("[data-key-name]") as HTMLElement | null;
      const keyName = keyElement?.dataset?.keyName as Key | undefined;
      if (keyName) handler(keyName);
    };

  return (
    <div
      className="w-full py-1 select-none"
      data-keyboard-container
      onPointerDown={handlePointer(handleKeyPointerDown)}
      onPointerUp={handlePointer(handleKeyPointerUp)}
    >
      {KeyboardRows.map((row, rowIndex) => (
        <KeyboardRow
          key={`row-${rowIndex}`}
          row={row}
          rowIndex={rowIndex}
          allKeys={allKeys}
          selectedKeys={selectedKeys}
          keyFeedback={keyFeedback}
          gramFeedback={gramFeedback}
          gram={gram}
          keyButtonRefs={keyButtonRefs}
          setFocusedKeyIndex={setFocusedKeyIndex}
        />
      ))}
    </div>
  );
}
