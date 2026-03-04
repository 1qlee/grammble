import { Label as HeadlessLabel } from "@headlessui/react";
import clsx from "clsx";

export default function Label(
  props: React.ComponentProps<typeof HeadlessLabel>
) {
  return (
    <HeadlessLabel
      {...props}
      className={clsx("text-zinc-700 dark:text-zinc-300", props.className)}
    />
  );
}
