import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import * as v from "valibot";
import Alert from "~/components/ui/Alert";
import Badge from "~/components/ui/Badge";
import Input from "~/components/ui/forms/Input";
import Field from "~/components/ui/forms/Field";
import Label from "~/components/ui/forms/Label";
import Button from "~/components/buttons/Button";
import { resetPassword } from "~/utils/auth/auth-client";
import { passwordValidator } from "~/components/forms/SignupForm.types";

const resetSearchSchema = v.object({
  token: v.optional(v.string()),
  error: v.optional(v.string()),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search) => v.parse(resetSearchSchema, search),
  component: ResetPasswordComp,
});

function ResetPasswordComp() {
  const { token, error: linkError } = Route.useSearch();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  // The emailed link carries the token; without it (or if Better Auth flagged
  // the link invalid on the way in) there is nothing to reset against.
  if (!token || linkError) {
    return (
      <div className="card-wrapper bg-default-shadow">
        <Alert type="error" className="mb-6">
          <p>
            This reset link is invalid or has expired. Please request a new one.
          </p>
        </Alert>
        <div className="text-sm">
          <Link to="/forgot-password">Request a new link</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === "loading") return;

    const parsed = v.safeParse(passwordValidator, password);
    if (!parsed.success) {
      setError(parsed.issues[0]?.message ?? "Invalid password.");
      return;
    }

    setState("loading");
    setError(null);
    const { error: resetErr } = await resetPassword({
      newPassword: password,
      token,
    });

    if (resetErr) {
      setState("idle");
      setError(
        resetErr.code === "INVALID_TOKEN" || resetErr.status === 400
          ? "This reset link is invalid or has expired. Please request a new one."
          : "Something went wrong. Please try again."
      );
      return;
    }

    setState("done");
    // Send them to sign in shortly after confirming success.
    setTimeout(() => navigate({ to: "/signin" }), 2500);
  };

  if (state === "done") {
    return (
      <div className="card-wrapper bg-default-shadow">
        <Alert type="success" className="mb-6">
          <Badge>Password updated</Badge>
          <p className="text-lg">
            Your password has been reset. Redirecting you to sign in...
          </p>
        </Alert>
        <div className="text-sm">
          <Link to="/signin">Sign in now</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card-wrapper bg-default-shadow">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Reset password</h1>
        <p>Choose a new password for your account.</p>
      </div>
      {error && (
        <Alert type="error" className="mb-4">
          <p>{error}</p>
        </Alert>
      )}
      <form onSubmit={handleSubmit}>
        <Field className="mb-4">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Enter new password"
            value={password}
            status={error ? "error" : "default"}
            onChange={(e) => {
              setError(null);
              setPassword(e.target.value);
            }}
            disabled={state === "loading"}
          />
        </Field>
        <Button
          type="submit"
          className="w-full"
          aria-disabled={state === "loading"}
        >
          {state === "loading" ? "Resetting..." : "Reset password"}
        </Button>
      </form>
      <div className="flex justify-center my-4 text-sm">
        <Link to="/signin">Back to sign in</Link>
      </div>
    </div>
  );
}
