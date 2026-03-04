import { useEffect, useState, type RefObject } from "react";
import type { Key } from "./Keyboard.types";
import { useGame } from "~/context/GameProvider";
import { validKeys } from "./Keyboard.data";
import { ChangeGuessAction } from "~/context/GameProvider.types";

const getNormalizedKey = (key: string): Key => {
  switch (key) {
    case "Backspace":
    case "Delete":
      return "Backspace";
    case "Gram":
    case "`":
      return "Gram";
    case "Enter":
      return "Enter";
    case "Blank":
    case "Space":
    case " ":
      return "Blank";
    default:
      return key.toUpperCase() as Key;
  }
};

const changeGuess = (options: { key: Key; modifier?: boolean }): ChangeGuessAction => {
  const { key, modifier } = options;

  switch (key) {
    case "Backspace":
      return modifier ? { type: "clear" } : { type: "backspace" };
    case "Enter":
      return { type: "submit" };
    case "Blank":
      return { type: "append", char: " " as Key };
    default:
      return { type: "append", char: key };
  }
};
export default function useKeyboardInput(
  focusedKeyIndex: number | null = null,
  allKeys: Key[] = []
) {
  const { dispatch, state } = useGame();
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);

  const removeSelectedKey = (key: string) => {
    setSelectedKeys((prev) =>
      prev.filter((selectedKey) => selectedKey !== key),
    );
  };

  const addSelectedKey = (key: Key) => {
    setSelectedKeys((prev) => [...prev, key]);
  };

  // handle pointer down or touch down on key button
  const handleKeyPointerDown = (key: Key) => {
    const normalizedKey = getNormalizedKey(key);

    if (!validKeys.includes(normalizedKey)) {
      return;
    }

    const parsedKey = parseKey({ key, remove: false });

    const changeGuessAction = changeGuess({
      key: parsedKey,
    });

    dispatch({
      type: "changeGuess",
      change: changeGuessAction,
    });
  };

  // handle pointer up or touch up on key button
  const handleKeyPointerUp = (key: Key) => {
    removeSelectedKey(key);
  };

  // handle a press on an actual physical keyboard
  const handleKeyboardPress = (event: KeyboardEvent) => {
    let { key } = event;
    const activeElement = document.activeElement as HTMLElement;

    // Don't allow input if game is paused (e.g. when a dialog is open)
    if (state.isPaused) {
      return;
    }

    const normalizedKey = getNormalizedKey(key);

    // Remove focus from any focused element except when the Enter key is pressed
    if (normalizedKey !== "Enter") {
      activeElement?.blur();
    }

    if (!validKeys.includes(normalizedKey)) {
      return;
    }

    // If Enter is pressed and a key is focused, append that key instead of submitting
    if (normalizedKey === "Enter" && focusedKeyIndex !== null && focusedKeyIndex >= 0 && focusedKeyIndex < allKeys.length) {
      const focusedKey = allKeys[focusedKeyIndex];
      if (focusedKey && focusedKey !== "Enter") {
        const parsedKey = parseKey({
          key: focusedKey,
          remove: false,
        });

        const changeGuessAction = changeGuess({
          key: parsedKey,
          modifier: event.shiftKey || event.ctrlKey || event.metaKey,
        });

        dispatch({
          type: "changeGuess",
          change: changeGuessAction,
        });
        return;
      }
    }

    const parsedKey = parseKey({
      key: normalizedKey,
      remove: false,
    });

    const changeGuessAction = changeGuess({
      key: parsedKey,
      modifier: event.shiftKey || event.ctrlKey || event.metaKey,
    });

    dispatch({
      type: "changeGuess",
      change: changeGuessAction,
    });
  };

  const handleKeyboardRelease = (event: KeyboardEvent) => {
    let { key } = event;
    setSelectedKeys([]);

    const normalizedKey = getNormalizedKey(key);

    if (normalizedKey) {
      parseKey({
        key: normalizedKey,
        remove: true,
      });
    }
  };

  // parse the key and add or remove it from the selected keys
  const parseKey = (options: { key: Key; remove: boolean }) => {
    let { key, remove } = options;

    const normalizedKey = getNormalizedKey(key);

    if (remove) {
      removeSelectedKey(normalizedKey);
    } else {
      addSelectedKey(normalizedKey);
    }

    return normalizedKey;
  };

  useEffect(() => {
    const handlePointerUp = () => {
      setSelectedKeys([]);
    };

    document.addEventListener("keydown", handleKeyboardPress);
    document.addEventListener("keyup", handleKeyboardRelease);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("keydown", handleKeyboardPress);
      document.removeEventListener("keyup", handleKeyboardRelease);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [state.isPaused, focusedKeyIndex, allKeys]);

  return {
    selectedKeys,
    setSelectedKeys,
    handleKeyPointerDown,
    handleKeyPointerUp,
  };
}
