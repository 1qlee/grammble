import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prismaClient } from "../db/prisma";
import { username } from "better-auth/plugins";
import { generateUsername } from "./auth-utils";
import { redis } from "../db/redis";

export const auth = betterAuth({
  // Rate limiting configuration
  rateLimit: {
    enabled: true,
    // Default rate limit: 20 requests per minute (for general auth endpoints)
    window: 60, // 1 minute in seconds
    max: 20, // Maximum requests within the window
    // Custom rules for specific endpoints
    customRules: {
      // Login/Sign-in: 5 attempts per 15 minutes
      "/sign-in/email": {
        window: 10 * 60, // 10 minutes in seconds
        max: 5,
      },
      "/sign-in/username": {
        window: 10 * 60, // 10 minutes in seconds
        max: 5,
      },
      // Sign-up/Registration: 5 attempts per 15 minutes
      "/sign-up/email": {
        window: 10 * 60, // 10 minutes in seconds
        max: 5,
      },
      // Password reset: 5 attempts per 15 minutes
      "/forgot-password": {
        window: 10 * 60, // 10 minutes in seconds
        max: 5,
      },
      "/reset-password": {
        window: 10 * 60, // 10 minutes in seconds
        max: 5,
      },
      // Email verification: 10 requests per hour
      "/verify-email": {
        window: 60 * 60, // 1 hour in seconds
        max: 10,
      },
    },
    // Use secondary storage (Redis) for rate limit counters
    storage: "secondary-storage",
  },
  // Secondary storage configuration (Redis for rate limiting and session data)
  secondaryStorage: {
    get: async (key: string) => {
      const value = await redis.get(key);
      return value;
    },
    set: async (key: string, value: string, ttl?: number) => {
      if (ttl) {
        await redis.set(key, value, "EX", ttl);
      } else {
        await redis.set(key, value);
      }
    },
    delete: async (key: string) => {
      await redis.del(key);
    },
  },
  // Origins allowed to make auth requests (CSRF protection).
  // BETTER_AUTH_URL is trusted automatically; add LAN/dev hosts here.
  trustedOrigins: [
    ...(process.env.AUTH_TRUSTED_ORIGINS
      ? process.env.AUTH_TRUSTED_ORIGINS.split(",").map((o) => o.trim())
      : []),
  ],
  plugins: [username()],
  database: prismaAdapter(prismaClient, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Better Auth generates and stores the reset token; we only deliver it.
    // email-server is dynamically imported so its module-scope SES setup (which
    // throws when SES_FROM_EMAIL is unset) never runs in dev/test at boot.
    sendResetPassword: async ({ user, token }) => {
      const { sendPasswordResetEmail } = await import(
        "../email/email-server"
      );
      await sendPasswordResetEmail(user.email, token);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    // How often to refresh the session (in seconds)
    // Default is 1440 * 60 = 86400 seconds (1 day)
    // Refresh the session when it's within this time of expiring
    updateAge: 60 * 60 * 24, // Refresh if less than 1 day remaining
    // Cookie cache configuration to prevent premature session expiration
    cookieCache: {
      // Enable cookie caching to reduce database queries
      enabled: true,
      // Cookie cache max age in seconds - should be close to session expiration
      // Default is 300 seconds (5 minutes) which is too short and causes premature logouts
      // This prevents the cookie from expiring before the session
      maxAge: 60 * 5, // 5 minutes (short-lived)
      // Enable automatic refresh of cookie cache
      // When true, the cookie cache will be refreshed automatically when it's close to expiring
      // The updateAge will be 20% of maxAge by default, or you can specify it explicitly
      refreshCache: {
        updateAge: 60 * 2, // Refresh if less than 2 minutes remaining
      },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID! as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET! as string,
      mapProfileToUser: async () => {
        // Google users don't have a username, so we generate a random one
        const { username, displayUsername } = await generateUsername();
        return { username, displayUsername };
      },
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID! as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET! as string,
      mapProfileToUser: async (profile) => {
        // Discord users are likely to have a username, so we use it if available
        if (profile?.username) {
          const { username, displayUsername } = await generateUsername(
            profile.username
          );
          return { username, displayUsername };
        } else {
          const { username, displayUsername } = await generateUsername();
          return { username, displayUsername };
        }
      },
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID! as string,
      clientSecret: process.env.TWITTER_CLIENT_SECRET! as string,
      mapProfileToUser: async (profile) => {
        // Twitter users are likely to have a username, so we use it if available
        if (profile?.data?.username) {
          const { username, displayUsername } = await generateUsername(
            profile.data.username
          );
          return { username, displayUsername };
        } else {
          const { username, displayUsername } = await generateUsername();
          return { username, displayUsername };
        }
      },
    },
  },
});
