import { useState, useRef, useEffect } from "react";
import { animate } from "animejs";
import { Link, useNavigate, useMatchRoute, useRouter } from "@tanstack/react-router";
import type { User } from "~/prisma-generated/browser";
import Dialog from "./ui/Dialog";
import { useGameStore } from "~/stores/game-store";
import AppDialog from "./AppDialog";
import { useAppDialogStore } from "~/hooks/useAppDialog";
import Button from "./buttons/Button";

function Shimmer() {
  const shimmerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!shimmerRef.current) return
    const anim = animate(shimmerRef.current, {
      translateX: ['-100%', '200%'],
      duration: 600,
      ease: 'inOut(2)',
      loop: true,
      loopDelay: 2400,
    })
    return () => { anim.cancel() }
  }, [])

  return (
    <span
      ref={shimmerRef}
      aria-hidden="true"
      className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-[20deg]"
    />
  )
}

function GoldPillButton({ onClick, user }: { onClick?: () => void; user: User | undefined }) {
  if (!user) {
    return (
      <Link to="/signup" className="block no-underline text-inherit">
        <Button size="sm" variant="gold">
          <Shimmer />
          Sign up
        </Button>
      </Link>
    )
  }

  return (
    <Button size="sm" variant="gold" onClick={onClick}>
      <Shimmer />
      Subscribe
    </Button>
  )
}

export function Nav({ user }: { user: User | undefined }) {
  const navigate = useNavigate();
  const router = useRouter();
  const matchRoute = useMatchRoute();
  const showPlay = matchRoute({ to: "/signin" }) || matchRoute({ to: "/signup" });
  const pauseGame = useGameStore((s) => s.pauseGame);
  const resumeGame = useGameStore((s) => s.resumeGame);

  const appDialogOpen = useAppDialogStore((s) => s.isOpen);
  const appDialogTab = useAppDialogStore((s) => s.tab);
  const openAppDialog = useAppDialogStore((s) => s.open);
  const closeAppDialog = useAppDialogStore((s) => s.close);
  const [archiveOpen, setArchiveOpen] = useState(false);

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
      <div className="flex items-center rounded-full bg-default-shadow justify-center gap-[calc(var(--font-base)*0.5)] mb-[calc(var(--font-base)*0.5)] h-[calc(var(--font-base)*2.25)] px-[calc(var(--font-base)*0.5)] text-sm">
        {showPlay && (
          <Link to="/" className="block no-underline text-inherit">
            <Button size="sm">Play</Button>
          </Link>
        )}
        <Button
          size="sm"
          onClick={() => openAppDialog("settings")}
        >
          Settings
        </Button>
        {user?.isPremium && (
          <>
            <Button size="sm" onClick={() => setArchiveOpen(true)}>Archive</Button>
            <Dialog
              title="Archive"
              isOpen={archiveOpen}
              setIsOpen={setArchiveOpen}
              onOpen={() => pauseGame()}
              onClose={() => resumeGame()}
            >
            </Dialog>
          </>
        )}

        {!user?.isPremium && (
          <GoldPillButton user={user} onClick={() => openAppDialog("subscription")} />
        )}
        {user ? (
          <Button size="sm" onClick={handleSignOut}>Sign Out</Button>
        ) : (
          <Link to="/signin" className="block no-underline text-inherit">
            <Button size="sm">Sign In</Button>
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
