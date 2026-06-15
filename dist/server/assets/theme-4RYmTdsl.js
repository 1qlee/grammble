import { a as createServerRpc, c as createServerFn } from "../server.js";
import * as v from "valibot";
import { a as authMiddleware } from "./auth-middleware-D9HYqFnh.js";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "react/jsx-runtime";
import "@tanstack/react-router/ssr/server";
import "@tanstack/react-router";
const postThemeValidator = v.union([v.literal("light"), v.literal("dark")]);
const storageKey = "_preferred-theme";
const optionalUserIdValidator = v.optional(v.nullable(v.string()));
const getThemeServerFn_createServerFn_handler = createServerRpc("5881fddf03040cfe3287810f620c995dfe8ab8da53b48634f0eaf1cb7810ee29", (opts, signal) => {
  return getThemeServerFn.__executeServer(opts, signal);
});
const getThemeServerFn = createServerFn().inputValidator(optionalUserIdValidator).handler(getThemeServerFn_createServerFn_handler, async ({
  data: userId
}) => {
  const {
    getCookie,
    setCookie
  } = await import("./server-Bkh0Mepp.js");
  if (userId) {
    try {
      const {
        prismaClient
      } = await import("./prisma-CDBmz4-v.js");
      const settings = await prismaClient.settings.findUnique({
        where: {
          userId
        },
        select: {
          theme: true
        }
      });
      if (settings?.theme) {
        const themeFromDb = settings.theme === "dark" ? "dark" : "light";
        setCookie(storageKey, themeFromDb);
        return themeFromDb;
      }
    } catch (error) {
      console.error(`Failed to load theme from database for user ${userId}:`, error);
    }
  }
  return getCookie(storageKey) || "light";
});
const setThemeServerFn_createServerFn_handler = createServerRpc("71df1c81de1627f92aad64454efb0cbee53b33c45818d2ce8fd4e7ad46e6b1c9", (opts, signal) => {
  return setThemeServerFn.__executeServer(opts, signal);
});
const setThemeServerFn = createServerFn({
  method: "POST"
}).inputValidator(postThemeValidator).middleware([authMiddleware]).handler(setThemeServerFn_createServerFn_handler, async ({
  data,
  context
}) => {
  const {
    setCookie
  } = await import("./server-Bkh0Mepp.js");
  setCookie(storageKey, data);
  if (context?.user?.id) {
    try {
      const {
        prismaClient
      } = await import("./prisma-CDBmz4-v.js");
      await prismaClient.settings.upsert({
        where: {
          userId: context.user.id
        },
        create: {
          userId: context.user.id,
          theme: data === "dark" ? "dark" : "light"
        },
        update: {
          theme: data === "dark" ? "dark" : "light"
        }
      });
    } catch (error) {
      console.error(`Failed to update theme in database for user ${context.user.id}:`, error);
    }
  }
});
export {
  getThemeServerFn_createServerFn_handler,
  setThemeServerFn_createServerFn_handler
};
