import { Button as HeadlessButton } from "@headlessui/react";
import clsx from "clsx";

const BTN_SIZE_STYLES = {
  sm: "h-[calc(var(--font-base)*1.25)] text-xs px-2",
  md: "h-[calc(var(--font-base)*3)] text-base px-4",
  lg: "h-[calc(var(--font-base)*3.75)] text-base",
} as const;

const BTN_VARIANT_STYLES = {
  default: "",
  gold: "btn-gold",
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
