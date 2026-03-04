import { Input as HeadlessInput } from "@headlessui/react";
import clsx from "clsx";

const STATUS_STYLES = {
  default: `
    border-zinc-900 bg-white
    hover:border-zinc-400 focus:border-zinc-400
    dark:border-zinc-700 dark:bg-zinc-800
    dark:hover:border-zinc-400
    dark:focus:border-zinc-400
  `,
  error: `
    border-red-400 bg-red-100
    dark:text-red-100
    dark:border-red-700 dark:bg-red-900/50
    dark:hover:border-b-red-600
    dark:focus:border-red-500
  `,
} as const;

export default function Input(
  props: React.ComponentProps<typeof HeadlessInput> &
    React.InputHTMLAttributes<HTMLInputElement> & {
      status?: "default" | "error";
    }
) {
  const status = props.status ?? "default";

  return (
    <HeadlessInput
      {...props}
      className={clsx(
        `outline-none transition-all duration-200 p-3 rounded-xl border ${STATUS_STYLES[status]}`,
        props.className
      )}
    />
  );
}
