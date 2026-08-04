import type { ObservationType, SummaryBucket } from "~/utils/game/analysis";

// Human-like phrasing for each observation and summary, five variants apiece so
// repeated plays do not read like the same canned template. Placeholders:
//   {letter}  representative letter (already uppercased)
//   {guess}   "guess N" for the representative instance
//   {count}   how many times the pattern occurred
//   {s}       "" when count is 1, otherwise "s" (pluralizer)
//   {n}       total guess count (summaries)

export const SUMMARY_PHRASES: Record<SummaryBucket, string[]> = {
  ace: [
    "One and done. You nailed it on the very first guess.",
    "A perfect opening: first guess, straight to the answer.",
    "Flawless. You solved it before most people finish reading the gram.",
    "Bullseye on move one. It does not get cleaner than that.",
    "First try, no misses. An immaculate solve.",
  ],
  greatWin: [
    "Sharp solve. You closed this out in {n} guesses with room to spare.",
    "That was a tidy {n}-guess win. You wasted very little.",
    "Strong game. You read the clues fast and finished in {n}.",
    "Efficient work, home in {n} guesses.",
    "Well played. {n} guesses and a confident finish.",
  ],
  solidWin: [
    "A solid win in {n}. You got there without much drama.",
    "Good game. {n} guesses, steady progress throughout.",
    "Nicely done. You worked it out in {n} without stalling.",
    "That is a dependable {n}-guess solve.",
    "Comfortable win in {n}. The clues added up.",
  ],
  scrappyWin: [
    "A scrappy one, but a win is a win. You brought it home in {n}.",
    "That went the distance at {n} guesses, but you found it.",
    "Hard fought. You needed all the way to guess {n}, and it paid off.",
    "You ground this out in {n}. Not pretty, but the answer is the answer.",
    "Close call at {n} guesses, but you got there in the end.",
  ],
  closeLoss: [
    "So close. You had most of the word figured out before the guesses ran out.",
    "A narrow miss. The letters were nearly all there.",
    "Tough one to drop. You were closing in when time ran out.",
    "You were on the right track. A guess or two more and this was yours.",
    "Painful miss. You had the shape of it, just not the finish.",
  ],
  toughLoss: [
    "A rough one. The gram never gave you much to work with.",
    "This puzzle kept its secrets. Hard to get a foothold today.",
    "Not your day. The clues stayed stubborn from the start.",
    "A tough loss. Few of the letters ever came into view.",
    "That one fought back. Little fell into place this time.",
  ],
};

export const OBSERVATION_PHRASES: Record<ObservationType, string[]> = {
  deduction: [
    "Nice deduction. You saw {letter} in the word, then worked out exactly where it went.",
    "You turned a yellow {letter} into a green. That is the good stuff.",
    "Placing {letter} after only seeing it misplaced earlier was a smart read.",
    "You reasoned {letter} into its correct spot instead of guessing. Well spotted.",
    "That {letter} placement was earned, not lucky. You knew where it belonged.",
  ],
  gramTriangulation: [
    "You hunted down the gram's spot, ruling out {count} wrong position{s} first.",
    "Good gram work. You eliminated {count} dead position{s} before locking it in.",
    "You triangulated the gram instead of hoping, crossing off {count} spot{s}.",
    "Smart probing. You narrowed the gram's home by ruling out {count} position{s}.",
    "You found the gram the hard way, eliminating {count} option{s} along the way.",
  ],
  cleanFinish: [
    "You walked into the final guess with the board nearly locked. That is how to close.",
    "By the last guess you had most of the word pinned. Clean finish.",
    "Great setup: you entered the winning guess with little left to chance.",
    "You did the work up front, so the final guess was almost a formality.",
    "Well built. The answer was boxed in before you played it.",
  ],
  efficientWin: [
    "You did not waste guesses getting here. Efficient all the way.",
    "Lean solve. Every guess pulled its weight.",
    "You kept it tight and reached the answer quickly.",
    "No detours. You moved straight toward the word.",
    "Economical play. You spent only what you needed.",
  ],
  broadTesting: [
    "You spread your guesses wide, testing {count} different letters to narrow the field.",
    "Good coverage. You checked {count} distinct letters before committing.",
    "You cast a wide net, probing {count} letters to shrink the possibilities.",
    "Thorough. {count} different letters tested means fewer surprises left.",
    "You gathered a lot of information: {count} letters ruled in or out.",
  ],
  reusedAbsent: [
    "On {guess} you played {letter} again after it had already come back gray.",
    "{letter} was already ruled out, but it turned up again on {guess}.",
    "You spent a slot on {letter} in {guess}, even though it was known absent.",
    "Careful with {letter}: it was gray earlier, yet reappeared on {guess}.",
    "Reusing {letter} on {guess} could not help. It was already off the board.",
  ],
  overwroteGreen: [
    "You had {letter} locked in green, then changed that spot on {guess}.",
    "{guess} moved away from a confirmed green {letter}. That gives up a sure thing.",
    "You overwrote a correct {letter} on {guess}. Hold your greens.",
    "A placed green {letter} got dropped in {guess}. Those are worth keeping.",
    "On {guess} you abandoned a confirmed {letter}. Lock greens and build around them.",
  ],
  reusedWrongSpot: [
    "You put {letter} back in a spot already ruled out for it on {guess}.",
    "{letter} was yellow in that exact position before, but landed there again on {guess}.",
    "On {guess}, {letter} went to a spot you already knew was wrong for it.",
    "That {letter} placement in {guess} repeated a position you had eliminated.",
    "You retried {letter} in a known-wrong spot on {guess}. Try a fresh position.",
  ],
  neglectedLetter: [
    "You knew {letter} was in the word, but {guess} left it out entirely.",
    "{letter} had shown up as present, yet {guess} did not use it.",
    "On {guess} you dropped {letter}, a letter you had already confirmed belongs.",
    "Do not forget your yellows: {letter} was known but missing from {guess}.",
    "You had {letter} to work with, but {guess} set it aside.",
  ],
  gramStuck: [
    "On {guess} you placed the gram where it had already been shown wrong.",
    "{guess} parked the gram on a spot you had already ruled out.",
    "That gram placement in {guess} retested a position you knew was wrong.",
    "You retried the gram's old wrong spot on {guess}. A fresh position learns more.",
    "The gram sat on a dead position again in {guess}. Move it somewhere new.",
  ],
  shortGuesses: [
    "Several guesses were short. Full-length words test more letters at once.",
    "You leaned on short guesses. Longer words squeeze more from each try.",
    "A few guesses came up short of the full word. Longer ones cover more ground.",
    "Short words leave letters untested. Try filling every slot when you can.",
    "You played it small on length. Full-length guesses narrow things faster.",
  ],
};
