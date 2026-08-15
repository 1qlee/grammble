import clsx from "clsx";

type BadgeProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Badge({ children, className }: BadgeProps) {
  return (
    <div
      className={clsx(
        "rounded-full inline-flex items-center text-xs px-2 tracking-tight font-bold whitespace-nowrap h-4",
        className
      )}
    >
      {children}
    </div>
  );
}
