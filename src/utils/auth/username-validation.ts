function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sanitizeWord(word: string): string {
  return removeAccents(word.trim().toLowerCase())
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

let lookupSetsPromise: Promise<{
  blacklistSet: Set<string>;
  optimizedWhitelistSet: Set<string>;
}> | null = null;

async function getLookupSets() {
  if (!lookupSetsPromise) {
    lookupSetsPromise = (async () => {
      const [blacklistMod, whitelistMod] = await Promise.all([
        import("../../assets/blacklist.json"),
        import("../../assets/optimized-whitelist.json"),
      ]);
      const blacklist = blacklistMod.default as string[];
      const optimizedWhitelist = whitelistMod.default as string[];
      return {
        blacklistSet: new Set(blacklist.map(sanitizeWord)),
        optimizedWhitelistSet: new Set(optimizedWhitelist.map(sanitizeWord)),
      };
    })();
  }
  return lookupSetsPromise;
}

/**
 * Validates a username against the blacklist.
 * Returns an error message if the username contains a blacklist term
 * that is NOT in the optimized whitelist.
 */
export async function validateUsernameAgainstBlacklist(
  username: string
): Promise<string | undefined> {
  const { blacklistSet, optimizedWhitelistSet } = await getLookupSets();
  const sanitizedUsername = sanitizeWord(username);

  for (const blacklistTerm of blacklistSet) {
    if (sanitizedUsername.includes(blacklistTerm)) {
      if (optimizedWhitelistSet.has(sanitizedUsername)) {
        continue;
      }

      let hasWhitelistSubstring = false;
      for (const whitelistWord of optimizedWhitelistSet) {
        if (
          whitelistWord.includes(blacklistTerm) &&
          sanitizedUsername.includes(whitelistWord)
        ) {
          hasWhitelistSubstring = true;
          break;
        }
      }

      if (hasWhitelistSubstring) {
        continue;
      }

      return "Username contains inappropriate content.";
    }
  }

  return undefined;
}
