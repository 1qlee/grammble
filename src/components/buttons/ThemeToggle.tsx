import { useTheme } from "~/utils/providers/theme-provider";
import Toggle from "~/components/ui/Toggle";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const newTheme = theme === "light" ? "dark" : "light";

  return (
    <Toggle
      checked={theme === "dark"}
      onChange={() => setTheme(newTheme)}
      aria-label={`Switch to ${newTheme} mode`}
    />
  );
}
