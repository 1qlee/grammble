import { useRouter } from "@tanstack/react-router";
import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useState,
} from "react";
import { setThemeServerFn, type T as Theme } from "~/utils/theme";

type ThemeContextVal = { theme: Theme; setTheme: (val: Theme) => void };
type Props = PropsWithChildren<{ theme: Theme }>;

const ThemeContext = createContext<ThemeContextVal | null>(null);

export function ThemeProvider({ children, theme }: Props) {
  const router = useRouter();
  const [currentTheme, setCurrentTheme] = useState<Theme>(theme);

  // On first load the server has no cookie yet, so it renders the default
  // ("light"). The inline head script may have detected a dark OS preference
  // and set data-theme="dark" before hydration. Reconcile our state with the
  // attribute the script actually applied so the toggle reflects reality.
  useEffect(() => {
    const applied = document.documentElement.getAttribute("data-theme");
    if ((applied === "light" || applied === "dark") && applied !== theme) {
      setCurrentTheme(applied);
    }
  }, [theme]);

  function setTheme(val: Theme) {
    if (typeof document === "undefined") return;

    setCurrentTheme(val);

    const apply = () => document.documentElement.setAttribute("data-theme", val);

    if ("startViewTransition" in document) {
      document.startViewTransition(apply);
    } else {
      apply();
    }

    setThemeServerFn({ data: val }).then(() => router.invalidate());
  }

  return (
    <ThemeContext value={{ theme: currentTheme, setTheme }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  const val = use(ThemeContext);
  if (!val) throw new Error("useTheme called outside of ThemeProvider!");
  return val;
}
