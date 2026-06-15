import { jsxs, jsx } from "react/jsx-runtime";
import * as v from "valibot";
import { A as Alert } from "./Label-wLCwUdwb.js";
import { u as useAppForm, w as withMinimumDelay, A as AuthForm, S as SocialSignin } from "./helpers-BJBs_1t8.js";
import { S as SignupSchema, u as usernameValidator, e as emailValidator, p as passwordValidator } from "./email-CMSc4YY_.js";
import { useNavigate, Link } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { s as signUp, a as Route } from "./router-CDQTwt2f.js";
import { useState, useEffect } from "react";
import "clsx";
import "@headlessui/react";
import "@tanstack/react-form";
import "./Field-pfU_G4QI.js";
import "../server.js";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "@tanstack/react-router/ssr/server";
import "@aws-sdk/client-ses";
import "node:crypto";
import "./prisma-CDBmz4-v.js";
import "node:path";
import "node:url";
import "@prisma/client/runtime/client";
import "@prisma/adapter-pg";
import "animejs";
import "zustand";
import "zustand/middleware";
import "./auth-middleware-D9HYqFnh.js";
import "@tanstack/react-query";
import "./auth-CoiYOFBV.js";
import "unique-username-generator";
import "ioredis";
import "@trpc/server/adapters/fetch";
import "./router-Cvm9yxbF.js";
import "@trpc/server";
import "./init-CNGCFNT_.js";
import "superjson";
const DEFAULT_DEBOUNCE_MS = 300;
function SignupForm({ checkoutIntent }) {
  const [formError, setFormError] = useState(null);
  const navigate = useNavigate();
  const form = useAppForm({
    defaultValues: {
      username: "",
      email: "",
      password: ""
    },
    validators: {
      // Pass a schema or function to validate
      onSubmit: SignupSchema
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const { data, error } = await withMinimumDelay(async () => {
        try {
          const result = await signUp.email({
            email: value.email,
            // required
            name: value.username,
            // required
            password: value.password,
            // required
            username: value.username
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
            case "ACCOUNT_ALREADY_EXISTS":
              setFormError(
                "An account with this email or username already exists."
              );
              break;
            case "INAPPROPRIATE_USERNAME":
              form.setFieldMeta("username", (prev) => ({
                ...prev,
                errorMap: {
                  onSubmit: [{ message: "Username is inappropriate." }]
                }
              }));
              break;
            case "MULTIPLE_VALIDATION_ERRORS":
              if (error.message) {
                const errors = error.message.split(". ");
                errors.forEach((errorMsg) => {
                  const [field, message] = errorMsg.split(": ");
                  if (field && message) {
                    form.setFieldMeta(field, (prev) => ({
                      ...prev,
                      errorMap: { onSubmit: [{ message }] }
                    }));
                  }
                });
              }
              break;
            case "TOO_MANY_REQUESTS":
              setFormError("Too many attempts. Please try again later.");
              break;
            default:
              setFormError(
                error.message || "An error occurred. Please try again."
              );
              break;
          }
        } else {
          setFormError(error.message || "An error occurred. Please try again.");
        }
      } else if (data) {
        if (checkoutIntent) {
          try {
            const res = await fetch("/api/trpc/billing.createCheckout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ json: { interval: checkoutIntent } })
            });
            const json = await res.json();
            const url = json?.result?.data?.json?.url;
            if (url) {
              window.location.href = url;
              return;
            }
          } catch {
          }
        }
        navigate({ to: "/dashboard" });
      }
    }
  });
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    form.handleSubmit();
  };
  const handleFieldChange = async (options) => {
    const { value, field, validator } = options;
    if (value.length === 0) {
      return void 0;
    }
    const result = v.safeParse(validator, value);
    if (!result.success) {
      return result.issues.map((issue) => issue.message).join(" ") || `Invalid ${field}.`;
    }
    return void 0;
  };
  return /* @__PURE__ */ jsxs(AuthForm, { onSubmit: handleFormSubmit, children: [
    formError && /* @__PURE__ */ jsx(Alert, { type: "error", className: "mb-4", children: formError }),
    /* @__PURE__ */ jsxs("div", { className: "mb-8", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-4xl font-bold mb-2", children: "Sign up" }),
      /* @__PURE__ */ jsxs("p", { children: [
        "Create an account to save your stats and access other features. ",
        /* @__PURE__ */ jsx(Link, { to: "/signin", children: "Sign in instead" }),
        "."
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      form.AppField,
      {
        name: "username",
        validators: {
          onChangeAsyncDebounceMs: DEFAULT_DEBOUNCE_MS,
          onChangeAsync: async ({ value }) => {
            return handleFieldChange({
              value,
              field: "username",
              validator: usernameValidator
            });
          }
        },
        children: (field) => {
          const hasError = field.state.meta.errors.length > 0;
          return /* @__PURE__ */ jsxs(field.Field, { className: "mb-2", children: [
            /* @__PURE__ */ jsx(field.Label, { htmlFor: field.name, children: "Username" }),
            /* @__PURE__ */ jsx(
              field.Input,
              {
                id: field.name,
                name: field.name,
                value: field.state.value,
                type: "text",
                autoComplete: "username",
                onBlur: field.handleBlur,
                onChange: (e) => field.handleChange(e.target.value),
                placeholder: "Min. 3 characters",
                status: hasError ? "error" : "default"
              }
            ),
            hasError && /* @__PURE__ */ jsx("span", { className: "text-sm text-red-500", children: field.state.meta.errors.map(
              (error) => typeof error === "string" ? error : error?.message
            ).join(" ") })
          ] });
        }
      }
    ),
    /* @__PURE__ */ jsx(
      form.AppField,
      {
        name: "email",
        validators: {
          onChangeAsyncDebounceMs: DEFAULT_DEBOUNCE_MS,
          onChangeAsync: async ({ value }) => {
            return handleFieldChange({
              value,
              field: "email",
              validator: emailValidator
            });
          }
        },
        children: (field) => {
          const hasError = field.state.meta.errors.length > 0;
          return /* @__PURE__ */ jsxs(field.Field, { className: "mb-2", children: [
            /* @__PURE__ */ jsx(field.Label, { htmlFor: field.name, children: "Email" }),
            /* @__PURE__ */ jsx(
              field.Input,
              {
                id: field.name,
                name: field.name,
                value: field.state.value,
                type: "email",
                autoComplete: "email",
                onBlur: field.handleBlur,
                onChange: async (e) => field.handleChange(e.target.value),
                placeholder: "player@grammble.com",
                status: hasError ? "error" : "default"
              }
            ),
            hasError && /* @__PURE__ */ jsx("span", { className: "text-sm text-red-500", children: field.state.meta.errors.map(
              (error) => typeof error === "string" ? error : error?.message
            ).join(" ") })
          ] });
        }
      }
    ),
    /* @__PURE__ */ jsx(
      form.AppField,
      {
        name: "password",
        validators: {
          onChangeAsyncDebounceMs: DEFAULT_DEBOUNCE_MS,
          onChangeAsync: async ({ value }) => {
            return handleFieldChange({
              value,
              field: "password",
              validator: passwordValidator
            });
          }
        },
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
                autoComplete: "new-password",
                onBlur: field.handleBlur,
                onChange: (e) => field.handleChange(e.target.value),
                placeholder: "Min. 8 characters",
                status: hasError ? "error" : "default"
              }
            ),
            hasError && /* @__PURE__ */ jsx("span", { className: "text-sm text-red-500", children: field.state.meta.errors.map(
              (error) => typeof error === "string" ? error : error?.message
            ).join(" ") })
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
            children: isSubmitting ? /* @__PURE__ */ jsx(LoaderCircle, { className: "animate-spin" }) : "Sign up"
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(SocialSignin, {}),
    /* @__PURE__ */ jsx("div", { className: "mt-4 text-center", children: /* @__PURE__ */ jsx("p", { className: "text-xs", children: "By signing up, you agree to our Terms of Service and Privacy Policy." }) })
  ] });
}
function SignupComp() {
  const {
    invite,
    checkout
  } = Route.useSearch();
  useEffect(() => {
    if (invite) {
      document.cookie = `_invite-token=${invite};path=/;max-age=3600`;
    }
  }, [invite]);
  useEffect(() => {
    if (checkout) {
      document.cookie = `_checkout-intent=${checkout};path=/;max-age=3600`;
    }
  }, [checkout]);
  return /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(SignupForm, { checkoutIntent: checkout }) });
}
export {
  SignupComp as component
};
