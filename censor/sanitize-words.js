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

// Read the words file
const wordsPath = join(__dirname, "censor", "profanity.txt");
const content = readFileSync(wordsPath, "utf-8");

// Split by newlines, filter out empty lines, and sanitize
const words = content
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .map(sanitizeWord)
  .filter((word) => word.length > 0); // Remove any empty strings after sanitization

// Remove duplicates and sort
const uniqueWords = [...new Set(words)].sort();

// Output as JSON
const output = JSON.stringify(uniqueWords, null, 2);

console.log(output);

// Optionally write to a file
writeFileSync(
  join(__dirname, "censor", "words-sanitized.json"),
  output,
  "utf-8"
);
