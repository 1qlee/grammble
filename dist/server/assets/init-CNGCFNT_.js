import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
async function createTRPCContext(opts) {
  return createTRPCContextFromHeaders(opts.req.headers);
}
async function createTRPCContextFromHeaders(headers) {
  const { auth } = await import("./auth-CoiYOFBV.js").then((n) => n.j);
  try {
    const session = await auth.api.getSession({ headers });
    if (!session?.user) return { user: null };
    const { prismaClient } = await import("./prisma-CDBmz4-v.js");
    const dbUser = await prismaClient.user.findUnique({
      where: { id: session.user.id },
      select: { isPremium: true, premiumExpiresAt: true }
    });
    let isPremium = dbUser?.isPremium ?? false;
    if (isPremium && dbUser?.premiumExpiresAt && dbUser.premiumExpiresAt < /* @__PURE__ */ new Date()) {
      isPremium = false;
      prismaClient.user.update({
        where: { id: session.user.id },
        data: { isPremium: false }
      }).catch(
        (err) => console.error("Failed to expire premium:", err)
      );
    }
    return {
      user: { ...session.user, isPremium }
    };
  } catch {
    return { user: null };
  }
}
const t = initTRPC.context().create({
  transformer: superjson
});
const createTRPCRouter = t.router;
const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export {
  createTRPCContext,
  createTRPCContextFromHeaders,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure
};
