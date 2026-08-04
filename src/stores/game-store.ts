import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Key } from "~/components/keyboard/Keyboard.types";
import type { ToastType } from "~/components/ui/Toast";
import type { LetterFeedback } from "~/utils/game/types";
import {
  DEFAULT_GAME_MODE,
  WORD_LENGTH_BY_MODE,
  type GameMode,
} from "~/utils/game/constants";

export type { LetterFeedback };

export type Toast = { message: string; type: ToastType; shake?: boolean };

export type GameStatus = "IN_PROGRESS" | "WON" | "LOST";

interface EditingState {
  toggled: boolean;
  key: number;
}

interface GameState {
  // Puzzle data (set from server on load)
  date: string;
  gram: string;
  mode: GameMode;
  wordLength: number;
  // True when the board is showing a replayed past puzzle from the archive
  // rather than today's daily. Gates the stale-date refresh guard at submit.
  isArchive: boolean;

  // Game session
  guesses: string[];
  feedback: LetterFeedback[][];
  currentGuessIndex: number;
  status: GameStatus;
  revealedWord: string | null;
  score: number | null;

  // UI state (not persisted)
  editing: EditingState;
  isPaused: boolean;
  loading: boolean;
  toast: Toast | null;
  skipGramAnimation: boolean;
}

interface GameActions {
  // Guess input
  appendChar: (char: Key) => void;
  backspace: () => void;
  clearGuess: () => void;
  setGuess: (value: string) => void;
  setCharAt: (index: number, char: string) => void;
  removeCharAt: (index: number) => void;
  moveCursorTo: (index: number) => void;
  submitGuess: (
    feedback: LetterFeedback[],
    status: GameStatus,
    word?: string,
    score?: number | null,
  ) => void;

  // Puzzle initialization
  setDailyPuzzle: (
    date: string,
    gram: string,
    mode: GameMode,
    isArchive?: boolean,
  ) => void;
  resetSession: () => void;
  hydrateSession: (data: {
    guesses: string[];
    feedback: LetterFeedback[][];
    status: GameStatus;
    currentGuessIndex: number;
    revealedWord?: string | null;
    score?: number | null;
  }) => void;

  // UI
  pauseGame: () => void;
  resumeGame: () => void;
  setLoading: (loading: boolean) => void;
  setToast: (toast: Toast | null) => void;
  editKey: (key: number, toggled?: boolean) => void;
  setSkipGramAnimation: (value: boolean) => void;
}

const initialState: GameState = {
  date: "",
  gram: "",
  mode: DEFAULT_GAME_MODE,
  wordLength: WORD_LENGTH_BY_MODE[DEFAULT_GAME_MODE],
  isArchive: false,
  guesses: [],
  feedback: [],
  currentGuessIndex: 0,
  status: "IN_PROGRESS",
  revealedWord: null,
  score: null,
  editing: { toggled: false, key: 0 },
  isPaused: false,
  loading: false,
  toast: null,
  skipGramAnimation: false,
};

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set) => ({
      ...initialState,

      appendChar: (char) =>
        set((state) => {
          const currentGuess =
            state.guesses[state.currentGuessIndex] ?? "";
          if (currentGuess.length >= state.wordLength) return state;
          const newGuesses = [...state.guesses];
          newGuesses[state.currentGuessIndex] = currentGuess + char;
          return { guesses: newGuesses };
        }),

      backspace: () =>
        set((state) => {
          const currentGuess =
            state.guesses[state.currentGuessIndex] ?? "";
          const newGuesses = [...state.guesses];
          newGuesses[state.currentGuessIndex] = currentGuess.slice(
            0,
            -1,
          );
          return { guesses: newGuesses };
        }),

      clearGuess: () =>
        set((state) => {
          const newGuesses = [...state.guesses];
          newGuesses[state.currentGuessIndex] = "";
          return { guesses: newGuesses };
        }),

      setGuess: (value) =>
        set((state) => {
          const newGuesses = [...state.guesses];
          newGuesses[state.currentGuessIndex] = value.slice(0, state.wordLength);
          return { guesses: newGuesses };
        }),

      setCharAt: (index, char) =>
        set((state) => {
          const currentGuess = state.guesses[state.currentGuessIndex] ?? "";
          if (index < 0 || index >= currentGuess.length) return state;
          const newGuess =
            currentGuess.slice(0, index) + char + currentGuess.slice(index + 1);
          const newGuesses = [...state.guesses];
          newGuesses[state.currentGuessIndex] = newGuess;
          return { guesses: newGuesses };
        }),

      removeCharAt: (index) =>
        set((state) => {
          const currentGuess = state.guesses[state.currentGuessIndex] ?? "";
          if (index < 0 || index >= currentGuess.length) return state;
          const newGuess =
            currentGuess.slice(0, index) + currentGuess.slice(index + 1);
          const newGuesses = [...state.guesses];
          newGuesses[state.currentGuessIndex] = newGuess;
          return { guesses: newGuesses };
        }),

      moveCursorTo: (index) =>
        set((state) => {
          const currentGuess = state.guesses[state.currentGuessIndex] ?? "";
          // Move the active cursor forward onto a clicked empty slot by padding
          // the gap with blanks, keeping the guess a contiguous string. The
          // cursor is always guess.length, so it lands on the clicked slot.
          // Ignore clicks on the current slot / filled tiles and anything past
          // the last typeable slot.
          if (index <= currentGuess.length || index >= state.wordLength) {
            return state;
          }
          const newGuesses = [...state.guesses];
          newGuesses[state.currentGuessIndex] =
            currentGuess + " ".repeat(index - currentGuess.length);
          return { guesses: newGuesses };
        }),

      submitGuess: (feedback, status, word, score) =>
        set((state) => ({
          feedback: [...state.feedback, feedback],
          status,
          currentGuessIndex: state.currentGuessIndex + 1,
          revealedWord: word ?? state.revealedWord,
          score: score ?? state.score,
        })),

      setDailyPuzzle: (date, gram, mode, isArchive = false) =>
        set((state) => {
          const wordLength = WORD_LENGTH_BY_MODE[mode];
          // If the date or mode changed, reset game state for the new puzzle.
          if (state.date !== date || state.mode !== mode) {
            return {
              ...initialState,
              date,
              gram,
              mode,
              wordLength,
              isArchive,
            };
          }
          return { date, gram, mode, wordLength, isArchive };
        }),

      resetSession: () =>
        set({
          guesses: [],
          feedback: [],
          currentGuessIndex: 0,
          status: "IN_PROGRESS",
          revealedWord: null,
          score: null,
          editing: { toggled: false, key: 0 },
        }),

      hydrateSession: (data) =>
        set({
          guesses: data.guesses,
          feedback: data.feedback,
          status: data.status,
          currentGuessIndex: data.currentGuessIndex,
          revealedWord: data.revealedWord ?? null,
          score: data.score ?? null,
        }),

      pauseGame: () => set({ isPaused: true }),
      resumeGame: () => set({ isPaused: false }),
      setLoading: (loading) => set({ loading }),
      setToast: (toast) => set({ toast }),
      setSkipGramAnimation: (value) => set({ skipGramAnimation: value }),
      editKey: (key, toggled) =>
        set((state) => ({
          editing: { toggled: toggled ?? !state.editing.toggled, key },
        })),
    }),
    {
      name: "grammble-game",
      skipHydration: true,
      partialize: (state) => ({
        date: state.date,
        gram: state.gram,
        mode: state.mode,
        wordLength: state.wordLength,
        guesses: state.guesses,
        feedback: state.feedback,
        currentGuessIndex: state.currentGuessIndex,
        status: state.status,
        revealedWord: state.revealedWord,
        score: state.score,
      }),
    },
  ),
);
