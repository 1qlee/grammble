import { useRouter } from "@tanstack/react-router";
import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useState,
} from "react";
import {
  COLOR_BLIND_COOKIE,
  CONFIRM_GUESSES_COOKIE,
  REDUCE_MOTION_COOKIE,
  setColorBlindModeServerFn,
  setConfirmAllGuessesServerFn,
  setReduceMotionServerFn,
} from "~/utils/settings";

// Global Anime.js playback rate while reduce-motion is on. High enough that
// every JS tween finishes within a frame (imperceptible) while still firing its
// onComplete, so exit/dismiss logic keeps working. CSS-driven animations and
// transitions are neutralized separately by the [data-reduce-motion] rules in
// app.css; this only covers the inline styles Anime.js writes directly.
const REDUCED_MOTION_SPEED = 100;

type SettingsContextVal = {
  confirmAllGuesses: boolean;
  setConfirmAllGuesses: (val: boolean) => void;
  colorBlindMode: boolean;
  setColorBlindMode: (val: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (val: boolean) => void;
};
type Props = PropsWithChildren<{
  confirmAllGuesses: boolean;
  colorBlindMode: boolean;
  reduceMotion: boolean;
}>;

const SettingsContext = createContext<SettingsContextVal | null>(null);

const YEAR_SECONDS = 60 * 60 * 24 * 365;

// Write the cookie client-side too so unauthenticated users persist the choice
// across reloads without waiting on a context invalidation.
function writeCookie(name: string, val: boolean) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${val ? "true" : "false"};path=/;max-age=${YEAR_SECONDS}`;
}

function setHtmlFlag(attr: string, val: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(attr, val ? "true" : "false");
}

export function SettingsProvider({
  children,
  confirmAllGuesses: initialConfirm,
  colorBlindMode: initialColorBlind,
  reduceMotion: initialReduceMotion,
}: Props) {
  const router = useRouter();
  const [confirmAllGuesses, setConfirm] = useState(initialConfirm);
  const [colorBlindMode, setColorBlind] = useState(initialColorBlind);
  const [reduceMotion, setReduce] = useState(initialReduceMotion);

  // Adopt the pre-paint reduce-motion decision on mount. The server value comes
  // from the cookie alone and cannot see an OS-level prefers-reduced-motion
  // signal when no cookie exists yet; the head script folds that signal into the
  // [data-reduce-motion] attribute (and cookie) before hydration. Without this,
  // an OS reduce-motion user on their first load keeps engine.speed=1 and JS
  // tweens run at full speed even though the CSS animations are suppressed.
  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-reduce-motion");
    if (attr !== null && (attr === "true") !== reduceMotion) {
      setReduce(attr === "true");
    }
    // Run once on mount; the engine effect below reacts to the resulting change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconcile the Anime.js engine with the current preference on mount and
  // whenever it changes. The head script sets the [data-reduce-motion]
  // attribute pre-paint (covering CSS animations); this handles JS tweens.
  useEffect(() => {
    import("animejs").then(({ engine }) => {
      engine.speed = reduceMotion ? REDUCED_MOTION_SPEED : 1;
    });
  }, [reduceMotion]);

  // Persist a preference to the server, then refresh route context so a
  // logged-in user's DB-backed value stays in sync. A failed write leaves the
  // local state and cookie already updated (so the UI is correct), but must not
  // fail silently -- log it rather than letting the rejection go unhandled.
  function persist(promise: Promise<unknown>, label: string) {
    promise
      .then(() => router.invalidate())
      .catch((error) => {
        console.error(`Failed to persist ${label} setting:`, error);
      });
  }

  function setConfirmAllGuesses(val: boolean) {
    setConfirm(val);
    writeCookie(CONFIRM_GUESSES_COOKIE, val);
    persist(setConfirmAllGuessesServerFn({ data: val }), "confirm-all-guesses");
  }

  function setColorBlindMode(val: boolean) {
    setColorBlind(val);
    setHtmlFlag("data-colorblind", val);
    writeCookie(COLOR_BLIND_COOKIE, val);
    persist(setColorBlindModeServerFn({ data: val }), "color-blind-mode");
  }

  function setReduceMotion(val: boolean) {
    setReduce(val);
    setHtmlFlag("data-reduce-motion", val);
    writeCookie(REDUCE_MOTION_COOKIE, val);
    persist(setReduceMotionServerFn({ data: val }), "reduce-motion");
  }

  return (
    <SettingsContext
      value={{
        confirmAllGuesses,
        setConfirmAllGuesses,
        colorBlindMode,
        setColorBlindMode,
        reduceMotion,
        setReduceMotion,
      }}
    >
      {children}
    </SettingsContext>
  );
}

export function useSettings() {
  const val = use(SettingsContext);
  if (!val) throw new Error("useSettings called outside of SettingsProvider!");
  return val;
}
