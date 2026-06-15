import type { LetterFeedback } from "./types";

function findAllOccurrences(haystack: string, needle: string): number[] {
  const indices: number[] = [];
  if (needle.length === 0) return indices;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    indices.push(i);
    i = haystack.indexOf(needle, i + 1);
  }
  return indices;
}

export function computeFeedback(
  guess: string,
  hiddenWord: string,
  gram: string,
): LetterFeedback[] {
  const g = guess.toUpperCase();
  const h = hiddenWord.toUpperCase();
  const gr = gram.toUpperCase();
  const feedback: LetterFeedback[] = new Array(g.length);
  const used = new Array(h.length).fill(false);

  const guessOccurrences = findAllOccurrences(g, gr);
  const hiddenOccurrences = findAllOccurrences(h, gr);

  if (guessOccurrences.length === 0 || hiddenOccurrences.length === 0) {
    throw new Error("Gram not present in both guess and hidden word");
  }

  const alignedIndex = guessOccurrences.find((gi: number) =>
    hiddenOccurrences.includes(gi),
  );
  const gramAligned = alignedIndex !== undefined;

  const guessGramIndex = gramAligned ? alignedIndex : guessOccurrences[0];
  const hiddenGramIndex = gramAligned ? alignedIndex : hiddenOccurrences[0];
  const gramEnd = guessGramIndex + gr.length;

  for (let i = guessGramIndex; i < gramEnd; i++) {
    feedback[i] = gramAligned ? "gramCorrect" : "gramMisplaced";
  }

  for (let j = hiddenGramIndex; j < hiddenGramIndex + gr.length; j++) {
    used[j] = true;
  }

  for (let i = 0; i < g.length; i++) {
    if (feedback[i] != null) continue;
    if (i < h.length && g[i] === h[i] && !used[i]) {
      feedback[i] = "correct";
      used[i] = true;
    }
  }

  for (let i = 0; i < g.length; i++) {
    if (feedback[i] != null) continue;

    const matchIndex = h
      .split("")
      .findIndex((ch, j) => ch === g[i] && !used[j]);

    if (matchIndex !== -1) {
      feedback[i] = "misplaced";
      used[matchIndex] = true;
    } else {
      feedback[i] = "absent";
    }
  }

  return feedback;
}
