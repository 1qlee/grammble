import { Link, useNavigate } from "@tanstack/react-router";
import { signOut } from "~/utils/auth/auth-client";
import type { User } from "~/prisma-generated/browser";
import { ThemeToggle } from "./buttons/ThemeToggle";
import Dialog from "./ui/Dialog";

export function Nav({ user }: { user: User | undefined }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    console.log("signing out");
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          // Navigate to home to ensure route context is refreshed
          navigate({ to: "/" });
        },
      },
    });
  };

  return (
    <nav className="w-min mx-auto">
      <div className="flex items-center rounded-full py-1 px-2 bg-default justify-center gap-2 mb-2">
        <div className="flex items-center">
          {user ? (
            <button onClick={handleSignOut} className="cursor-pointer text-xs whitespace-nowrap p-1 no-underline select-none">Sign Out</button>
          ) : (
            <Link to="/signin" className="text-xs whitespace-nowrap p-1 no-underline select-none">Sign In</Link>
          )}
        </div>
        <Link to="/" className="block font-bold no-underline text-inherit text-xs p-1 select-none">
          Grammble
        </Link>
        <Dialog buttonText="Settings" title="Settings">
          <div className="w-full flex justify-between">
            <p>Dark Mode</p>
            <ThemeToggle />
          </div>
        </Dialog>
      </div>
    </nav>
  );
}
