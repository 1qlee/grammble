import clsx from "clsx";

interface Props {
  cols: number;
  isFirstRow: boolean;
  isLastRow: boolean;
}

export function SkeletonRow({ cols, isFirstRow, isLastRow }: Props) {
  return (
    <div
      className={clsx(
        "row relative gap-[2px] p-1",
        isFirstRow && "rounded-t-lg",
        isLastRow && "rounded-b-lg",
      )}
      aria-hidden="true"
    >
      {Array.from({ length: cols }, (_, i) => (
        <div
          key={i}
          className="tile tile-skeleton"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}
