import { jsx } from "react/jsx-runtime";
import clsx from "clsx";
import { Input as Input$1, Button as Button$1, Label as Label$1 } from "@headlessui/react";
const ALERT_STYLES = {
  error: `
    bg-red-100 dark:bg-red-900/50
    border-red-400 dark:border-red-800
    text-red-800 dark:text-red-100
  `,
  success: `
    bg-green-500/10 dark:bg-green-900/50
    border-green-500/50 dark:border-green-800
    text-green-800 dark:text-green-100
  `,
  warning: `
    bg-yellow-500/10 dark:bg-yellow-900/50
    border-yellow-500/50 dark:border-yellow-800
    text-yellow-800 dark:text-yellow-100
  `,
  info: `
    bg-blue-500/10 dark:bg-blue-900/50
    border-blue-500/50 dark:border-blue-800
    text-blue-800 dark:text-blue-100
  `
};
function Alert({ children, type, className }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: clsx(
        `border rounded-lg text-sm p-2 ${ALERT_STYLES[type]}`,
        className
      ),
      children: /* @__PURE__ */ jsx("div", { children })
    }
  );
}
function Badge({ children, className }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: clsx(
        "rounded-full inline-flex items-center text-xs px-2 tracking-tight font-bold whitespace-nowrap h-4",
        className
      ),
      children
    }
  );
}
const SIZE_STYLES = {
  sm: "p-1.5 text-sm",
  md: "p-2 text-base",
  lg: "p-4 text-lg"
};
const STATUS_STYLES = {
  default: "input-default",
  error: "input-error"
};
function Input(props) {
  const status = props.status ?? "default";
  const size = props.size ?? "md";
  return /* @__PURE__ */ jsx(
    Input$1,
    {
      ...props,
      className: clsx(
        SIZE_STYLES[size],
        STATUS_STYLES[status],
        props.className
      )
    }
  );
}
const BTN_SIZE_STYLES = {
  sm: "h-[calc(var(--font-base)*1.25)] text-sm px-2",
  md: "h-[calc(var(--font-base)*3)] text-base px-4",
  lg: "h-[calc(var(--font-base)*3.75)] text-base"
};
const BTN_VARIANT_STYLES = {
  default: "",
  gold: "btn-gold"
};
function Button({ size = "md", variant = "default", className, children, ...props }) {
  return /* @__PURE__ */ jsx(
    Button$1,
    {
      ...props,
      className: clsx(
        "btn",
        BTN_SIZE_STYLES[size],
        BTN_VARIANT_STYLES[variant],
        className
      ),
      children
    }
  );
}
function Label(props) {
  return /* @__PURE__ */ jsx(
    Label$1,
    {
      ...props,
      className: clsx("cursor-pointer", props.className)
    }
  );
}
export {
  Alert as A,
  Button as B,
  Input as I,
  Label as L,
  Badge as a
};
