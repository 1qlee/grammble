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
 * Filters a whitelist to keep only words that contain a blacklist term.
 * Both whitelist and blacklist words are sanitized before comparison.
 * @param {string[]} whitelist - The full whitelist dictionary
 * @param {string[]} blacklist - The list of blacklisted terms
 * @returns {string[]} - A filtered whitelist containing only words that contain blacklist terms
 */
function generateOptimizedWhitelist(whitelist, blacklist) {
  const optimizedSet = new Set();
  
  // Sanitize all blacklist terms once for efficiency
  const sanitizedBlacklist = blacklist.map(sanitizeWord).filter(word => word.length > 0);

  console.log(`Checking ${whitelist.length} whitelist words against ${sanitizedBlacklist.length} blacklist terms...`);

  for (const safeWord of whitelist) {
    // Sanitize the whitelist word to match the format of blacklist words
    const sanitizedSafeWord = sanitizeWord(safeWord);

    // Check if the sanitized whitelist word contains any blacklist term
    for (const badWord of sanitizedBlacklist) {
      if (sanitizedSafeWord.includes(badWord)) {
        // Keep the original word (not sanitized) in the output
        optimizedSet.add(safeWord);
        break; // Once we know it's relevant, we don't need to check other bad words
      }
    }
  }

  return Array.from(optimizedSet);
}

// Read the whitelist
const whitelistPath = join(__dirname, "censor", "whitelist.json");
const whitelistContent = readFileSync(whitelistPath, "utf-8");
const whitelist = JSON.parse(whitelistContent);

// Read the blacklist
const blacklistPath = join(__dirname, "censor", "blacklist.json");
const blacklistContent = readFileSync(blacklistPath, "utf-8");
const blacklist = JSON.parse(blacklistContent);

// Generate optimized whitelist
console.log(
  `Processing ${whitelist.length} words from whitelist against ${blacklist.length} blacklist terms...`
);
const optimizedWhitelist = generateOptimizedWhitelist(whitelist, blacklist);

// Sort the result
optimizedWhitelist.sort();

// Output as JSON
const output = JSON.stringify(optimizedWhitelist, null, 2);

// Write to file
const outputPath = join(__dirname, "censor", "optimized-whitelist.json");
writeFileSync(outputPath, output, "utf-8");

console.log(
  `Generated optimized whitelist with ${optimizedWhitelist.length} words`
);
console.log(`Output saved to: ${outputPath}`);

