import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import * as v from "valibot";
import Alert from "~/components/ui/Alert";
import Badge from "~/components/ui/Badge";
import Input from "~/components/ui/forms/Input";
import Field from "~/components/ui/forms/Field";
import Label from "~/components/ui/forms/Label";
import Button from "~/components/buttons/Button";
import { requestPasswordReset } from "~/utils/auth/auth-client";
import { emailValidator } from "~/components/forms/SignupForm.types";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: async ({ context }) => {
    if (context?.user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ForgotPasswordComp,
});

function ForgotPasswordComp() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === "loading") return;

    const parsed = v.safeParse(emailValidator, email.trim());
    if (!parsed.success) {
      setError("Please enter a valid email address.");
      return;
    }

    setState("loading");
    setError(null);
    // Remember the address so the reset page can offer a 1-click resend if the
    // emailed link later turns out to be expired. Kept in localStorage (not the
    // URL) to avoid leaking the email into browser history / server logs. Key
    // must match the one read in reset-password.tsx.
    try {
      localStorage.setItem("grammble:reset-email", email.trim());
    } catch {
      // Private-mode / storage-disabled: resend simply falls back to the link.
    }
    try {
      await requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });
    } catch (err) {
      // Swallow and still show the neutral confirmation: the response must never
      // reveal whether an address has an account (enumeration protection).
      console.error("Password reset request failed:", err);
    }
    setState("sent");
  };

  if (state === "sent") {
    return (
      <div className="card-wrapper bg-default-shadow">
        <Alert type="success" className="mb-6">
          <Badge>Check your email</Badge>
          <p className="text-lg">
            If an account exists for that address, we've sent a link to reset
            your password. The link expires in 1 hour.
          </p>
        </Alert>
        <div className="text-sm">
          <Link to="/signin">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card-wrapper bg-default-shadow">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Forgot password</h1>
        <p>Enter your email and we'll send you a link to reset your password.</p>
      </div>
      {error && (
        <Alert type="error" className="mb-4">
          <p>{error}</p>
        </Alert>
      )}
      <form onSubmit={handleSubmit}>
        <Field className="mb-4">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            status={error ? "error" : "default"}
            onChange={(e) => {
              setError(null);
              setEmail(e.target.value);
            }}
            disabled={state === "loading"}
          />
        </Field>
        <Button
          type="submit"
          className="w-full"
          aria-disabled={state === "loading"}
        >
          {state === "loading" ? "Sending..." : "Send reset link"}
        </Button>
      </form>
      <div className="flex justify-center my-4 text-sm">
        <Link to="/signin">Back to sign in</Link>
      </div>
    </div>
  );
}
