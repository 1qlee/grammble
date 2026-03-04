import { createFileRoute, redirect } from "@tanstack/react-router";
import SigninForm from "~/components/forms/SigninForm";

export const Route = createFileRoute("/signin")({
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
  return <SigninForm />;
}
