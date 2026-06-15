import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "~/utils/auth/auth-client";

export const Route = createFileRoute("/logout")({
  preload: false,
  loader: async () => {
    await signOut();
    const { clearAnonymousStorage } = await import(
      "~/utils/storage/clear-anonymous-storage"
    );
    clearAnonymousStorage();
  },
});
