import { useTheme } from "~/utils/providers/theme-provider";
import { Switch } from '@headlessui/react'


export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const newTheme = theme === "light" ? "dark" : "light";

  return (
    <Switch
      autoFocus
      checked={theme === "dark"}
      onChange={() => setTheme(newTheme)}
      className="group w-10 h-6 inline-flex justify-between items-center rounded-full bg-zinc-100 border-2 border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 data-checked:bg-emerald-500/75 data-disabled:cursor-not-allowed data-disabled:opacity-50"
    >
      <span className="inline-block h-4 w-4 transform rounded-full bg-zinc-900 dark:bg-zinc-100 transition-transform duration-200 ease-in-out group-data-checked:translate-x-[18px] left-[1px] relative" />
    </Switch>
  );
}
