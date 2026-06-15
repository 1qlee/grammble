import * as v from "valibot";
import { createServerFn } from "@tanstack/react-start";

const THEME_COOKIE = "_preferred-theme";

const modeSchema = v.picklist(["SIX", "SEVEN", "EIGHT"] as const);

export const getInitialAppDataServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const [
      { getCookie, getRequestHeaders, setCookie },
      { createCaller },
      { createTRPCContextFromHeaders },
      { auth },
    ] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("~/trpc/router"),
      import("~/trpc/init"),
      import("~/utils/auth/auth"),
    ]);

    const headers = new Headers(getRequestHeaders() as HeadersInit);

    type TRPCUser = Awaited<
      ReturnType<typeof createTRPCContextFromHeaders>
    >["user"];
    type RootUser = NonNullable<TRPCUser> & { premiumGranted: boolean };

    let trpcUser: TRPCUser = null;
    let rootUser: RootUser | null = null;
    let theme: "light" | "dark" =
      (getCookie(THEME_COOKIE) as "light" | "dark" | undefined) || "light";

    try {
      const session = await auth.api.getSession({ headers });
      if (session?.user) {
        const { prismaClient } = await import("~/utils/db/prisma");
        const dbUser = await prismaClient.user.findUnique({
          where: { id: session.user.id },
          select: {
            isPremium: true,
            premiumGranted: true,
            premiumExpiresAt: true,
          },
        });

        let isPremium = dbUser?.isPremium ?? false;
        if (
          isPremium &&
          dbUser?.premiumExpiresAt &&
          dbUser.premiumExpiresAt < new Date()
        ) {
          isPremium = false;
          prismaClient.user
            .update({
              where: { id: session.user.id },
              data: { isPremium: false },
            })
            .catch((err: unknown) =>
              console.error("Failed to expire premium:", err),
            );
        }

        trpcUser = { ...session.user, isPremium };
        rootUser = {
          ...trpcUser,
          premiumGranted: dbUser?.premiumGranted ?? false,
        };

        const settings = await prismaClient.settings.findUnique({
          where: { userId: session.user.id },
          select: { theme: true },
        });
        if (settings?.theme) {
          theme = settings.theme === "dark" ? "dark" : "light";
          setCookie(THEME_COOKIE, theme);
        }
      }
    } catch (err) {
      console.error("[getInitialAppData] auth/user lookup failed:", err);
    }

    const caller = createCaller({ user: trpcUser });
    // Fetch every mode the user is entitled to, once. Non-premium users only
    // get the 6-letter mode; premium users get all three. Shared via route
    // context so switching modes is instant (no per-route fetch).
    const dailies = await caller.game.getAllDaily();

    return { user: rootUser, theme, dailies };
  },
);

export const getUserStatsServerFn = createServerFn({ method: "GET" })
  .inputValidator(v.object({ mode: modeSchema }))
  .handler(async ({ data }) => {
    const [
      { getRequestHeaders },
      { createCaller },
      { createTRPCContextFromHeaders },
    ] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("~/trpc/router"),
      import("~/trpc/init"),
    ]);
    const headers = new Headers(getRequestHeaders() as HeadersInit);
    const ctx = await createTRPCContextFromHeaders(headers);
    return createCaller(ctx).game.getUserStats({ mode: data.mode });
  });

export const submitGuessServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    v.object({
      mode: modeSchema,
      guess: v.string(),
      history: v.optional(v.array(v.string())),
    }),
  )
  .handler(async ({ data }) => {
    const [
      { getRequestHeaders },
      { createCaller },
      { createTRPCContextFromHeaders },
    ] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("~/trpc/router"),
      import("~/trpc/init"),
    ]);
    const headers = new Headers(getRequestHeaders() as HeadersInit);
    const ctx = await createTRPCContextFromHeaders(headers);
    return createCaller(ctx).game.submitGuess(data);
  });

export const syncAnonymousSessionServerFn = createServerFn({ method: "POST" })
  .inputValidator(v.object({ mode: modeSchema, guesses: v.array(v.string()) }))
  .handler(async ({ data }) => {
    const [
      { getRequestHeaders },
      { createCaller },
      { createTRPCContextFromHeaders },
    ] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("~/trpc/router"),
      import("~/trpc/init"),
    ]);
    const headers = new Headers(getRequestHeaders() as HeadersInit);
    const ctx = await createTRPCContextFromHeaders(headers);
    return createCaller(ctx).game.syncAnonymousSession(data);
  });
