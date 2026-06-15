import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Removes accents/diacritics from a string
 * @param {string} str - The string to normalize
 * @returns {string} - The string with accents removed
 */
function removeAccents(str) {
  return str
    .normalize("NFD") // Decompose characters into base + combining marks
    .replace(/[\u0300-\u036f]/g, ""); // Remove combining diacritical marks
}

/**
 * Sanitizes a word: trims, lowercases, removes accents, removes punctuation, and removes all spaces
 * @param {string} word - The word to sanitize
 * @returns {string} - The sanitized word
 */
function sanitizeWord(word) {
  return removeAccents(word.trim().toLowerCase())
    .replace(/[^a-z0-9]/g, "") // Remove all punctuation and spaces (keep only alphanumeric)
    .trim(); // Trim again after removal
}

/**
 * Filters a large whitelist to keep only words that contain a blacklist term.
 * Both whitelist and blacklist words are sanitized before comparison.
 * @param {string[]} fullWhitelist - The complete dictionary (e.g., english-words)
 * @param {string[]} blacklist - Your list of root bad words (e.g., "ass")
 * @returns {string[]} - A smaller, highly relevant whitelist (original words, not sanitized)
 */
function generateOptimizedWhitelist(fullWhitelist, blacklist) {
  const optimizedSet = new Set();

  for (const safeWord of fullWhitelist) {
    // Sanitize the whitelist word to match the format of blacklist words
    const sanitizedSafeWord = sanitizeWord(safeWord);

    // Check if the sanitized whitelist word contains any blacklist term
    for (const badWord of blacklist) {
      // Blacklist words are already sanitized, so we can compare directly
      if (sanitizedSafeWord.includes(badWord)) {
        // Keep the original word (not sanitized) in the output
        optimizedSet.add(safeWord);
        break; // Once we know it's relevant, we don't need to check other bad words
      }
    }
  }

  return Array.from(optimizedSet);
}

// Read the full whitelist (dictionary)
const fullWhitelistPath = join(__dirname, "censor", "whitelist.json");
const fullWhitelistContent = readFileSync(fullWhitelistPath, "utf-8");
const fullWhitelist = JSON.parse(fullWhitelistContent);

// Read the blacklist (sanitized bad words)
const blacklistPath = join(__dirname, "censor", "blacklist.json");
const blacklistContent = readFileSync(blacklistPath, "utf-8");
const blacklist = JSON.parse(blacklistContent);

// Generate optimized whitelist
console.log(
  `Processing ${fullWhitelist.length} words from whitelist against ${blacklist.length} blacklist terms...`
);
const optimizedWhitelist = generateOptimizedWhitelist(fullWhitelist, blacklist);

// Sort the result
optimizedWhitelist.sort();

// Output as JSON
const output = JSON.stringify(optimizedWhitelist, null, 2);

// Write to file
const outputPath = join(__dirname, "censor", "words-optimized.json");
writeFileSync(outputPath, output, "utf-8");

console.log(
  `Generated optimized whitelist with ${optimizedWhitelist.length} words`
);
console.log(`Output saved to: ${outputPath}`);
