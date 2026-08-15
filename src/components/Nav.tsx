import { useNavigate, useMatchRoute, useRouter, Link } from "@tanstack/react-router";
import {
  BarChart3,
  LogIn,
  LogOut,
  Play,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { User as UserType } from "~/prisma-generated/browser";
import AppDialog from "./AppDialog";
import { useAppDialogStore } from "~/hooks/useAppDialog";
import { useEndGameDialogStore } from "~/hooks/useEndGameDialog";
import { useGameStore } from "~/stores/game-store";

type NavAccentStyle = CSSProperties & { "--nav-accent": string };

// Each nav item is tinted with its own pastel accent. The icon always wears the
// accent; the label adopts it on hover/focus via the group state below.
const navItemClass =
  "group flex items-center gap-1 whitespace-nowrap px-2 py-1 text-xs font-semibold text-zinc-900 " +
  "transition-colors first:pl-2.5 last:pr-2.5 dark:text-zinc-100 " +
  "border-l border-zinc-200 first:border-l-0 dark:border-zinc-700 " +
  "hover:text-[var(--nav-accent)] focus-visible:text-[var(--nav-accent)] " +
  "focus-visible:outline-none cursor-pointer";

function NavItemContent({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <>
      <Icon className="size-3.5 shrink-0 text-[var(--nav-accent)]" strokeWidth={2.5} />
      <span>{children}</span>
    </>
  );
}

export function Nav({ user }: { user: UserType | undefined }) {
  const navigate = useNavigate();
  const router = useRouter();
  const matchRoute = useMatchRoute();
  const isSignin = !!matchRoute({ to: "/signin" });
  const showPlay = isSignin || !!matchRoute({ to: "/signup" });
  const isHome = matchRoute({ to: "/" });
  const appDialogOpen = useAppDialogStore((s) => s.isOpen);
  const appDialogTab = useAppDialogStore((s) => s.tab);
  const openAppDialog = useAppDialogStore((s) => s.open);
  const closeAppDialog = useAppDialogStore((s) => s.close);
  const openEndGameDialog = useEndGameDialogStore((s) => s.setIsOpen);
  const isModeCompleted = useGameStore((s) => s.status !== "IN_PROGRESS");

  const handleSignOut = async () => {
    const { signOut } = await import("~/utils/auth/auth-client");
    const { clearAnonymousStorage } = await import(
      "~/utils/storage/clear-anonymous-storage"
    );
    await signOut({
      fetchOptions: {
        onSuccess: async () => {
          clearAnonymousStorage();
          await router.invalidate();
          navigate({ to: "/" });
        },
      },
    });
  };

  const accent = (color: string): NavAccentStyle => ({ "--nav-accent": color });

  return (
    <nav className="w-min mx-auto">
      <div className="mb-2 flex items-center justify-center overflow-hidden rounded-lg bg-default-shadow">
        {showPlay && (
          <Link to="/" className={navItemClass} style={accent("#34d399")}>
            <NavItemContent icon={Play}>Play</NavItemContent>
          </Link>
        )}
        <button
          type="button"
          className={navItemClass}
          style={accent("#60a5fa")}
          onClick={() => openAppDialog("settings")}
        >
          <NavItemContent icon={SlidersHorizontal}>Settings</NavItemContent>
        </button>
        {!isHome && !showPlay && (
          <button
            type="button"
            className={navItemClass}
            style={accent("#a78bfa")}
            onClick={() => openEndGameDialog(true)}
          >
            <NavItemContent icon={BarChart3}>
              {isModeCompleted ? "Results" : "Stats"}
            </NavItemContent>
          </button>
        )}
        {!user?.isPremium && (
          <button
            type="button"
            className={navItemClass}
            style={accent("#fbbf24")}
            onClick={() => openAppDialog("subscription")}
          >
            <NavItemContent icon={Sparkles}>Subscribe</NavItemContent>
          </button>
        )}
        {user ? (
          <button
            type="button"
            className={navItemClass}
            style={accent("#fb7185")}
            onClick={handleSignOut}
          >
            <NavItemContent icon={LogOut}>Sign out</NavItemContent>
          </button>
        ) : isSignin ? (
          <Link to="/signup" className={navItemClass} style={accent("#fb7185")}>
            <NavItemContent icon={UserPlus}>Sign up</NavItemContent>
          </Link>
        ) : (
          <Link to="/signin" className={navItemClass} style={accent("#fb7185")}>
            <NavItemContent icon={LogIn}>Sign in</NavItemContent>
          </Link>
        )}
      </div>
      <AppDialog
        isOpen={appDialogOpen}
        initialTab={appDialogTab}
        onClose={closeAppDialog}
        user={user}
      />
    </nav>
  );
}
