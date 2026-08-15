import { useCallback, useRef } from "react";
import { KeyboardRows } from "./Keyboard.data";
import type { Key } from "./Keyboard.types";

import useKeyboardInput from "./useKeyboardInput";
import { useKeyboardNavigation } from "./useKeyboardNavigation";
import { useKeyFeedback } from "./useKeyFeedback";
import { useSubmitGuess } from "~/hooks/useSubmitGuess";
import { useGameStore } from "~/stores/game-store";
import { useSettings } from "~/utils/providers/settings-provider";
import { parseGuess } from "~/utils/game/guess-placement";
import { GUESS_MIN_LENGTH_BY_MODE } from "~/utils/game/constants";
import { KeyboardRow } from "./KeyboardRow";

export default function Keyboard() {
  const keyButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { allKeys, focusedKeyIndex, setFocusedKeyIndex } =
    useKeyboardNavigation(keyButtonRefs);

  const gram = useGameStore((s) => s.gram);
  const status = useGameStore((s) => s.status);
  const confirmPending = useGameStore((s) => s.confirmPending);
  const isGameOver = status !== "IN_PROGRESS";

  const { confirmAllGuesses } = useSettings();
  const { keyFeedback, gramFeedback } = useKeyFeedback();

  const { submit } = useSubmitGuess();

  // With "Confirm All Guesses" on, the first Enter on a submittable row arms it
  // (surfacing the check icon) and the second submits. Without it, Enter submits
  // straight through. Only arm on a guess that would actually pass validation
  // (meets the minimum length and contains the gram); otherwise fall through to
  // submit so the user gets the specific error toast instead of a silent arm.
  const canArm = useCallback(() => {
    const state = useGameStore.getState();
    const parsed = parseGuess(
      state.guesses[state.currentGuessIndex] ?? "",
      state.wordLength,
    );
    if (!parsed.ok) return false;
    const { word } = parsed.value;
    if (word.length < GUESS_MIN_LENGTH_BY_MODE[state.mode]) return false;
    if (state.gram && !word.includes(state.gram)) return false;
    return true;
  }, []);

  const handleEnter = useCallback(() => {
    const state = useGameStore.getState();
    if (confirmAllGuesses && !state.confirmPending && canArm()) {
      state.setConfirmPending(true);
      return;
    }
    state.setConfirmPending(false);
    submit();
  }, [confirmAllGuesses, canArm, submit]);

  const { selectedKeys, handleKeyPointerDown, handleKeyPointerUp } =
    useKeyboardInput(focusedKeyIndex, allKeys, handleEnter);

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
          confirmPending={confirmPending}
          keyButtonRefs={keyButtonRefs}
          setFocusedKeyIndex={setFocusedKeyIndex}
        />
      ))}
    </div>
  );
}
