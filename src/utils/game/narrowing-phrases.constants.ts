// Headline phrasing for the narrowing story, five variants per outcome bucket.
// Placeholders:
//   {start}       candidate answers before any guess
//   {solvedWith}  candidates still standing entering the winning guess
//   {end}         candidates still standing at the end of a loss
//   {n}           total guesses played

export type NarrowingBucket = "locked" | "narrowed" | "lost";

export const NARROWING_PHRASES: Record<NarrowingBucket, string[]> = {
  // Won with the answer fully pinned down (1 candidate) before the final guess.
  locked: [
    "From {start} possible words, you narrowed it to exactly one before the winning guess. Fully earned.",
    "You started with {start} candidates and left nothing to chance: down to a single answer, then done.",
    "{start} words fit the gram. You eliminated every one but the answer before playing it.",
    "No luck needed. You cut {start} possibilities to one, then placed it.",
    "You backed the answer into a corner: {start} words down to the only one that fit.",
  ],
  // Won, but with more than one candidate still possible at the finish.
  narrowed: [
    "You carved {start} possible words down to {solvedWith}, then found it on guess {n}.",
    "From {start} candidates to {solvedWith} at the finish. A little luck sealed guess {n}.",
    "You narrowed the field from {start} to {solvedWith}, then guessed the answer out of what was left.",
    "{start} words fit the gram; you had it down to {solvedWith} when you struck on guess {n}.",
    "Good narrowing: {start} to {solvedWith} possibilities, then home on guess {n}.",
  ],
  // Lost: show how far the field was cut before the guesses ran out.
  lost: [
    "You cut {start} possible words down to {end}, but the answer slipped away.",
    "From {start} candidates to {end}: you were closing the net when the guesses ran out.",
    "You narrowed the field from {start} to {end}. Close, but it stayed hidden.",
    "{start} words fit the gram; you had it down to {end} and just missed.",
    "You trimmed {start} possibilities to {end} before time ran out.",
  ],
};
