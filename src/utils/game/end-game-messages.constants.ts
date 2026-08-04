import type { GameMode } from "~/utils/game/constants";

// Flavor headline shown at the top of the end-game dialog, keyed by the number
// of guesses it took to win (1-6). LOSS covers a failed puzzle. Roughly ten
// options per bucket; the dialog picks one deterministically off the puzzle
// number so it stays stable across re-renders but varies day to day.
export const WIN_MESSAGES: Record<number, string[]> = {
  1: [
    "Hot damn 🔥, first try?!",
    "I-it's not possible! Word-in-one!",
    "Behold, the power of your brain.",
    "You dropped this. 👑",
    "Are you a dictionary?!",
    "First guess, no notes.",
    "And the Grammy goes to... you! 🏆",
    "Here's a word for you: G-E-N-I-U-S.",
    "Bullseye on the first dart. 🎯",
    "Flawless. Absolutely flawless.",
  ],
  2: [
    "We got a word wiz over here!",
    "You made it look easy.",
    "A certified gram slam! 💥",
    "Two and through. So clean.",
    "I can be more difficult, I swear!",
    "Sharp as a tack today, huh?",
    "You're locked in. 🔒",
  ],
  3: [
    "Nice job! 👏",
    "Not too shabby!",
    "Ding ding ding!",
    "Great work there!",
    "You got it!",
    "That'll do the trick!",
    "A job well done!",
    "Right on the money.",
    "Clean solve, no fuss.",
  ],
  4: [
    "You did it! You really did it!",
    "Bravo! Took some grinding. 💪",
    "Persistence pays off!",
    "Pulled it off in the end.",
    "Nice recovery there!",
    "That'll do nicely.",
    "You earned that one.",
    "Found it! Knew you had it in you.",
    "Made every guess count.",
  ],
  5: [
    "That almost went south... 😅",
    "That was intense!",
    "WHEW! 💦",
    "That was a close one.",
    "Living on the edge, huh?",
    "You had me on the edge of my seat!",
    "I was worried for a second there.",
    "You cut that real close.",
  ],
  6: [
    "A real nail-biter!",
    "Down to the very last guess!",
    "At the buzzer! 🚨",
    "For a second, I wasn't sure you'd make it.",
    "No room to spare on that one.",
    "Survived by the skin of your teeth.",
    "Final row, final answer, phew.",
    "That was way too close for comfort.",
    "A buzzer-beater!",
  ],
};

export const LOSS_MESSAGES: string[] = [
  "Better luck tomorrow! 🌙",
  "So close, I could feel it.",
  "Tomorrow's another shot.",
  "Not today, my friend.",
  "Oof, tough one. 😞",
  "It happens to the best of us.",
  "Shake it off, you'll get the next.",
  "Almost had it!",
  "On to the next one. 💪",
  "The Gram got the better of us today.",
];

// Number words for the green banner headline ("Six in two.").
export const GUESS_COUNT_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
};

// Length word per mode for the banner headline ("Six in two.").
export const MODE_LENGTH_WORDS: Record<GameMode, string> = {
  SIX: "Six",
  SEVEN: "Seven",
  EIGHT: "Eight",
};

export function pickMessage(
  won: boolean,
  guessCount: number,
  seed: number,
): string {
  const pool = won ? (WIN_MESSAGES[guessCount] ?? []) : LOSS_MESSAGES;
  const fallback = won ? "Nice job! 👏" : "Better luck tomorrow! 🌙";
  if (pool.length === 0) return fallback;
  const index = Math.abs(seed) % pool.length;
  return pool[index];
}
