import { S as StartServer, b as attachRouterServerSsrUtils, g as getOrigin, d as createMemoryHistory, m as mergeHeaders } from "../server.js";
import { H, f, h, i, e, j, k, l, n, o, p, q, r, s, t, u, v, w, x, y, z, A, B, C, D, E, F, G, I, J, K, L, M } from "../server.js";
import { jsx } from "react/jsx-runtime";
import { defineHandlerCallback as defineHandlerCallback$1, renderRouterToString } from "@tanstack/react-router/ssr/server";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "@tanstack/react-router";
const defaultRenderHandler = defineHandlerCallback$1(
  ({ router, responseHeaders }) => renderRouterToString({
    router,
    responseHeaders,
    children: /* @__PURE__ */ jsx(StartServer, { router })
  })
);
function createRequestHandler({
  createRouter,
  request,
  getRouterManifest
}) {
  return async (cb) => {
    const router = createRouter();
    attachRouterServerSsrUtils({
      router,
      manifest: await getRouterManifest?.()
    });
    const url = new URL(request.url, "http://localhost");
    const origin = getOrigin(request);
    const href = url.href.replace(url.origin, "");
    const history = createMemoryHistory({
      initialEntries: [href]
    });
    router.update({
      history,
      origin: router.options.origin ?? origin
    });
    await router.load();
    await router.serverSsr?.dehydrate();
    const responseHeaders = getRequestHeaders({
      router
    });
    return cb({
      request,
      router,
      responseHeaders
    });
  };
}
function getRequestHeaders(opts) {
  let headers = mergeHeaders(
    {
      "Content-Type": "text/html; charset=UTF-8"
    },
    ...opts.router.state.matches.map((match) => {
      return match.headers;
    })
  );
  const { redirect } = opts.router.state;
  if (redirect) {
    headers = mergeHeaders(headers, redirect.headers);
  }
  return headers;
}
function defineHandlerCallback(handler) {
  return handler;
}
const VIRTUAL_MODULES = {
  startManifest: "tanstack-start-manifest:v",
  injectedHeadScripts: "tanstack-start-injected-head-scripts:v",
  serverFnManifest: "#tanstack-start-server-fn-manifest"
};
export {
  H as HEADERS,
  StartServer,
  VIRTUAL_MODULES,
  attachRouterServerSsrUtils,
  f as clearResponseHeaders,
  h as clearSession,
  createRequestHandler,
  i as createStartHandler,
  defaultRenderHandler,
  e as defaultStreamHandler,
  defineHandlerCallback,
  j as deleteCookie,
  k as getCookie,
  l as getCookies,
  n as getRequest,
  o as getRequestHeader,
  p as getRequestHeaders,
  q as getRequestHost,
  r as getRequestIP,
  s as getRequestProtocol,
  t as getRequestUrl,
  u as getResponse,
  v as getResponseHeader,
  w as getResponseHeaders,
  x as getResponseStatus,
  y as getSession,
  z as getValidatedQuery,
  A as removeResponseHeader,
  B as requestHandler,
  C as sealSession,
  D as setCookie,
  E as setResponseHeader,
  F as setResponseHeaders,
  G as setResponseStatus,
  I as transformPipeableStreamWithRouter,
  J as transformReadableStreamWithRouter,
  K as unsealSession,
  L as updateSession,
  M as useSession
};
