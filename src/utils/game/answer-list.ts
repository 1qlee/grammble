import type { GameMode } from "./constants";

// SERVER-ONLY. Loads the per-mode answer pool (the words a puzzle can hide) so
// the solver can build candidate sets. These lists enumerate every possible
// answer, so this module must never be imported from client code. Cached per
// mode after first load.

const cache: Partial<Record<GameMode, string[]>> = {};

async function loadList(mode: GameMode): Promise<string[]> {
  switch (mode) {
    case "SIX": {
      const data = await import("../../assets/final-6-word-list.json");
      return data.default as string[];
    }
    case "SEVEN": {
      const data = await import("../../assets/final-7-word-list.json");
      return data.default as string[];
    }
    case "EIGHT": {
      const data = await import("../../assets/final-8-word-list.json");
      return data.default as string[];
    }
  }
}

export async function getAnswerList(mode: GameMode): Promise<string[]> {
  const existing = cache[mode];
  if (existing) return existing;
  const list = await loadList(mode);
  cache[mode] = list;
  return list;
}
