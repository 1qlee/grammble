import blacklist from "../../censor/blacklist.json";
import optimizedWhitelist from "../../censor/optimized-whitelist.json";

/**
 * Removes accents/diacritics from a string
 */
function removeAccents(str: string): string {
  return str
    .normalize("NFD") // Decompose characters into base + combining marks
    .replace(/[\u0300-\u036f]/g, ""); // Remove combining diacritical marks
}

/**
 * Sanitizes a word: trims, lowercases, removes accents, removes punctuation, and removes all spaces
 */
function sanitizeWord(word: string): string {
  return removeAccents(word.trim().toLowerCase())
    .replace(/[^a-z0-9]/g, "") // Remove all punctuation and spaces (keep only alphanumeric)
    .trim();
}

// Create sets for fast lookup (sanitized)
const blacklistSet = new Set(
  (blacklist as string[]).map((word) => sanitizeWord(word))
);
const optimizedWhitelistSet = new Set(
  (optimizedWhitelist as string[]).map((word) => sanitizeWord(word))
);

/**
 * Validates a username against the blacklist.
 * Returns an error message if the username contains a blacklist term
 * that is NOT in the optimized whitelist.
 */
export function validateUsernameAgainstBlacklist(
  username: string
): string | undefined {
  const sanitizedUsername = sanitizeWord(username);

  // Check if the sanitized username contains any blacklist term
  for (const blacklistTerm of blacklistSet) {
    if (sanitizedUsername.includes(blacklistTerm)) {
      // If the username itself is in the optimized whitelist, it's allowed
      // (e.g., "spica" contains "spic" but "spica" is a legitimate word)
      if (optimizedWhitelistSet.has(sanitizedUsername)) {
        continue; // This username is allowed, check next blacklist term
      }

      // Check if any whitelist word that contains this blacklist term
      // is a substring of the username (e.g., "cassandra" contains "ass" and is whitelisted,
      // so "cassandralee" should be allowed)
      let hasWhitelistSubstring = false;
      for (const whitelistWord of optimizedWhitelistSet) {
        // Check if the whitelist word contains the blacklist term
        // and is a substring of the username
        if (
          whitelistWord.includes(blacklistTerm) &&
          sanitizedUsername.includes(whitelistWord)
        ) {
          hasWhitelistSubstring = true;
          break;
        }
      }

      if (hasWhitelistSubstring) {
        continue; // This username is allowed because it contains a whitelisted substring
      }

      // Found a blacklist term and no whitelisted substring covers it
      return "Username contains inappropriate content.";
    }
  }

  return undefined; // No violations found
}
