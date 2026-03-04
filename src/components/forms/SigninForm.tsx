import AuthForm from "./AuthForm";
import SocialSignin from "../ui/forms/SocialSignin";
import { Link, useNavigate } from "@tanstack/react-router";
import { SigninSchema } from "./SigninForm.types";
import { useAppForm } from "~/utils/form/form";
import { signIn } from "~/utils/auth/auth-client";
import { withMinimumDelay } from "~/utils/helpers";
import { emailValidator } from "./SignupForm.types";
import * as v from "valibot";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import Alert from "~/components/ui/Alert";

export default function SigninForm() {
  const navigate = useNavigate();

  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: {
      usernameOrEmail: "",
      password: "",
    },
    validators: {
      onSubmit: SigninSchema,
    },
    onSubmit: async ({ value }) => {
      const { data, error } = await withMinimumDelay(async () => {
        try {
          const { success: isEmail } = v.safeParse(
            emailValidator,
            value.usernameOrEmail
          );

          const result = isEmail
            ? await signIn.email({
              email: value.usernameOrEmail,
              password: value.password,
            })
            : await signIn.username({
              username: value.usernameOrEmail,
              password: value.password,
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
            case "INVALID_EMAIL_OR_PASSWORD":
            case "INVALID_USERNAME_OR_PASSWORD":
            case "USERNAME_TOO_SHORT":
              setFormError("Invalid username or password.");
              break;
            default:
              setFormError("An unexpected error occurred.");
              break;
          }
        }
      } else if (data) {
        navigate({ to: "/dashboard" });
      }
    },
  });

  return (
    <AuthForm
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      {formError && (
        <Alert type="error" className="mb-4">
          {formError}
        </Alert>
      )}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Sign in</h1>
        <p>
          Don't have an account? <Link to="/signup">Sign up instead</Link>.
        </p>
      </div>
      {/* Components are bound to `form` and `field` to ensure extreme type safety */}
      {/* Use `form.AppField` to render a component bound to a single field */}
      <form.AppField
        name="usernameOrEmail"
        children={(field) => {
          const hasError = field.state.meta.errors.length > 0;

          return (
            <field.Field className="mb-2">
              <field.Label htmlFor={field.name}>Username / Email</field.Label>
              <field.Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                type="text"
                autoComplete="off"
                onBlur={field.handleBlur}
                onChange={(e) => {
                  setFormError(null);
                  field.handleChange(e.target.value);
                }}
                placeholder="Enter username or email"
                status={hasError ? "error" : "default"}
              />
              {hasError && (
                <span className="text-sm text-red-500">
                  {field.state.meta.errors
                    .map((error) => error?.message)
                    .join(", ")}
                </span>
              )}
            </field.Field>
          );
        }}
      />
      {/* The "name" property will throw a TypeScript error if typo'd  */}
      <form.AppField
        name="password"
        children={(field) => {
          const hasError = field.state.meta.errors.length > 0;

          return (
            <field.Field className="mb-2">
              <field.Label htmlFor={field.name}>Password</field.Label>
              <field.Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                type="password"
                autoComplete="new-password"
                onBlur={field.handleBlur}
                onChange={(e) => {
                  setFormError(null);
                  field.handleChange(e.target.value);
                }}
                placeholder="Enter password"
                status={hasError ? "error" : "default"}
              />
              {hasError && (
                <span className="text-sm text-red-500">
                  {field.state.meta.errors
                    .map((error) => error?.message)
                    .join(", ")}
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
              "Sign in"
            )}
          </form.Button>
        )}
      />

      <SocialSignin />

      <div className="flex justify-center my-4 text-sm">
        <Link to="/signup">Forgot password?</Link>
      </div>
    </AuthForm>
  );
}
