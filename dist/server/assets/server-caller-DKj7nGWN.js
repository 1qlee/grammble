import { a as createServerRpc, c as createServerFn } from "../server.js";
import * as v from "valibot";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "react/jsx-runtime";
import "@tanstack/react-router/ssr/server";
import "@tanstack/react-router";
const THEME_COOKIE = "_preferred-theme";
const getInitialAppDataServerFn_createServerFn_handler = createServerRpc("d4508c3d64d982d9f85070461b987b0c89f0127058a3ff7c4f6087b6875eff3a", (opts, signal) => {
  return getInitialAppDataServerFn.__executeServer(opts, signal);
});
const getInitialAppDataServerFn = createServerFn({
  method: "GET"
}).handler(getInitialAppDataServerFn_createServerFn_handler, async () => {
  const [{
    getCookie,
    getRequestHeaders,
    setCookie
  }, {
    createCaller
  }, {
    createTRPCContextFromHeaders
  }, {
    auth
  }] = await Promise.all([import("./server-Bkh0Mepp.js"), import("./router-Cvm9yxbF.js").then((n) => n.r), import("./init-CNGCFNT_.js"), import("./auth-CoiYOFBV.js").then((n) => n.j)]);
  const headers = new Headers(getRequestHeaders());
  let trpcUser = null;
  let rootUser = null;
  let theme = getCookie(THEME_COOKIE) || "light";
  try {
    const session = await auth.api.getSession({
      headers
    });
    if (session?.user) {
      const {
        prismaClient
      } = await import("./prisma-CDBmz4-v.js");
      const dbUser = await prismaClient.user.findUnique({
        where: {
          id: session.user.id
        },
        select: {
          isPremium: true,
          premiumGranted: true,
          premiumExpiresAt: true
        }
      });
      let isPremium = dbUser?.isPremium ?? false;
      if (isPremium && dbUser?.premiumExpiresAt && dbUser.premiumExpiresAt < /* @__PURE__ */ new Date()) {
        isPremium = false;
        prismaClient.user.update({
          where: {
            id: session.user.id
          },
          data: {
            isPremium: false
          }
        }).catch((err) => console.error("Failed to expire premium:", err));
      }
      trpcUser = {
        ...session.user,
        isPremium
      };
      rootUser = {
        ...trpcUser,
        premiumGranted: dbUser?.premiumGranted ?? false
      };
      const settings = await prismaClient.settings.findUnique({
        where: {
          userId: session.user.id
        },
        select: {
          theme: true
        }
      });
      if (settings?.theme) {
        theme = settings.theme === "dark" ? "dark" : "light";
        setCookie(THEME_COOKIE, theme);
      }
    }
  } catch (err) {
    console.error("[getInitialAppData] auth/user lookup failed:", err);
  }
  const caller = createCaller({
    user: trpcUser
  });
  const daily = await caller.game.getDaily();
  return {
    user: rootUser,
    theme,
    daily
  };
});
const getUserStatsServerFn_createServerFn_handler = createServerRpc("4596ef5b4feedd7a217fec1989ef269d0220462576d8c9b794f5882f5457cdad", (opts, signal) => {
  return getUserStatsServerFn.__executeServer(opts, signal);
});
const getUserStatsServerFn = createServerFn({
  method: "GET"
}).handler(getUserStatsServerFn_createServerFn_handler, async () => {
  const [{
    getRequestHeaders
  }, {
    createCaller
  }, {
    createTRPCContextFromHeaders
  }] = await Promise.all([import("./server-Bkh0Mepp.js"), import("./router-Cvm9yxbF.js").then((n) => n.r), import("./init-CNGCFNT_.js")]);
  const headers = new Headers(getRequestHeaders());
  const ctx = await createTRPCContextFromHeaders(headers);
  return createCaller(ctx).game.getUserStats();
});
const submitGuessServerFn_createServerFn_handler = createServerRpc("70d43dbaf985dbf4f6b04edf27586d5d094e09ab0fd755fe24f1d1c122c5738a", (opts, signal) => {
  return submitGuessServerFn.__executeServer(opts, signal);
});
const submitGuessServerFn = createServerFn({
  method: "POST"
}).inputValidator(v.object({
  guess: v.string()
})).handler(submitGuessServerFn_createServerFn_handler, async ({
  data
}) => {
  const [{
    getRequestHeaders
  }, {
    createCaller
  }, {
    createTRPCContextFromHeaders
  }] = await Promise.all([import("./server-Bkh0Mepp.js"), import("./router-Cvm9yxbF.js").then((n) => n.r), import("./init-CNGCFNT_.js")]);
  const headers = new Headers(getRequestHeaders());
  const ctx = await createTRPCContextFromHeaders(headers);
  return createCaller(ctx).game.submitGuess(data);
});
const syncAnonymousSessionServerFn_createServerFn_handler = createServerRpc("1c0f9ace5600a2f1189a668721c52618fa900f8c2f13e80d3f5d74f76c64f0e9", (opts, signal) => {
  return syncAnonymousSessionServerFn.__executeServer(opts, signal);
});
const syncAnonymousSessionServerFn = createServerFn({
  method: "POST"
}).inputValidator(v.object({
  guesses: v.array(v.string())
})).handler(syncAnonymousSessionServerFn_createServerFn_handler, async ({
  data
}) => {
  const [{
    getRequestHeaders
  }, {
    createCaller
  }, {
    createTRPCContextFromHeaders
  }] = await Promise.all([import("./server-Bkh0Mepp.js"), import("./router-Cvm9yxbF.js").then((n) => n.r), import("./init-CNGCFNT_.js")]);
  const headers = new Headers(getRequestHeaders());
  const ctx = await createTRPCContextFromHeaders(headers);
  return createCaller(ctx).game.syncAnonymousSession(data);
});
export {
  getInitialAppDataServerFn_createServerFn_handler,
  getUserStatsServerFn_createServerFn_handler,
  submitGuessServerFn_createServerFn_handler,
  syncAnonymousSessionServerFn_createServerFn_handler
};
