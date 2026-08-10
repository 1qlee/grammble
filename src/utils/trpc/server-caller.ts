import * as v from "valibot";
import { createServerFn } from "@tanstack/react-start";

const THEME_COOKIE = "_preferred-theme";
const CONFIRM_GUESSES_COOKIE = "_confirm-all-guesses";
const COLOR_BLIND_COOKIE = "_color-blind-mode";
const REDUCE_MOTION_COOKIE = "_reduce-motion";

const modeSchema = v.picklist(["SIX", "SEVEN", "EIGHT"] as const);

export const getInitialAppDataServerFn = createServerFn({ method: "GET" })
  .inputValidator(v.object({ needsDailies: v.boolean() }))
  .handler(async ({ data }) => {
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
    let confirmAllGuesses = getCookie(CONFIRM_GUESSES_COOKIE) === "true";
    let colorBlindMode = getCookie(COLOR_BLIND_COOKIE) === "true";
    let reduceMotion = getCookie(REDUCE_MOTION_COOKIE) === "true";

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
          select: {
            theme: true,
            confirmAllGuesses: true,
            colorBlindMode: true,
            reduceMotion: true,
          },
        });
        if (settings?.theme) {
          theme = settings.theme === "dark" ? "dark" : "light";
          setCookie(THEME_COOKIE, theme);
        }
        if (settings) {
          confirmAllGuesses = settings.confirmAllGuesses;
          setCookie(CONFIRM_GUESSES_COOKIE, confirmAllGuesses ? "true" : "false");
          colorBlindMode = settings.colorBlindMode;
          setCookie(COLOR_BLIND_COOKIE, colorBlindMode ? "true" : "false");
          reduceMotion = settings.reduceMotion;
          setCookie(REDUCE_MOTION_COOKIE, reduceMotion ? "true" : "false");
        }
      }
    } catch (err) {
      console.error("[getInitialAppData] auth/user lookup failed:", err);
    }

    // Only the game routes consume `dailies`, but auth/theme is needed on every
    // route. Skip the puzzle fetch elsewhere (signin, dashboard, etc.) so those
    // routes don't pay for getAllDaily's queries. Empty object keeps the context
    // shape stable so consumers' optional access (`dailies[mode]?`) still works.
    const caller = createCaller({ user: trpcUser });
    let dailies: Awaited<ReturnType<typeof caller.game.getAllDaily>> = {};
    if (data.needsDailies) {
      // Fetch every mode the user is entitled to, once. Non-premium users only
      // get the 6-letter mode; premium users get all three. Shared via route
      // context so switching modes is instant (no per-route fetch).
      dailies = await caller.game.getAllDaily();
    }

    return {
      user: rootUser,
      theme,
      confirmAllGuesses,
      colorBlindMode,
      reduceMotion,
      dailies,
    };
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

export const getArchiveServerFn = createServerFn({ method: "GET" })
  .inputValidator(
    v.object({
      mode: modeSchema,
      year: v.number(),
      month: v.number(),
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
    return createCaller(ctx).game.getArchive(data);
  });

export const getArchiveDayScoresServerFn = createServerFn({ method: "GET" })
  .inputValidator(v.object({ date: v.string() }))
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
    return createCaller(ctx).game.getArchiveDayScores(data);
  });

export const getArchivePuzzleServerFn = createServerFn({ method: "GET" })
  .inputValidator(v.object({ mode: modeSchema, date: v.string() }))
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
    return createCaller(ctx).game.getArchivePuzzle(data);
  });

export const getRecapServerFn = createServerFn({ method: "GET" })
  .inputValidator(v.object({ mode: modeSchema, date: v.string() }))
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
    return createCaller(ctx).game.getRecap(data);
  });

export const submitGuessServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    v.object({
      mode: modeSchema,
      guess: v.string(),
      history: v.optional(v.array(v.string())),
      date: v.optional(v.string()),
      archive: v.optional(v.boolean()),
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
