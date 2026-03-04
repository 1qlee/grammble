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

// Define search params schema
const verifyTokenSchema = v.object({
  token: v.optional(v.string()),
});

// Server function to verify email
const verifyEmailFn = createServerFn({ method: "POST" })
  .inputValidator(verifyTokenSchema)
  .handler(async ({ data }) => {
    const { prismaClient } = await import("~/utils/prisma");
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

    // Update the verification token after successful verification
    await prismaClient.verification.update({
      where: {
        id: verification.id,
      },
      data: {
        used: true,
        updatedAt: new Date(),
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

  return (
    <div className="max-w-[400px] mt-8 mx-auto px-4">
      <div className="card-wrapper">
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
                If you need to verify your email again, you can request a new
                verification email by entering your email address below.
              </p>
              <div className="flex gap-2 w-full items-end">
                <Field>
                  <Label>Email</Label>
                  <Input type="email" placeholder="Enter your email" />
                </Field>
                <Button type="submit">Send</Button>
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
    </div>
  );
}
