import clsx from "clsx";

type BadgeProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Badge({ children, className }: BadgeProps) {
  return (
    <div
      className={clsx(
        "rounded-full inline-flex px-2 py-1 text-xs uppercase font-bold",
        className
      )}
    >
      {children}
    </div>
  );
}
