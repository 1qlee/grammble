import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const { getSession, useSession, signIn, signOut, signUp } =
  createAuthClient({
    plugins: [usernameClient()],
    /** The base URL of the server (optional if you're using the same domain) */
    baseURL: import.meta.env.DEV
      ? "http://localhost:3000"
      : "https://grammble.com",
    redirectTo: "/",
  });
