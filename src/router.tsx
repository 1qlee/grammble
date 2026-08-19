import { createRouter } from "@tanstack/react-router";
import * as Sentry from "@sentry/tanstackstart-react";
import { routeTree } from "./routeTree.gen";
import { DefaultCatchBoundary } from "./components/DefaultCatchBoundary";
import { NotFound } from "./components/NotFound";

export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: false, // Disable preloading to prevent root route loader from running on hover
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
  });

  // Browser-only error + navigation-tracing init. Inert until VITE_SENTRY_DSN
  // is set at build time, so unconfigured builds ship with no Sentry client.
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!router.isServer && dsn) {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
      tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    });
  }

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
