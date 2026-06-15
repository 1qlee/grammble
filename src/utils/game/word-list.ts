import type { GameMode } from "./constants";

const cache: Partial<Record<GameMode, Set<string>>> = {};

async function loadList(mode: GameMode): Promise<string[]> {
  switch (mode) {
    case "SIX": {
      const data = await import("../../assets/six-guess-list.json");
      return data.default as string[];
    }
    case "SEVEN": {
      const data = await import("../../assets/seven-guess-list.json");
      return data.default as string[];
    }
    case "EIGHT": {
      const data = await import("../../assets/eight-guess-list.json");
      return data.default as string[];
    }
  }
}

export async function getGuessSet(mode: GameMode): Promise<Set<string>> {
  const existing = cache[mode];
  if (existing) return existing;
  const list = await loadList(mode);
  const set = new Set(list);
  cache[mode] = set;
  return set;
}
