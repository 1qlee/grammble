import { type CSSProperties } from "react";
import { useGameStore } from "~/stores/game-store";
import { MAX_GUESSES } from "~/utils/game/constants";
import { GuessRow } from "~/components/guesses/GuessRow";
import type { NoteCell } from "~/utils/game/note-tiles";

/**
 * The player's board at recap scale, built up one guess at a time: just the `revealCount` submitted
 * rows played so far (each with its real feedback), no empty rows. Renders the same GuessRow the
 * live board uses, so the gram tile and feedback are pixel-for-pixel the real thing; it just reads
 * the recapped game from the store and sizes the tiles to its own width.
 *
 * Sizing: the card is a size container, so `--tile-size` derives from its content width (100cqw)
 * rather than the viewport. Rows carry no padding here (`padded={false}`), so the formula only backs
 * out the inter-tile gaps: `cols` tiles plus their gaps fill the row exactly, and every tile-derived
 * value (font size, corner radius, the gram overlay's offset) scales off that one variable.
 */
export function RecapBoard({
  revealCount,
  highlight,
}: {
  revealCount: number;
  // A note highlight from the score breakdown: the exact board cells to emphasise (every other tile
  // in a row that contains a highlighted cell is dimmed). Null when nothing is hovered/tapped. Rows
  // with no highlighted cell render normally, so a note can point at any row (e.g. neglect highlights
  // an omitted letter's earliest appearance, not the note's own guess row).
  highlight?: NoteCell[] | null;
}) {
  const guesses = useGameStore((s) => s.guesses);
  const feedback = useGameStore((s) => s.feedback);
  const gram = useGameStore((s) => s.gram);
  const wordLength = useGameStore((s) => s.wordLength);

  const shown = Math.min(revealCount, MAX_GUESSES);
  const newestIdx = shown - 1;

  return (
    <div
      className="bg-default flex w-full flex-col gap-[2px]"
      style={
        {
          containerType: "inline-size",
          "--cols": String(wordLength),
          "--tile-gap": "2px",
          "--tile-size":
            "calc((100cqw - (var(--cols) - 1) * var(--tile-gap)) / var(--cols))",
          "--tile-font-size": "max(8px, calc(var(--tile-size) * 0.46))",
        } as CSSProperties
      }
    >
      {Array.from({ length: shown }, (_, i) => {
        const revealed = !!guesses[i] && !!feedback[i];
        // While a note is active every row reacts: this row's matching cells stay lit, every other
        // tile on the board dims. A row with no matching cell gets an empty list, dimming all of it.
        const rowCells = highlight
          ? highlight.filter((cell) => cell.row === i)
          : [];
        const rowCols = rowCells.map((cell) => cell.col);
        // Cells the note points BACK to on an earlier row (an overwritten green's origin) get a
        // heavier border to set them apart from the note's own guess-row tiles.
        const originCols = rowCells
          .filter((cell) => cell.origin)
          .map((cell) => cell.col);
        return (
          <GuessRow
            key={i}
            guess={revealed ? guesses[i] : ""}
            feedback={revealed ? feedback[i] : undefined}
            gram={gram}
            cols={wordLength}
            isCurrentRow={false}
            isFirstRow={i === 0}
            isLastRow={i === shown - 1}
            revealRow={i === newestIdx ? 0 : undefined}
            animateIn={i === newestIdx}
            padded={false}
            highlightCols={highlight ? rowCols : undefined}
            originCols={highlight ? originCols : undefined}
          />
        );
      })}
    </div>
  );
}
