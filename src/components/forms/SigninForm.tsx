import AuthForm from "./AuthForm";
import SocialSignin from "../ui/forms/SocialSignin";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { SigninSchema } from "./SigninForm.types";
import { useAppForm } from "~/utils/form/form";
import { signIn } from "~/utils/auth/auth-client";
import { queryClient } from "~/utils/query-client";
import { withMinimumDelay } from "~/utils/helpers";
import { emailValidator } from "./SignupForm.types";
import * as v from "valibot";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import Alert from "~/components/ui/Alert";

type Props = {
  checkoutIntent?: 'monthly' | 'annual'
}

export default function SigninForm({ checkoutIntent }: Props) {
  const navigate = useNavigate();
  const router = useRouter();

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
            case "TOO_MANY_REQUESTS":
              setFormError("Too many attempts. Please try again later.");
              break;
            default:
              setFormError("An unexpected error occurred.");
              break;
          }
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
        // The session cookie is now set, but the router still holds the
        // pre-auth context (user undefined, anonymous dailies). Invalidate so
        // the root beforeLoad re-resolves user + game state under the new
        // session before navigating; otherwise the board shows stale anonymous
        // state until a hard refresh.
        // Also drop the TanStack Query cache: keys like ["gameRecap", mode,
        // date] and ["userStats", mode] are not user-scoped, so a direct
        // account switch would otherwise resolve to the prior user's data.
        queryClient.clear();
        await router.invalidate();
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
          {checkoutIntent
            ? "Sign in to your account to subscribe to premium. "
            : "Don't have an account? "}
          <Link
            to="/signup"
            search={checkoutIntent ? { checkout: checkoutIntent } : undefined}
          >
            Sign up instead
          </Link>
          .
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
                autoComplete="username"
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
                autoComplete="current-password"
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
        <Link to="/forgot-password">Forgot password?</Link>
      </div>
    </AuthForm>
  );
}
