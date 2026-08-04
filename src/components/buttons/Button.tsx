import { Button as HeadlessButton } from "@headlessui/react";
import clsx from "clsx";

const BTN_SIZE_STYLES = {
  none: "",
  sm: "h-[calc(var(--font-base)*1.25)] text-xs px-2",
  md: "h-[calc(var(--font-base)*3)] text-base px-4",
  lg: "h-[calc(var(--font-base)*3.75)] text-base",
  // Circular icon button sized to comfortably hold a 24px icon.
  icon: "size-10 rounded-full p-0",
} as const;

const BTN_VARIANT_STYLES = {
  default: "surface-raised",
  gold: "surface-gold relative overflow-hidden font-semibold",
  green: "surface-green",
  yellow: "surface-yellow",
  red: "surface-red",
} as const;

type ButtonProps = {
  size?: keyof typeof BTN_SIZE_STYLES;
  variant?: keyof typeof BTN_VARIANT_STYLES;
  className?: string;
  children: React.ReactNode;
}

export default function Button({ size = "md", variant = "default", className, children, ...props }: ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {

  return (
    <HeadlessButton
      {...props}
      className={clsx(
        "btn",
        BTN_SIZE_STYLES[size],
        BTN_VARIANT_STYLES[variant],
        className
      )}
    >
      {children}
    </HeadlessButton>
  );
}
