// "Forced"-penalty checks: was there a legal alternative guess that would have avoided a charge?
// A penalty (leaving a known letter unused, re-parking the gram on a ruled-out spot) is only a skill
// error if the player COULD have done otherwise. `probePool` is the gram's valid guess words WITH THE
// ANSWER REMOVED -- the answer is never a "probe", since playing it ends the game -- so a behavior is
// avoidable only when some UNPLAYED word in this pool could have avoided it. When probePool is absent
// the checks default to "avoidable", so every charge stands as before (old callers, tests, the sim).
// These are pure functions with no server dependencies, shared by score.ts and analysis.ts.

export interface Availability {
  probePool?: string[];
  gram?: string;
  wordLength?: number;
}

// All start indices of the gram within a word (a word may contain it more than once).
export function gramIndicesIn(word: string, gram: string): number[] {
  const out: number[] = [];
  let idx = word.indexOf(gram);
  while (idx !== -1) {
    out.push(idx);
    idx = word.indexOf(gram, idx + 1);
  }
  return out;
}

// Could the player still have TESTED a fresh (not-yet-ruled-out) gram position with some unplayed,
// non-answer word? A word slides freely, so its gram can land at any absolute column reachable by a
// legal offset: for a natural occurrence at index g in a word of length `len`, offsets 0..(wordLength-
// len) put the gram at columns g..g+(wordLength-len). If any such reachable column is not already
// known-wrong, a fresh probe existed and re-parking on a dead spot was a choice (charge stands).
export function freshGramPositionReachable(
  avail: Availability | undefined,
  played: Set<string>,
  knownWrong: Set<number>
): boolean {
  if (!avail?.probePool || !avail.gram || avail.wordLength == null) return true;
  const maxStart = avail.wordLength - avail.gram.length;
  for (const w of avail.probePool) {
    if (played.has(w)) continue;
    for (const g of gramIndicesIn(w, avail.gram)) {
      const lo = Math.max(0, g);
      const hi = Math.min(maxStart, g + (avail.wordLength - w.length));
      for (let p = lo; p <= hi; p++) {
        if (!knownWrong.has(p)) return true;
      }
    }
  }
  return false;
}

// Could the player still have INCLUDED letter `L` in a guess? True if some unplayed, non-answer word
// contains it. If the only remaining word with `L` is the answer (or all others are already played),
// omitting it was forced, not neglect.
export function letterProbeable(
  probePool: string[] | undefined,
  played: Set<string>,
  L: string
): boolean {
  if (!probePool) return true;
  return probePool.some((w) => !played.has(w) && w.includes(L));
}

// The bare word a guess string commits (offset blanks stripped), matched against the probe pool.
export const guessWord = (g: string) => g.replace(/ /g, "");
