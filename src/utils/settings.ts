import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import { authMiddleware } from "~/utils/auth/auth-middleware";

const booleanValidator = v.boolean();

export const CONFIRM_GUESSES_COOKIE = "_confirm-all-guesses";
export const COLOR_BLIND_COOKIE = "_color-blind-mode";
export const REDUCE_MOTION_COOKIE = "_reduce-motion";

// The Settings columns that back each boolean preference. Keys are the Prisma
// field names so the upsert helper can write the right column generically.
type BooleanSettingField =
  | "confirmAllGuesses"
  | "colorBlindMode"
  | "reduceMotion";

/**
 * Persist a boolean preference. Mirrors the theme flow: always write a cookie
 * (covers unauthenticated users and serves as the SSR source), and additionally
 * upsert the Settings row when a user is logged in. Failures to reach the DB are
 * logged but never fail the request, since the cookie is already set.
 */
async function persistBooleanSetting(
  cookieName: string,
  field: BooleanSettingField,
  value: boolean,
  userId?: string,
) {
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(cookieName, value ? "true" : "false");

  if (!userId) return;

  try {
    const { prismaClient } = await import("~/utils/db/prisma");
    await prismaClient.settings.upsert({
      where: { userId },
      create: { userId, [field]: value },
      update: { [field]: value },
    });
  } catch (error) {
    console.error(
      `Failed to update ${field} in database for user ${userId}:`,
      error,
    );
  }
}

export const setConfirmAllGuessesServerFn = createServerFn({ method: "POST" })
  .inputValidator(booleanValidator)
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    persistBooleanSetting(
      CONFIRM_GUESSES_COOKIE,
      "confirmAllGuesses",
      data,
      context?.user?.id,
    ),
  );

export const setColorBlindModeServerFn = createServerFn({ method: "POST" })
  .inputValidator(booleanValidator)
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    persistBooleanSetting(
      COLOR_BLIND_COOKIE,
      "colorBlindMode",
      data,
      context?.user?.id,
    ),
  );

export const setReduceMotionServerFn = createServerFn({ method: "POST" })
  .inputValidator(booleanValidator)
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    persistBooleanSetting(
      REDUCE_MOTION_COOKIE,
      "reduceMotion",
      data,
      context?.user?.id,
    ),
  );
