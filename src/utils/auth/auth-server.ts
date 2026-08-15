import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "~/utils/auth/auth-middleware";

export const getUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context?.user) return undefined;

    const { prismaClient } = await import("~/utils/db/prisma");
    const dbUser = await prismaClient.user.findUnique({
      where: { id: context.user.id },
      select: { isPremium: true, premiumGranted: true, premiumExpiresAt: true },
    });

    let isPremium = dbUser?.isPremium ?? false;

    // Lazy expiration check for free trial users
    if (
      isPremium &&
      dbUser?.premiumExpiresAt &&
      dbUser.premiumExpiresAt < new Date()
    ) {
      isPremium = false;
      prismaClient.user
        .update({
          where: { id: context.user.id },
          data: { isPremium: false },
        })
        .catch((err: unknown) =>
          console.error("Failed to expire premium:", err)
        );
    }

    return {
      ...context.user,
      isPremium,
      premiumGranted: dbUser?.premiumGranted ?? false,
    };
  });
