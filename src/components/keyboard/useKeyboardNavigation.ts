import { useEffect, useState, useRef, useMemo, useCallback, type RefObject } from "react";
import type { Key } from "./Keyboard.types";
import { KeyboardRows } from "./Keyboard.data";

/**
 * Hook to handle keyboard navigation (arrow keys) for the virtual keyboard
 * Allows left/right arrow keys to move focus between keys
 */
export function useKeyboardNavigation(keyButtonRefs: RefObject<(HTMLButtonElement | null)[]>) {
  const [focusedKeyIndex, setFocusedKeyIndex] = useState<number | null>(null);

  // Track the current track (clusterIndex, columnIndex) for each key
  // This is needed because some keys appear in multiple tracks (e.g., X appears in both W→S→X and E→D→X)
  const currentTrackForKey = useRef<Map<number, { clusterIndex: number; columnIndex: number }>>(new Map());

  // Flatten keyboard rows into a single array, excluding spacers
  // Memoized since it's used in render (allKeys.indexOf) and KeyboardRows is stable
  const allKeys = useMemo(
    () => KeyboardRows.flat().filter((key) => key !== "spacer") as Key[],
    []
  );

  // Define the 3 vertical clusters as columns
  // Each cluster contains multiple columns that go vertically down through rows
  // Cluster 0: Q-W-E columns, A-S-D columns, Z-X columns, Blank column
  // Cluster 1: R-T-Y-U columns, F-G-H columns, C-V-B columns, Gram column
  // Cluster 2: I-O-P columns, J-K-L columns, N-M-Backspace columns, Enter column
  // Memoized since it's a constant structure that doesn't depend on any props/state
  const clusters: number[][][] = useMemo(
    () => [
      // Cluster 0 (first third) - each sub-array is a vertical column
      [
        [0, 10, 19, 27],   // Q → A → Z → Blank
        [1, 11, 20, 27],   // W → S → X → Blank
        [2, 12, 20, 27],   // E → D → X → Blank
      ],
      // Cluster 1 (middle third)
      [
        [3, 13, 21, 28],   // R → F → C → Gram
        [4, 14, 22, 28],   // T → G → V → Gram
        [5, 15, 23, 28],   // Y → H → B → Gram
        [6, 15, 23, 28],   // U → H → B → Gram
      ],
      // Cluster 2 (last third)
      [
        [7, 16, 24, 29],   // I → J → N → Enter
        [8, 17, 25, 29],   // O → K → M → Enter
        [9, 18, 26, 29],   // P → L → Backspace → Enter
      ],
    ],
    []
  );

  /**
   * Get the cluster index, column index, and row position for a given flattened index
   * If a track is already tracked for this key, use it; otherwise find the first matching track
   */
  const getClusterPosition = (flattenedIndex: number): { clusterIndex: number; columnIndex: number; rowInColumn: number } | null => {
    // First, check if we have a tracked track for this key
    if (currentTrackForKey.current.has(flattenedIndex)) {
      const tracked = currentTrackForKey.current.get(flattenedIndex)!;
      const column = clusters[tracked.clusterIndex][tracked.columnIndex];
      const rowInColumn = column.indexOf(flattenedIndex);
      if (rowInColumn !== -1) {
        return { ...tracked, rowInColumn };
      }
    }

    // Otherwise, find the first matching track
    for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++) {
      const cluster = clusters[clusterIndex];
      for (let columnIndex = 0; columnIndex < cluster.length; columnIndex++) {
        const column = cluster[columnIndex];
        const rowInColumn = column.indexOf(flattenedIndex);
        if (rowInColumn !== -1) {
          return { clusterIndex, columnIndex, rowInColumn };
        }
      }
    }
    return null;
  };

  // Focus a key by its index in the flattened keys array
  // Memoized since it's returned from the hook and may be used by consumers
  const focusKeyByIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= allKeys.length) {
        return;
      }

      const button = keyButtonRefs.current[index];
      if (button) {
        button.focus();
        setFocusedKeyIndex(index);
      }
    },
    [allKeys.length, keyButtonRefs]
  );

  const handleArrowKeyNavigation = (event: KeyboardEvent) => {
    let newIndex: number | null = null;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        // Move to previous key, wrap to end if at beginning
        newIndex = focusedKeyIndex !== null && focusedKeyIndex > 0 ? focusedKeyIndex - 1 : allKeys.length - 1;
        // Clear track for the new key since we're not navigating vertically
        if (newIndex !== null) {
          currentTrackForKey.current.delete(newIndex);
        }
        break;
      case "ArrowRight":
        event.preventDefault();
        // Move to next key, wrap to beginning if at end
        newIndex = focusedKeyIndex !== null && focusedKeyIndex < allKeys.length - 1 ? focusedKeyIndex + 1 : 0;
        // Clear track for the new key since we're not navigating vertically
        if (newIndex !== null) {
          currentTrackForKey.current.delete(newIndex);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (focusedKeyIndex === null) {
          return;
        }
        // Move up within the same column, cycling from top to bottom
        const currentClusterPos = getClusterPosition(focusedKeyIndex);
        if (currentClusterPos) {
          const { clusterIndex, columnIndex, rowInColumn } = currentClusterPos;
          const column = clusters[clusterIndex][columnIndex];
          // Move to previous row in column, wrap to end if at beginning
          const newRowInColumn = rowInColumn > 0 ? rowInColumn - 1 : column.length - 1;
          newIndex = column[newRowInColumn];

          // Track the track we're using for the new key
          if (newIndex !== null) {
            currentTrackForKey.current.set(newIndex, { clusterIndex, columnIndex });
          }
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        if (focusedKeyIndex === null) {
          return;
        }
        // Move down within the same column, cycling from bottom to top
        const currentClusterPosDown = getClusterPosition(focusedKeyIndex);
        if (currentClusterPosDown) {
          const { clusterIndex, columnIndex, rowInColumn } = currentClusterPosDown;
          const column = clusters[clusterIndex][columnIndex];
          // Move to next row in column, wrap to beginning if at end
          const newRowInColumn = rowInColumn < column.length - 1 ? rowInColumn + 1 : 0;
          newIndex = column[newRowInColumn];

          // Track the track we're using for the new key
          if (newIndex !== null) {
            currentTrackForKey.current.set(newIndex, { clusterIndex, columnIndex });
          }
        }
        break;
      default:
        return;
    }

    if (newIndex !== null) {
      focusKeyByIndex(newIndex);
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleArrowKeyNavigation);

    return () => {
      document.removeEventListener("keydown", handleArrowKeyNavigation);
    };
  }, [focusedKeyIndex]);

  useEffect(() => {
    if (focusedKeyIndex !== null && focusedKeyIndex >= 0 && keyButtonRefs.current[focusedKeyIndex]) {
      keyButtonRefs.current[focusedKeyIndex]?.focus();
    }
  }, [focusedKeyIndex])

  return {
    allKeys,
    focusedKeyIndex,
    focusKeyByIndex,
    setFocusedKeyIndex,
  };
}
