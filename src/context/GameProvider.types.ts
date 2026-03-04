import { type ReactNode } from "react";
import { type Key } from "~/components/keyboard/Keyboard.types";

// Game state interfaces
export interface EditingState {
  toggled: boolean;
  key: number;
}

export interface GameContextState {
  editing: EditingState;
  loading: boolean;
  guesses: string[];
  currentGuessIndex: number;
  isPaused: boolean;
}

export interface ChangeGuessAction {
  type: "append" | "backspace" | "clear" | "submit" | "blank" | "noAction";
  char?: Key;
}

// Action types
export type GameAction =
  | {
    type: "editKey";
    toggled?: boolean;
    key: number;
  }
  | {
    type: "loading";
    loading: boolean;
  }
  | {
    type: "changeGuess";
    change: ChangeGuessAction;
  }
  | {
    type: "pauseGame";
  }
  | {
    type: "resumeGame";
  }

// Dispatch function type
export type GameContextDispatch = (action: GameAction) => void;

// Provider props
export interface GameProviderProps {
  children: ReactNode;
}
