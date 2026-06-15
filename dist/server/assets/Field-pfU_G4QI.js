import { jsx } from "react/jsx-runtime";
import { Field as Field$1 } from "@headlessui/react";
import clsx from "clsx";
function Field(props) {
  return /* @__PURE__ */ jsx(
    Field$1,
    {
      ...props,
      className: clsx("flex flex-col gap-1", props.className)
    }
  );
}
export {
  Field as F
};
