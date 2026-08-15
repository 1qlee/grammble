const createMiddleware = (options, __opts) => {
  const resolvedOptions = {
    type: "request",
    ...__opts || options
  };
  return {
    options: resolvedOptions,
    middleware: (middleware) => {
      return createMiddleware(
        {},
        Object.assign(resolvedOptions, { middleware })
      );
    },
    inputValidator: (inputValidator) => {
      return createMiddleware(
        {},
        Object.assign(resolvedOptions, { inputValidator })
      );
    },
    client: (client) => {
      return createMiddleware(
        {},
        Object.assign(resolvedOptions, { client })
      );
    },
    server: (server) => {
      return createMiddleware(
        {},
        Object.assign(resolvedOptions, { server })
      );
    }
  };
};
const authMiddleware = createMiddleware().server(async ({
  next
}) => {
  const {
    getRequestHeaders
  } = await import("./server-Bkh0Mepp.js");
  const {
    auth
  } = await import("./auth-CoiYOFBV.js").then((n) => n.j);
  const headers = getRequestHeaders();
  try {
    const session = await auth.api.getSession({
      headers
    });
    return await next({
      context: {
        user: session?.user || null
      }
    });
  } catch (error) {
    console.warn("[Auth Middleware] Failed to retrieve session:", error);
    return await next({
      context: {
        user: null
      }
    });
  }
});
export {
  authMiddleware as a
};
