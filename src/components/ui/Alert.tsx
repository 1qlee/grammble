import clsx from "clsx";

const ALERT_STYLES = {
  error: `
    bg-red-100 dark:bg-red-900/50
    border-red-400 dark:border-red-800
    text-red-600 dark:text-red-100
  `,
  success: `
    bg-green-500/10 dark:bg-green-900/50
    border-green-500/50 dark:border-green-800
    text-green-600 dark:text-green-100
  `,
  warning: `
    bg-yellow-500/10 dark:bg-yellow-900/50
    border-yellow-500/50 dark:border-yellow-800
    text-yellow-600 dark:text-yellow-100
  `,
  info: `
    bg-blue-500/10 dark:bg-blue-900/50
    border-blue-500/50 dark:border-blue-800
    text-blue-600 dark:text-blue-100
  `,
} as const;

type AlertProps = {
  children: React.ReactNode;
  type: "error" | "success" | "warning" | "info";
  className?: string;
};

export default function Alert({ children, type, className }: AlertProps) {
  return (
    <div
      className={clsx(
        `border rounded-lg text-sm p-2 ${ALERT_STYLES[type]}`,
        className
      )}
    >
      <div>{children}</div>
    </div>
  );
}
