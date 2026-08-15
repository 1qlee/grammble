import { useEffect, useRef, useState } from "react";
import { useGameStore, type LetterFeedback } from "~/stores/game-store";

interface Params {
  guess: string;
  gram: string;
  feedback?: LetterFeedback[];
  isCurrentRow: boolean;
}

export interface GramPosition {
  gramStart: number;
  hasGram: boolean;
  gridColumnStart: number;
  charsForTile: [string, string];
  feedbackForTile?: LetterFeedback;
}

export function useGramPosition({
  guess,
  gram,
  feedback,
  isCurrentRow,
}: Params): GramPosition {
  const editingToggled = useGameStore((s) => s.editing.toggled);
  const editingKey = useGameStore((s) => s.editing.key);

  const feedbackGramStart =
    feedback?.findIndex(
      (f) => f === "gramCorrect" || f === "gramMisplaced",
    ) ?? -1;
  const liveGramStart =
    feedbackGramStart !== -1
      ? feedbackGramStart
      : gram.length > 0
        ? guess.indexOf(gram)
        : -1;
  const liveHasGram = liveGramStart !== -1;

  const freezeActive = isCurrentRow && editingToggled;
  const frozenRef = useRef<{ gramStart: number; hasGram: boolean } | null>(
    null,
  );
  const frozenKeyRef = useRef<number | null>(null);
  if (freezeActive) {
    // Re-capture when entering edit mode or when switching to a different tile,
    // so the gram recalibrates to the live (possibly broken) state before the
    // next freeze rather than holding the previous tile's frozen position.
    if (!frozenRef.current || frozenKeyRef.current !== editingKey) {
      frozenRef.current = { gramStart: liveGramStart, hasGram: liveHasGram };
      frozenKeyRef.current = editingKey;
    }
  } else if (frozenRef.current) {
    frozenRef.current = null;
    frozenKeyRef.current = null;
  }

  const gramStart = frozenRef.current
    ? frozenRef.current.gramStart
    : liveGramStart;
  const hasGram = frozenRef.current ? frozenRef.current.hasGram : liveHasGram;

  const [stableGramStart, setStableGramStart] = useState(gramStart);
  useEffect(() => {
    if (gramStart !== -1) setStableGramStart(gramStart);
  }, [gramStart]);

  const activeStart = hasGram ? gramStart : stableGramStart;
  const parkColumn =
    stableGramStart !== -1 ? stableGramStart + 1 : Math.max(1, guess.length);
  const gridColumnStart = hasGram ? gramStart + 1 : parkColumn;
  const charsForTile: [string, string] =
    activeStart !== -1
      ? [guess[activeStart] ?? "", guess[activeStart + 1] ?? ""]
      : ["", ""];
  const feedbackForTile =
    activeStart !== -1 ? feedback?.[activeStart] : undefined;

  return {
    gramStart,
    hasGram,
    gridColumnStart,
    charsForTile,
    feedbackForTile,
  };
}
