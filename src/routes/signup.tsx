import { redirect, createFileRoute } from "@tanstack/react-router";
import SignupForm from "~/components/forms/SignupForm";

export const Route = createFileRoute("/signup")({
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
  return (
    <div>
      <SignupForm />
    </div>
  );
}
