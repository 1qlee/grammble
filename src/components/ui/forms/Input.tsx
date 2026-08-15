import { Input as HeadlessInput } from "@headlessui/react";
import clsx from "clsx";

const SIZE_STYLES = {
  sm: "p-1.5 text-sm",
  md: "p-2 text-base",
  lg: "p-4 text-lg",
} as const;

const STATUS_STYLES = {
  default: "input-default",
  error: "input-error",
} as const;

export default function Input(
  props: React.ComponentProps<typeof HeadlessInput> &
    React.InputHTMLAttributes<HTMLInputElement> & {
      status?: "default" | "error";
      size?: keyof typeof SIZE_STYLES;
    }
) {
  const status = props.status ?? "default";
  const size = props.size ?? "md";

  return (
    <HeadlessInput
      {...props}
      className={clsx(
        SIZE_STYLES[size],
        STATUS_STYLES[status],
        props.className
      )}
    />
  );
}
