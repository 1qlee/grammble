import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import { authMiddleware } from "~/utils/auth/auth-middleware";

const postThemeValidator = v.union([v.literal("light"), v.literal("dark")]);
export type T = v.InferOutput<typeof postThemeValidator>;
const storageKey = "_preferred-theme";

const optionalUserIdValidator = v.optional(v.nullable(v.string()));

/**
 * Get the preferred theme from database (if user is logged in), cookie, or default to light.
 * Priority: Database (if logged in) > Cookie > "light"
 * Accepts an optional userId parameter so the caller can pass user data
 * from route context, avoiding a redundant auth middleware call.
 */
export const getThemeServerFn = createServerFn()
  .inputValidator(optionalUserIdValidator)
  .handler(async ({ data: userId }) => {
    const { getCookie, setCookie } = await import(
      "@tanstack/react-start/server"
    );
    if (userId) {
      try {
        const { prismaClient } = await import("~/utils/db/prisma");
        const settings = await prismaClient.settings.findUnique({
          where: { userId },
          select: { theme: true },
        });

        if (settings?.theme) {
          const themeFromDb = settings.theme === "dark" ? "dark" : "light";
          setCookie(storageKey, themeFromDb);
          return themeFromDb as T;
        }
      } catch (error) {
        console.error(
          `Failed to load theme from database for user ${userId}:`,
          error
        );
      }
    }

    return (getCookie(storageKey) || "light") as T;
  });

export const setThemeServerFn = createServerFn({ method: "POST" })
  .inputValidator(postThemeValidator)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const { setCookie } = await import("@tanstack/react-start/server");
    // Always save to cookie (for non-authenticated users and fallback)
    setCookie(storageKey, data);

    // If user is logged in, also save to database
    if (context?.user?.id) {
      try {
        const { prismaClient } = await import("~/utils/db/prisma");
        await prismaClient.settings.upsert({
          where: { userId: context.user.id },
          create: {
            userId: context.user.id,
            theme: data === "dark" ? "dark" : "light",
          },
          update: {
            theme: data === "dark" ? "dark" : "light",
          },
        });
      } catch (error) {
        // Log error but don't fail the request - cookie is already set
        console.error(
          `Failed to update theme in database for user ${context.user.id}:`,
          error
        );
      }
    }
  });
