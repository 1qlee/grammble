import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import * as v from "valibot";
import { authMiddleware } from "~/utils/auth/auth-middleware";
import { prismaClient } from "~/utils/prisma";

const postThemeValidator = v.union([v.literal("light"), v.literal("dark")]);
export type T = v.InferOutput<typeof postThemeValidator>;
const storageKey = "_preferred-theme";

/**
 * Get the preferred theme from database (if user is logged in), cookie, or default to light.
 * Priority: Database (if logged in) > Cookie > "light"
 * This ensures logged-in users get their saved preference from the database.
 */
export const getThemeServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // If user is logged in, check database first
    if (context?.user?.id) {
      try {
        const settings = await prismaClient.settings.findUnique({
          where: { userId: context.user.id },
          select: { theme: true },
        });

        if (settings?.theme) {
          // Sync cookie with database value (for consistency)
          const themeFromDb = settings.theme === "dark" ? "dark" : "light";
          setCookie(storageKey, themeFromDb);
          return themeFromDb as T;
        }
      } catch (error) {
        // If database query fails, fall back to cookie
        console.error(
          `Failed to load theme from database for user ${context.user.id}:`,
          error
        );
      }
    }

    // Fall back to cookie or default to "light"
    return (getCookie(storageKey) || "light") as T;
  });

export const setThemeServerFn = createServerFn({ method: "POST" })
  .inputValidator(postThemeValidator)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    // Always save to cookie (for non-authenticated users and fallback)
    setCookie(storageKey, data);

    // If user is logged in, also save to database
    if (context?.user?.id) {
      try {
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
