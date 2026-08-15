import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "~/utils/auth/auth-client";
import { queryClient } from "~/utils/query-client";

export const Route = createFileRoute("/logout")({
  preload: false,
  loader: async () => {
    await signOut();
    const { clearAnonymousStorage } = await import(
      "~/utils/storage/clear-anonymous-storage"
    );
    clearAnonymousStorage();
    // Query keys like ["gameRecap", mode, date] and ["userStats", mode] are not
    // user-scoped, so a same-session account switch would otherwise resolve to
    // the previous user's cached data. Drop the whole cache on sign-out.
    queryClient.clear();
  },
});
