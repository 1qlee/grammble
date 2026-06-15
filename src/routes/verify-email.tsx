import * as v from "valibot";
import Alert from "~/components/ui/Alert";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import Badge from "~/components/ui/Badge";
import Input from "~/components/ui/forms/Input";
import Button from "~/components/buttons/Button";
import Field from "~/components/ui/forms/Field";
import Label from "~/components/ui/forms/Label";
import { useState } from "react";

const resendVerificationEmailFn = createServerFn({ method: "POST" })
  .inputValidator(v.object({ email: v.pipe(v.string(), v.email()) }))
  .handler(async ({ data }) => {
    const { sendVerificationEmail } = await import("~/utils/email/email");
    return await sendVerificationEmail(data.email);
  });

// Define search params schema
const verifyTokenSchema = v.object({
  token: v.optional(v.string()),
});

// Server function to verify email
const verifyEmailFn = createServerFn({ method: "POST" })
  .inputValidator(verifyTokenSchema)
  .handler(async ({ data }) => {
    const { prismaClient } = await import("~/utils/db/prisma");
    const token = data.token;

    // Validate token is provided
    if (!token) {
      return {
        success: false,
        message:
          "We couldn't verify your email. Please try clicking the link in your email again.",
      };
    }

    // Find the verification record by token only
    const verification = await prismaClient.verification.findFirst({
      where: {
        value: token,
      },
    });

    if (!verification) {
      return {
        success: false,
        message: "Invalid or expired verification link.",
      };
    }

    // Check if token is expired
    if (new Date() > verification.expiresAt) {
      // Delete expired token
      await prismaClient.verification.delete({
        where: {
          id: verification.id,
        },
      });
      return {
        success: false,
        message: "This verification link has expired.",
      };
    }

    // Get email from verification record (identifier field stores the email)
    const email = verification.identifier;

    // Find the user by email from verification record
    const user = await prismaClient.user.findUnique({
      where: {
        email: email,
      },
    });

    if (!user) {
      return {
        success: false,
        message:
          "We couldn't find an account associated with this email. Please try signing up again.",
      };
    }

    // Check if already verified
    if (user.emailVerified) {
      // Delete the verification token since it's already been used
      await prismaClient.verification.delete({
        where: {
          id: verification.id,
        },
      });
      return {
        success: true,
        message: "Your email has already been verified.",
      };
    }

    // Verify the email
    await prismaClient.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerified: true,
      },
    });

    // Delete the verification token -- it's been consumed
    await prismaClient.verification.delete({
      where: {
        id: verification.id,
      },
    });

    return {
      success: true,
      message: "Your email has been successfully verified!",
    };
  });

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search) => v.parse(verifyTokenSchema, search),
  loaderDeps: ({ search: { token } }) => ({ token }),
  preload: false,
  staleTime: Infinity,
  gcTime: 0,
  loader: async ({ deps: { token } }) => {
    // Validate token is provided
    if (!token) {
      return {
        success: false,
        message:
          "Verification token is required. Please check your email for the complete verification link.",
      };
    }

    return await verifyEmailFn({ data: { token } });
  },
  component: VerifyEmailComp,
});

function VerifyEmailComp() {
  const result = Route.useLoaderData();
  const [resendEmail, setResendEmail] = useState("");
  const [resendState, setResendState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleResend = async () => {
    if (!resendEmail || resendState === "loading") return;
    setResendState("loading");
    setResendMessage(null);
    try {
      await resendVerificationEmailFn({ data: { email: resendEmail } });
      setResendState("success");
      setResendMessage("Verification email sent. Please check your inbox.");
    } catch {
      setResendState("error");
      setResendMessage("Failed to send verification email. Please try again.");
    }
  };

  return (
    <div className="card-wrapper bg-default-shadow">
      {result.success ? (
        <>
          <Alert type="success" className="mb-6">
            <Badge>Email Verified!</Badge>
            <p className="text-lg">{result.message}</p>
          </Alert>
          <div className="mt-6 space-y-4">
            <Link
              to="/dashboard"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </Link>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <Link to="/" className="text-blue-600 hover:underline">
                Return to home
              </Link>
            </div>
          </div>
        </>
      ) : (
        <>
          <Alert type="error" className="mb-6">
            <p>{result.message}</p>
          </Alert>
          <div className="mt-6 space-y-4">
            <p className="dark:text-gray-100">
              Request a new verification email below.
            </p>
            {resendMessage && (
              <Alert type={resendState === "success" ? "success" : "error"}>
                <p>{resendMessage}</p>
              </Alert>
            )}
            <div className="flex gap-2 w-full items-end">
              <Field>
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  disabled={resendState === "loading" || resendState === "success"}
                />
              </Field>
              <Button
                type="button"
                onClick={handleResend}
                aria-disabled={resendState === "loading" || resendState === "success"}
              >
                {resendState === "loading" ? "Sending..." : "Send"}
              </Button>
            </div>
            <Link to="/signin">Sign In</Link>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <Link to="/" className="text-blue-600 hover:underline">
                Return to home
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
