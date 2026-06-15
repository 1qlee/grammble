import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";

export async function createTRPCContext(
  opts: FetchCreateContextFnOptions,
): Promise<TRPCContext> {
  return createTRPCContextFromHeaders(opts.req.headers);
}

export interface TRPCContext {
  user: {
    id: string;
    email: string;
    name: string | null;
    image?: string | null;
    isPremium: boolean;
  } | null;
}

export async function createTRPCContextFromHeaders(
  headers: Headers,
): Promise<TRPCContext> {
  const { auth } = await import("~/utils/auth/auth");

  try {
    const session = await auth.api.getSession({ headers });

    if (!session?.user) return { user: null };

    const { prismaClient } = await import("~/utils/db/prisma");
    const dbUser = await prismaClient.user.findUnique({
      where: { id: session.user.id },
      select: { isPremium: true, premiumExpiresAt: true },
    });

    let isPremium = dbUser?.isPremium ?? false;

    // Lazy expiration check for free trial users
    if (isPremium && dbUser?.premiumExpiresAt && dbUser.premiumExpiresAt < new Date()) {
      isPremium = false;
      prismaClient.user
        .update({
          where: { id: session.user.id },
          data: { isPremium: false },
        })
        .catch((err: unknown) =>
          console.error("Failed to expire premium:", err)
        );
    }

    return {
      user: { ...session.user, isPremium },
    };
  } catch {
    return { user: null };
  }
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
