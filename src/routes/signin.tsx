import { createFileRoute, redirect } from "@tanstack/react-router";
import * as v from "valibot";
import SigninForm from "~/components/forms/SigninForm";

const signinSearchSchema = v.object({
  checkout: v.optional(v.picklist(['monthly', 'annual'])),
});

export const Route = createFileRoute("/signin")({
  validateSearch: (search) => v.parse(signinSearchSchema, search),
  beforeLoad: async ({ context }) => {
    if (context?.user) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  component: SigninComp,
});

function SigninComp() {
  const { checkout } = Route.useSearch();
  return <SigninForm checkoutIntent={checkout} />;
}
