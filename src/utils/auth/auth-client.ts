import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const {
  getSession,
  useSession,
  signIn,
  signOut,
  signUp,
  requestPasswordReset,
  resetPassword,
} = createAuthClient({
  plugins: [usernameClient()],
  redirectTo: "/",
});
