import { useNavigate, useMatchRoute, useRouter, Link } from "@tanstack/react-router";
import { Settings, ChartColumnBig, User, LogOut, House, Crown } from "lucide-react";
import type { User as UserType } from "~/prisma-generated/browser";
import AppDialog from "./AppDialog";
import { useAppDialogStore } from "~/hooks/useAppDialog";
import { useEndGameDialogStore } from "~/hooks/useEndGameDialog";
import { useGameStore } from "~/stores/game-store";
import Button from "./buttons/Button";

const ICON_SIZE = 19.2;

export function Nav({ user }: { user: UserType | undefined }) {
  const navigate = useNavigate();
  const router = useRouter();
  const matchRoute = useMatchRoute();
  const showPlay = matchRoute({ to: "/signin" }) || matchRoute({ to: "/signup" });
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

  return (
    <nav className="w-min mx-auto">
      <div className="flex items-center justify-center gap-2 mb-2">
        {showPlay && (
          <Link to="/" className="block no-underline text-inherit" aria-label="Play">
            <Button size="icon">
              <House size={ICON_SIZE} />
            </Button>
          </Link>
        )}
        <Button size="icon" aria-label="Settings" onClick={() => openAppDialog("settings")}>
          <Settings size={ICON_SIZE} />
        </Button>
        {isModeCompleted && !isHome && (
          <Button size="icon" aria-label="Results" onClick={() => openEndGameDialog(true)}>
            <ChartColumnBig size={ICON_SIZE} />
          </Button>
        )}
        {!user?.isPremium && (
          <Button
            size="icon"
            variant="gold"
            aria-label="Subscribe"
            onClick={() => openAppDialog("subscription")}
          >
            <Crown size={ICON_SIZE} fill="currentColor" />
          </Button>
        )}
        {user ? (
          <Button size="icon" aria-label="Sign out" onClick={handleSignOut}>
            <LogOut size={ICON_SIZE} />
          </Button>
        ) : (
          <Link to="/signin" className="block no-underline text-inherit" aria-label="Sign in">
            <Button size="icon">
              <User size={ICON_SIZE} fill="currentColor" />
            </Button>
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
