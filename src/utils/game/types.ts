export type LetterFeedback =
  | "correct"
  | "misplaced"
  | "absent"
  | "gramCorrect"
  | "gramMisplaced"
  // A column the guess left empty (a leading/offset blank tile). The player
  // placed a word shorter than the board and slid it over, so this column got
  // no letter and carries no feedback. Feedback stays column-indexed, so a blank
  // holds the slot rather than shifting every later tile.
  | "blank";
