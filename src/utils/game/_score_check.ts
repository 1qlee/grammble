import { computePuzzleScore } from "./score";
import { computeFeedback } from "./feedback";

function game(label: string, hidden: string, gram: string, guesses: string[]) {
  const feedback = guesses.map((g) => computeFeedback(g, hidden, gram));
  const won = guesses[guesses.length - 1] === hidden;
  const score = computePuzzleScore({ guesses, feedback, won, wordLength: hidden.length });
  console.log(`${label.padEnd(40)} ${score}`);
}

// 1-guess ace
game("1: FUSION (ace)", "FUSION", "on", ["FUSION"]);

// 2-guess ladder
game("2: SALMON->SALOON (3 greens placed)", "SALOON", "on", ["SALMON", "SALOON"]);
game("2: PYLON->SALOON (cold opener)", "SALOON", "on", ["PYLON", "SALOON"]);

// 3-guess: full-length vs a short 4-letter opener
game("3: CANTON LESION FUSION (full len)", "FUSION", "on", ["CANTON", "LESION", "FUSION"]);
game("3: LION LESION FUSION (4-let open)", "FUSION", "on", ["LION", "LESION", "FUSION"]);

// 4 and 6-guess wins
game("4: RATION MOTION VISION FUSION", "FUSION", "on", ["RATION", "MOTION", "VISION", "FUSION"]);
game("6: scrappy 6-guess win", "FUSION", "on", ["RATION", "MOTION", "LESION", "VISION", "PRISON", "FUSION"]);

// losses (6 guesses, never solved)
game("L: full-length, learned a lot", "FUSION", "on", ["VISION", "MOTION", "RATION", "PRISON", "LESION", "DEMONS"]);
game("L: short probes, learned little", "FUSION", "on", ["IRON", "ONLY", "PONY", "BONY", "TONY", "CONK"]);
