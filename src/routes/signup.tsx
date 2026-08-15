import { redirect, createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import SignupForm from "~/components/forms/SignupForm";
import { useEffect } from "react";

const signupSearchSchema = v.object({
  invite: v.optional(v.string()),
  checkout: v.optional(v.picklist(['monthly', 'annual'])),
});

export const Route = createFileRoute("/signup")({
  validateSearch: (search) => v.parse(signupSearchSchema, search),
  beforeLoad: async ({ context }) => {
    if (context?.user) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  component: SignupComp,
});

function SignupComp() {
  const { invite, checkout } = Route.useSearch();

  // Store invite token in a short-lived cookie so the auth handler can read it
  useEffect(() => {
    if (invite) {
      document.cookie = `_invite-token=${invite};path=/;max-age=3600`;
    }
  }, [invite]);

  // Store checkout intent in a short-lived cookie so SignupForm can read it
  // after signup completes and the session is established
  useEffect(() => {
    if (checkout) {
      document.cookie = `_checkout-intent=${checkout};path=/;max-age=3600`;
    }
  }, [checkout]);

  return (
    <div>
      <SignupForm checkoutIntent={checkout} />
    </div>
  );
}
