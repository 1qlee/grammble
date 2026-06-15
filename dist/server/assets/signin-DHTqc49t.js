import { jsxs, jsx } from "react/jsx-runtime";
import { u as useAppForm, w as withMinimumDelay, A as AuthForm, S as SocialSignin } from "./helpers-BJBs_1t8.js";
import { useNavigate, Link } from "@tanstack/react-router";
import * as v from "valibot";
import { b as signIn } from "./router-CDQTwt2f.js";
import { e as emailValidator } from "./email-CMSc4YY_.js";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { A as Alert } from "./Label-wLCwUdwb.js";
import "@tanstack/react-form";
import "@headlessui/react";
import "./Field-pfU_G4QI.js";
import "clsx";
import "animejs";
import "zustand";
import "zustand/middleware";
import "./auth-middleware-D9HYqFnh.js";
import "../server.js";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "@tanstack/react-router/ssr/server";
import "@tanstack/react-query";
import "./auth-CoiYOFBV.js";
import "./prisma-CDBmz4-v.js";
import "node:path";
import "node:url";
import "@prisma/client/runtime/client";
import "@prisma/adapter-pg";
import "unique-username-generator";
import "ioredis";
import "@trpc/server/adapters/fetch";
import "./router-Cvm9yxbF.js";
import "@trpc/server";
import "./init-CNGCFNT_.js";
import "superjson";
import "@aws-sdk/client-ses";
import "node:crypto";
const SigninSchema = v.object({
  usernameOrEmail: v.string(),
  password: v.pipe(v.string(), v.minLength(1, "Password is required."))
});
function SigninForm() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);
  const form = useAppForm({
    defaultValues: {
      usernameOrEmail: "",
      password: ""
    },
    validators: {
      onSubmit: SigninSchema
    },
    onSubmit: async ({ value }) => {
      const { data, error } = await withMinimumDelay(async () => {
        try {
          const { success: isEmail } = v.safeParse(
            emailValidator,
            value.usernameOrEmail
          );
          const result = isEmail ? await signIn.email({
            email: value.usernameOrEmail,
            password: value.password
          }) : await signIn.username({
            username: value.usernameOrEmail,
            password: value.password
          });
          return result;
        } catch (err) {
          return {
            data: null,
            error: err instanceof Error ? err : new Error("An unexpected error occurred")
          };
        }
      }, 1e3);
      if (error) {
        if ("code" in error) {
          switch (error.code) {
            case "INVALID_EMAIL_OR_PASSWORD":
            case "INVALID_USERNAME_OR_PASSWORD":
            case "USERNAME_TOO_SHORT":
              setFormError("Invalid username or password.");
              break;
            case "TOO_MANY_REQUESTS":
              setFormError("Too many attempts. Please try again later.");
              break;
            default:
              setFormError("An unexpected error occurred.");
              break;
          }
        }
      } else if (data) {
        navigate({ to: "/dashboard" });
      }
    }
  });
  return /* @__PURE__ */ jsxs(
    AuthForm,
    {
      onSubmit: (e) => {
        e.preventDefault();
        form.handleSubmit();
      },
      children: [
        formError && /* @__PURE__ */ jsx(Alert, { type: "error", className: "mb-4", children: formError }),
        /* @__PURE__ */ jsxs("div", { className: "mb-8", children: [
          /* @__PURE__ */ jsx("h1", { className: "text-4xl font-bold mb-2", children: "Sign in" }),
          /* @__PURE__ */ jsxs("p", { children: [
            "Don't have an account? ",
            /* @__PURE__ */ jsx(Link, { to: "/signup", children: "Sign up instead" }),
            "."
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          form.AppField,
          {
            name: "usernameOrEmail",
            children: (field) => {
              const hasError = field.state.meta.errors.length > 0;
              return /* @__PURE__ */ jsxs(field.Field, { className: "mb-2", children: [
                /* @__PURE__ */ jsx(field.Label, { htmlFor: field.name, children: "Username / Email" }),
                /* @__PURE__ */ jsx(
                  field.Input,
                  {
                    id: field.name,
                    name: field.name,
                    value: field.state.value,
                    type: "text",
                    autoComplete: "username",
                    onBlur: field.handleBlur,
                    onChange: (e) => {
                      setFormError(null);
                      field.handleChange(e.target.value);
                    },
                    placeholder: "Enter username or email",
                    status: hasError ? "error" : "default"
                  }
                ),
                hasError && /* @__PURE__ */ jsx("span", { className: "text-sm text-red-500", children: field.state.meta.errors.map((error) => error?.message).join(", ") })
              ] });
            }
          }
        ),
        /* @__PURE__ */ jsx(
          form.AppField,
          {
            name: "password",
            children: (field) => {
              const hasError = field.state.meta.errors.length > 0;
              return /* @__PURE__ */ jsxs(field.Field, { className: "mb-2", children: [
                /* @__PURE__ */ jsx(field.Label, { htmlFor: field.name, children: "Password" }),
                /* @__PURE__ */ jsx(
                  field.Input,
                  {
                    id: field.name,
                    name: field.name,
                    value: field.state.value,
                    type: "password",
                    autoComplete: "current-password",
                    onBlur: field.handleBlur,
                    onChange: (e) => {
                      setFormError(null);
                      field.handleChange(e.target.value);
                    },
                    placeholder: "Enter password",
                    status: hasError ? "error" : "default"
                  }
                ),
                hasError && /* @__PURE__ */ jsx("span", { className: "text-sm text-red-500", children: field.state.meta.errors.map((error) => error?.message).join(", ") })
              ] });
            }
          }
        ),
        /* @__PURE__ */ jsx(
          form.Subscribe,
          {
            selector: (state) => [state.canSubmit, state.isSubmitting],
            children: ([canSubmit, isSubmitting]) => /* @__PURE__ */ jsx(
              form.Button,
              {
                type: "submit",
                className: "mt-4 w-full",
                "aria-disabled": !canSubmit,
                children: isSubmitting ? /* @__PURE__ */ jsx(LoaderCircle, { className: "animate-spin" }) : "Sign in"
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(SocialSignin, {}),
        /* @__PURE__ */ jsx("div", { className: "flex justify-center my-4 text-sm", children: /* @__PURE__ */ jsx(Link, { to: "/signup", children: "Forgot password?" }) })
      ]
    }
  );
}
function SigninComp() {
  return /* @__PURE__ */ jsx(SigninForm, {});
}
export {
  SigninComp as component
};
