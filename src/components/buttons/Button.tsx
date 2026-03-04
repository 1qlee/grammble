import { Button as HeadlessButton } from "@headlessui/react";
import clsx from "clsx";

type ButtonProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}

export default function Button({ size = "md", className, children, ...props }: ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizeClasses = {
    sm: "h-[38px] w-[38px] text-sm",
    md: "h-[52px]",
    lg: "py-3 px-6 h-[60px] text-lg",
  };

  return (
    <HeadlessButton
      {...props}
      className={clsx(
        "flex outline-none grow items-center justify-center rounded-full transition-all duration-100 cursor-pointer select-none min-w-fit gap-2 border bg-linear-to-b bg-size-[100%_200%] aria-disabled:opacity-50 aria-disabled:cursor-not-allowed",
        "from-white to-zinc-200 border-zinc-900",
        "dark:from-zinc-800 dark:to-zinc-900 dark:border-zinc-700",
        "shadow-[inset_0_4px_16px_#fff] dark:shadow-[inset_0_4px_8px_var(--color-zinc-800)]",
        "focus:bg-position-[0_100%] focus:border-zinc-400 hover:border-zinc-400 focus:dark:border-zinc-400 hover:dark:border-zinc-400",
        sizeClasses[size],
        className
      )}
    >
      {children}
    </HeadlessButton>
  );
}
