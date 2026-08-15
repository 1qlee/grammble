import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Terms related to phobias/prejudices against groups of people
const termsToRemove = [
  // Antisemitism
  "antisemitic",
  "antisemitism",

  // Gender-related phobias/prejudices
  "androphobia", // fear of men
  "anthropophobia", // fear of people (can be used in prejudicial contexts)
  "misandry", // hatred of men
  "misogynist", // hatred of women
  "misogynistic",
  "misogyny",

  // Ethnic/national phobias
  "celtophobia", // fear/prejudice against Celts
  "russophobia", // fear/prejudice against Russians

  // LGBT+ phobias (if they exist)
  "homophobia",
  "homophobic",
  "transphobia",
  "transphobic",
  "biphobia",
  "biphobic",
  "lesbophobia",
  "lesbophobic",
  "fatphobia",
  "fatphobic",

  // Other group-related phobias
  "xenophobia",
  "xenophobic",
  "islamophobia",
  "islamophobic",
  "judeophobia",
  "sinophobia",
  "afrophobia",
  "hispanophobia",
  "anglophobia",
  "francophobia",
  "germanophobia",
  "gynophobia",
  "gynophobic",
];

// Read the whitelist
const whitelistPath = join(__dirname, "censor", "whitelist.json");
const whitelistContent = readFileSync(whitelistPath, "utf-8");
const whitelist = JSON.parse(whitelistContent);

console.log(`Original whitelist has ${whitelist.length} words`);

// Create a set for fast lookup (case-insensitive)
const termsToRemoveSet = new Set(
  termsToRemove.map((term) => term.toLowerCase())
);

// Filter out the terms (case-insensitive comparison)
const filteredWhitelist = whitelist.filter((word) => {
  const lowerWord = word.toLowerCase();
  return !termsToRemoveSet.has(lowerWord);
});

// Find which terms were actually removed (case-insensitive)
const removed = [];
const whitelistLower = new Set(whitelist.map((w) => w.toLowerCase()));
for (const term of termsToRemove) {
  if (whitelistLower.has(term.toLowerCase())) {
    // Find the actual word in the whitelist (preserving original case)
    const found = whitelist.find((w) => w.toLowerCase() === term.toLowerCase());
    if (found) removed.push(found);
  }
}

console.log(`Removed ${whitelist.length - filteredWhitelist.length} words`);
if (removed.length > 0) {
  console.log(`Removed terms: ${removed.join(", ")}`);
}

// Write the filtered whitelist back
const output = JSON.stringify(filteredWhitelist, null, 2);
writeFileSync(whitelistPath, output, "utf-8");

console.log(`Updated whitelist saved with ${filteredWhitelist.length} words`);
