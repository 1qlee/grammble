import { useEffect, useRef, useState } from "react";
import type { Key } from "./Keyboard.types";
import { useGameStore } from "~/stores/game-store";
import { validKeys } from "./Keyboard.data";

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

function dispatchKey(key: Key, modifier: boolean) {
  const { appendChar, backspace, clearGuess, setSkipGramAnimation } =
    useGameStore.getState();

  switch (key) {
    case "Backspace":
      modifier ? clearGuess() : backspace();
      break;
    case "Enter":
      // Submit is handled externally (tRPC mutation), not here
      break;
    case "Blank":
      appendChar(" " as Key);
      break;
    case "Gram": {
      const { gram, guesses, currentGuessIndex, wordLength } =
        useGameStore.getState();
      const currentGuess = guesses[currentGuessIndex] ?? "";
      if (!gram) break;
      const upperGram = gram.toUpperCase();
      if (currentGuess.includes(upperGram)) break;
      // If the guess tail already matches a prefix of the gram, only append
      // the remainder so the existing letters complete the GramTile.
      let overlap = 0;
      for (let k = upperGram.length - 1; k > 0; k--) {
        if (currentGuess.endsWith(upperGram.slice(0, k))) {
          overlap = k;
          break;
        }
      }
      const toAppend = upperGram.slice(overlap);
      if (currentGuess.length + toAppend.length > wordLength) break;
      setSkipGramAnimation(true);
      for (const c of toAppend) {
        appendChar(c as Key);
      }
      break;
    }
    default:
      appendChar(key);
      break;
  }
}

function handleEditingKey(normalizedKey: Key): boolean {
  const { editing, editKey, setCharAt, removeCharAt } = useGameStore.getState();
  if (!editing.toggled) return false;
  if (normalizedKey === "Enter") {
    editKey(editing.key, false);
    return true;
  }
  if (normalizedKey === "Backspace") {
    removeCharAt(editing.key);
    editKey(editing.key, false);
    return true;
  }
  if (normalizedKey === "Blank") {
    setCharAt(editing.key, " ");
    return true;
  }
  if (/^[A-Z]$/.test(normalizedKey)) {
    setCharAt(editing.key, normalizedKey);
    return true;
  }
  return true;
}

export default function useKeyboardInput(
  focusedKeyIndex: number | null = null,
  allKeys: Key[] = [],
  onSubmit?: () => void,
) {
  const isPaused = useGameStore((s) => s.isPaused);
  const editingToggled = useGameStore((s) => s.editing.toggled);
  const editingKey = useGameStore((s) => s.editing.key);
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const longPressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const clearLongPressTimers = () => {
    if (longPressTimeoutRef.current !== null) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (longPressIntervalRef.current !== null) {
      clearInterval(longPressIntervalRef.current);
      longPressIntervalRef.current = null;
    }
  };

  const isRepeatableKey = (key: Key) =>
    key === "Backspace" || key === "Blank" || /^[A-Z]$/.test(key);

  const startLongPressRepeat = (key: Key) => {
    clearLongPressTimers();
    longPressTimeoutRef.current = setTimeout(() => {
      longPressIntervalRef.current = setInterval(() => {
        const { isPaused: paused, status, editing } = useGameStore.getState();
        if (paused || status !== "IN_PROGRESS" || editing.toggled) {
          clearLongPressTimers();
          return;
        }
        dispatchKey(key, false);
      }, 60);
    }, 200);
  };

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

    if (handleEditingKey(normalizedKey)) {
      return;
    }

    const parsedKey = parseKey({ key, remove: false });
    if (parsedKey === "Enter") {
      onSubmit?.();
      return;
    }
    dispatchKey(parsedKey, false);

    if (isRepeatableKey(parsedKey)) {
      startLongPressRepeat(parsedKey);
    }
  };

  // handle pointer up or touch up on key button
  const handleKeyPointerUp = (key: Key) => {
    clearLongPressTimers();
    removeSelectedKey(key);
  };

  // handle a press on an actual physical keyboard
  const handleKeyboardPress = (event: KeyboardEvent) => {
    let { key } = event;
    const activeElement = document.activeElement as HTMLElement;

    // Don't allow input if game is paused (e.g. when a dialog is open)
    // or if the game has finished
    const { isPaused: paused, status } = useGameStore.getState();
    if (paused || status !== "IN_PROGRESS") {
      return;
    }

    if (key === "Escape") {
      const { editing, editKey } = useGameStore.getState();
      if (editing.toggled) editKey(editing.key, false);
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

    if (handleEditingKey(normalizedKey)) {
      return;
    }

    const modifier = event.shiftKey || event.ctrlKey || event.metaKey;

    // If Enter is pressed and a key is focused, append that key instead of submitting
    if (normalizedKey === "Enter" && focusedKeyIndex !== null && focusedKeyIndex >= 0 && focusedKeyIndex < allKeys.length) {
      const focusedKey = allKeys[focusedKeyIndex];
      if (focusedKey && focusedKey !== "Enter") {
        const parsedKey = parseKey({ key: focusedKey, remove: false });
        dispatchKey(parsedKey, modifier);
        return;
      }
    }

    const parsedKey = parseKey({ key: normalizedKey, remove: false });
    if (parsedKey === "Enter") {
      onSubmit?.();
      return;
    }
    dispatchKey(parsedKey, modifier);
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
      clearLongPressTimers();
      setSelectedKeys([]);
    };

    document.addEventListener("keydown", handleKeyboardPress);
    document.addEventListener("keyup", handleKeyboardRelease);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("keydown", handleKeyboardPress);
      document.removeEventListener("keyup", handleKeyboardRelease);
      document.removeEventListener("pointerup", handlePointerUp);
      clearLongPressTimers();
    };
  }, [isPaused, focusedKeyIndex, allKeys, onSubmit]);

  useEffect(() => {
    if (!editingToggled) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-editable-tile]")) return;
      if (target.closest("[data-keyboard-container]")) return;
      useGameStore.getState().editKey(editingKey, false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [editingToggled, editingKey]);

  return {
    selectedKeys,
    setSelectedKeys,
    handleKeyPointerDown,
    handleKeyPointerUp,
  };
}
