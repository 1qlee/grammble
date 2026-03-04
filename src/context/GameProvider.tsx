import { createContext, useReducer, useContext } from "react";
import type {
  GameContextDispatch,
  GameContextState,
  GameAction,
  GameProviderProps,
  ChangeGuessAction,
} from "./GameProvider.types";

const defaultGameContext: GameContextState = {
  editing: {
    toggled: false,
    key: 0,
  },
  guesses: [],
  currentGuessIndex: 0,
  loading: false,
  isPaused: false,
};

function changeGuess(currentGuess: string, action: ChangeGuessAction) {
  switch (action.type) {
    case "append":
      // Don't allow appending if guess is already at 6 character limit
      if (currentGuess.length >= 6) {
        return currentGuess;
      }
      return currentGuess + action.char;
    case "backspace":
      return currentGuess.slice(0, -1);
    case "clear":
      return "";
    case "submit":
      return "";
    default:
      return currentGuess;
  }
}

function gameReducer(
  state: GameContextState,
  action: GameAction,
): GameContextState {
  switch (action.type) {
    case "changeGuess":
      // For submit, just move to next row without modifying the current guess
      if (action.change.type === "submit") {
        return {
          ...state,
          currentGuessIndex: state.currentGuessIndex + 1,
        };
      }

      const currentGuess = state.guesses[state.currentGuessIndex] ?? "";
      const updatedGuess = changeGuess(currentGuess, action.change);
      const newGuesses = [...state.guesses];
      newGuesses[state.currentGuessIndex] = updatedGuess;
      return {
        ...state,
        guesses: newGuesses,
      };
    case "editKey":
      return {
        ...state,
        editing: {
          toggled: action.toggled ?? !state.editing.toggled,
          key: action.key,
        },
      };
    case "pauseGame":
      return {
        ...state,
        isPaused: true,
      }
    case "resumeGame":
      return {
        ...state,
        isPaused: false,
      }
    case "loading":
      return {
        ...state,
        loading: action.loading,
      };
    default:
      return state;
  }
}

export const GameContext = createContext<GameContextState | null>(null);
export const GameDispatchContext = createContext<GameContextDispatch | null>(
  null,
);

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, defaultGameContext);

  return (
    <GameContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>
        {children}
      </GameDispatchContext.Provider>
    </GameContext.Provider>
  );
}

export function useGame() {
  const state = useContext(GameContext);
  const dispatch = useContext(GameDispatchContext);

  if (!state || !dispatch) {
    throw new Error("useGame must be used within a GameProvider");
  }

  return { state, dispatch };
}
