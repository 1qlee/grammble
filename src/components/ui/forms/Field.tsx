import { Field as HeadlessField } from "@headlessui/react";
import clsx from "clsx";

export default function Field(
  props: React.ComponentProps<typeof HeadlessField>
) {
  return (
    <HeadlessField
      {...props}
      className={clsx("flex flex-col gap-1", props.className)}
    />
  );
}
