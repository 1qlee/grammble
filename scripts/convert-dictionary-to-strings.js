import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Converts a dictionary object to an array of string values (keys)
 * @param {Object} dictionary - The dictionary object where keys are words and values are numbers
 * @returns {string[]} - Array of word strings (sorted alphabetically)
 */
function convertDictionaryToStrings(dictionary) {
  return Object.keys(dictionary).sort();
}

// Read the dictionary file
const dictionaryPath = join(__dirname, "censor", "words_dictionary.json");
const dictionaryContent = readFileSync(dictionaryPath, "utf-8");
const dictionary = JSON.parse(dictionaryContent);

// Convert to array of strings
const wordsArray = convertDictionaryToStrings(dictionary);

// Output as JSON
const output = JSON.stringify(wordsArray, null, 2);

console.log(output);

// Optionally write to a file
writeFileSync(
  join(__dirname, "censor", "words_dictionary_strings.json"),
  output,
  "utf-8"
);
