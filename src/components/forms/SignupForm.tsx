import * as v from "valibot";
import Alert from "../ui/Alert";
import AuthForm from "./AuthForm";
import SocialSignin from "../ui/forms/SocialSignin";
import { useAppForm } from "~/utils/form/form";
import {
  emailValidator,
  passwordValidator,
  SignupSchema,
  usernameValidator,
} from "./SignupForm.types";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { signUp } from "~/utils/auth/auth-client";
import { useState } from "react";
import { withMinimumDelay } from "~/utils/helpers";

const DEFAULT_DEBOUNCE_MS = 300;

type Props = {
  checkoutIntent?: 'monthly' | 'annual'
}

export default function SignupForm({ checkoutIntent }: Props) {
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const router = useRouter();

  const form = useAppForm({
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
    validators: {
      // Pass a schema or function to validate
      onSubmit: SignupSchema,
    },
    onSubmit: async ({ value }) => {
      // Clear any previous form-level errors when starting a new submission
      setFormError(null);

      // Execute submission with minimum delay to ensure isSubmitting stays true for at least 1000ms
      const { data, error } = await withMinimumDelay(async () => {
        try {
          const result = await signUp.email({
            email: value.email, // required
            name: value.username, // required
            password: value.password, // required
            username: value.username,
          });

          return result;
        } catch (err) {
          return {
            data: null,
            error:
              err instanceof Error
                ? err
                : new Error("An unexpected error occurred"),
          };
        }
      }, 1000);

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
                  onSubmit: [{ message: "Username is inappropriate." }],
                },
              }));
              break;
            case "MULTIPLE_VALIDATION_ERRORS":
              if (error.message) {
                const errors = error.message.split(". ");
                errors.forEach((errorMsg) => {
                  const [field, message] = errorMsg.split(": ");
                  if (field && message) {
                    form.setFieldMeta(field as keyof typeof value, (prev) => ({
                      ...prev,
                      errorMap: { onSubmit: [{ message }] },
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
            const res = await fetch('/api/trpc/billing.createCheckout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ json: { interval: checkoutIntent } }),
            });
            const json = await res.json();
            const url = json?.result?.data?.json?.url;
            if (url) {
              window.location.href = url;
              return;
            }
          } catch {
            // fall through to default navigation
          }
        }
        // Re-resolve the router context (user + game state) under the new
        // session cookie before navigating; without this the board renders the
        // pre-auth anonymous state until a hard refresh.
        await router.invalidate();
        navigate({ to: "/dashboard" });
      }
    },
  });

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    form.handleSubmit();
  };

  const handleFieldChange = async (options: {
    value: string;
    field: "username" | "email" | "password";
    validator: v.BaseSchema<string, string, any>;
  }) => {
    const { value, field, validator } = options;

    if (value.length === 0) {
      return undefined;
    }
    const result = v.safeParse(validator, value);
    if (!result.success) {
      // Return all error messages
      return (
        result.issues.map((issue) => issue.message).join(" ") ||
        `Invalid ${field}.`
      );
    }
    // Return undefined if validation passes
    return undefined;
  };

  return (
    <AuthForm onSubmit={handleFormSubmit}>
      {formError && (
        <Alert type="error" className="mb-4">
          {formError}
        </Alert>
      )}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Sign up</h1>
        <p>
          {checkoutIntent
            ? "First create an account before subscribing to premium."
            : "Create an account to save your stats and access other features."}{" "}
          <Link
            to="/signin"
            search={checkoutIntent ? { checkout: checkoutIntent } : undefined}
          >
            Sign in instead
          </Link>
          .
        </p>
      </div>
      {/* Components are bound to `form` and `field` to ensure extreme type safety */}
      {/* Use `form.AppField` to render a component bound to a single field */}
      <form.AppField
        name="username"
        validators={{
          onChangeAsyncDebounceMs: DEFAULT_DEBOUNCE_MS,
          onChangeAsync: async ({ value }) => {
            return handleFieldChange({
              value,
              field: "username",
              validator: usernameValidator,
            });
          },
        }}
        children={(field) => {
          const hasError = field.state.meta.errors.length > 0;

          return (
            <field.Field className="mb-2">
              <field.Label htmlFor={field.name}>Username</field.Label>
              <field.Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                type="text"
                autoComplete="username"
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Min. 3 characters"
                status={hasError ? "error" : "default"}
              />
              {hasError && (
                <span className="text-sm text-red-500">
                  {field.state.meta.errors
                    .map((error) =>
                      typeof error === "string" ? error : error?.message
                    )
                    .join(" ")}
                </span>
              )}
            </field.Field>
          );
        }}
      />
      <form.AppField
        name="email"
        validators={{
          onChangeAsyncDebounceMs: DEFAULT_DEBOUNCE_MS,
          onChangeAsync: async ({ value }) => {
            return handleFieldChange({
              value,
              field: "email",
              validator: emailValidator,
            });
          },
        }}
        children={(field) => {
          const hasError = field.state.meta.errors.length > 0;

          return (
            <field.Field className="mb-2">
              <field.Label htmlFor={field.name}>Email</field.Label>
              <field.Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                type="email"
                autoComplete="email"
                onBlur={field.handleBlur}
                onChange={async (e) => field.handleChange(e.target.value)}
                placeholder="player@grammble.com"
                status={hasError ? "error" : "default"}
              />
              {hasError && (
                <span className="text-sm text-red-500">
                  {field.state.meta.errors
                    .map((error) =>
                      typeof error === "string" ? error : error?.message
                    )
                    .join(" ")}
                </span>
              )}
            </field.Field>
          );
        }}
      />
      {/* The "name" property will throw a TypeScript error if typo'd  */}
      <form.AppField
        name="password"
        validators={{
          onChangeAsyncDebounceMs: DEFAULT_DEBOUNCE_MS,
          onChangeAsync: async ({ value }) => {
            return handleFieldChange({
              value,
              field: "password",
              validator: passwordValidator,
            });
          },
        }}
        children={(field) => {
          const hasError = field.state.meta.errors.length > 0;

          return (
            <field.Field className="mb-2">
              <field.Label htmlFor={field.name}>
                Password{" "}
                <span className="font-normal text-zinc-500 dark:text-zinc-400">
                  (minimum 8 characters)
                </span>
              </field.Label>
              <field.Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                type="password"
                autoComplete="new-password"
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Min. 8 characters"
                status={hasError ? "error" : "default"}
              />
              {hasError && (
                <span className="text-sm text-red-500">
                  {field.state.meta.errors
                    .map((error) =>
                      typeof error === "string" ? error : error?.message
                    )
                    .join(" ")}
                </span>
              )}
            </field.Field>
          );
        }}
      />

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit, isSubmitting]) => (
          <form.Button
            type="submit"
            className="mt-4 w-full"
            aria-disabled={!canSubmit}
          >
            {isSubmitting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              "Sign up"
            )}
          </form.Button>
        )}
      />

      <SocialSignin />
      <div className="mt-4 text-center">
        <p className="text-xs">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </AuthForm>
  );
}
