import { jsx, jsxs } from "react/jsx-runtime";
import { B as Button, L as Label, I as Input } from "./Label-wLCwUdwb.js";
import { b as signIn } from "./router-CDQTwt2f.js";
import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { Description } from "@headlessui/react";
import { F as Field } from "./Field-pfU_G4QI.js";
function AuthForm({ children, onSubmit }) {
  return /* @__PURE__ */ jsx("div", { className: "card-wrapper bg-default-shadow", children: /* @__PURE__ */ jsx("form", { onSubmit, children }) });
}
function AuthButton({
  children,
  ...props
}) {
  return /* @__PURE__ */ jsx(Button, { ...props, className: "w-full", children });
}
function GoogleSigninButton() {
  return /* @__PURE__ */ jsx(AuthButton, { "aria-label": "Sign in with Google", onClick: () => signIn.social({ provider: "google" }), children: /* @__PURE__ */ jsxs(
    "svg",
    {
      version: "1.1",
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 48 48",
      xmlnsXlink: "http://www.w3.org/1999/xlink",
      className: "block w-[24px] h-[24px]",
      children: [
        /* @__PURE__ */ jsx(
          "path",
          {
            fill: "#EA4335",
            d: "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          }
        ),
        /* @__PURE__ */ jsx(
          "path",
          {
            fill: "#4285F4",
            d: "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          }
        ),
        /* @__PURE__ */ jsx(
          "path",
          {
            fill: "#FBBC05",
            d: "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          }
        ),
        /* @__PURE__ */ jsx(
          "path",
          {
            fill: "#34A853",
            d: "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          }
        ),
        /* @__PURE__ */ jsx("path", { fill: "none", d: "M0 0h48v48H0z" })
      ]
    }
  ) });
}
function TwitterSigninButton() {
  return /* @__PURE__ */ jsx(AuthButton, { "aria-label": "Sign in with X", onClick: () => signIn.social({ provider: "twitter" }), children: /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
      className: "block w-[24px] h-[24px]",
      children: /* @__PURE__ */ jsx(
        "path",
        {
          fill: "currentColor",
          d: "M21.742 21.75l-7.563-11.179 7.056-8.321h-2.456l-5.691 6.714-4.54-6.714H2.359l7.29 10.776L2.25 21.75h2.456l6.035-7.118 4.818 7.118h6.191-.008zM7.739 3.818L18.81 20.182h-2.447L5.29 3.818h2.447z"
        }
      )
    }
  ) });
}
function DiscordSigninButton() {
  return /* @__PURE__ */ jsx(AuthButton, { "aria-label": "Sign in with Discord", onClick: () => signIn.social({ provider: "discord" }), children: /* @__PURE__ */ jsxs(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      xmlnsXlink: "http://www.w3.org/1999/xlink",
      width: "71",
      height: "55",
      viewBox: "0 0 71 55",
      fill: "none",
      className: "block w-[24px] h-[24px]",
      children: [
        /* @__PURE__ */ jsx("g", { clipPath: "url(#clip0)", children: /* @__PURE__ */ jsx(
          "path",
          {
            d: "M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z",
            fill: "#5865F2"
          }
        ) }),
        /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsx("clipPath", { id: "clip0", children: /* @__PURE__ */ jsx("rect", { width: "71", height: "55", fill: "white" }) }) })
      ]
    }
  ) });
}
function SocialSignin() {
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { className: "relative my-4", children: [
      /* @__PURE__ */ jsx("span", { className: "border-t-1 border-zinc-200 dark:border-zinc-600 w-[30%] absolute top-1/2 left-0 -translate-y-1/2 z-0" }),
      /* @__PURE__ */ jsx("div", { className: "text-xs text-zinc-500 dark:text-zinc-400 relative z-10 py-2 px-4 rounded-full text-center w-fit mx-auto", children: "Or continue with" }),
      /* @__PURE__ */ jsx("span", { className: "border-t-1 border-zinc-200 dark:border-zinc-600 w-[30%] absolute top-1/2 right-0 -translate-y-1/2 z-0" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsx(GoogleSigninButton, {}),
      /* @__PURE__ */ jsx(TwitterSigninButton, {}),
      /* @__PURE__ */ jsx(DiscordSigninButton, {})
    ] })
  ] });
}
const { fieldContext, formContext } = createFormHookContexts();
const { useAppForm } = createFormHook({
  fieldComponents: {
    Input,
    Description,
    Label,
    Field
  },
  formComponents: {
    Button
  },
  fieldContext,
  formContext
});
async function withMinimumDelay(callback, minimumDelayMs) {
  const minimumDelay = new Promise(
    (resolve) => setTimeout(resolve, minimumDelayMs)
  );
  const callbackPromise = callback();
  const [result] = await Promise.all([callbackPromise, minimumDelay]);
  return result;
}
export {
  AuthForm as A,
  SocialSignin as S,
  useAppForm as u,
  withMinimumDelay as w
};
