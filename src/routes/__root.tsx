/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import * as React from "react";
import appCss from "~/styles/app.css?url";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary.js";
import { Nav } from "~/components/Nav";
import { NotFound } from "~/components/NotFound.js";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { getUser } from "~/utils/auth/auth-server";
import { seo } from "~/utils/seo.js";
import { getThemeServerFn } from "~/utils/theme";
import { GameProvider } from "~/context/GameProvider";
// Import query-client to ensure React Query defaults are configured
import "~/utils/query-client";

import type { User } from "~/prisma-generated/browser";
import { ThemeProvider } from "~/utils/providers/theme-provider";

export const Route = createRootRoute({
  beforeLoad: async () => {
    // Fetch user in beforeLoad so it's available in context for child routes
    const user = await getUser();
    return {
      user: user as User | undefined,
    };
  },
  loader: async ({ context }) => {
    const theme = await getThemeServerFn();
    // User is already in context from beforeLoad
    const user = context.user;

    return {
      theme,
      user,
    };
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      ...seo({
        keywords: "grammble, word game, two letter game, daily word game",
        title: "grammble - the two letter daily word game",
        description: `Play grammble today - the two letter daily word game.`,
      }),
    ],
    scripts: [
      {
        children: `
(function() {
  const storageKey = '_preferred-theme';
  
  // Function to get cookie value
  function getCookie(name) {
    const value = '; ' + document.cookie;
    const parts = value.split('; ' + name + '=');
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }
  
  // Read cookie first, fall back to media preference if no cookie exists
  let theme = getCookie(storageKey);
  
  if (!theme) {
    // No cookie exists, detect from media preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = prefersDark ? 'dark' : 'light';
    // Set cookie for server-side reading (expires in 1 year)
    document.cookie = storageKey + '=' + theme + ';path=/;max-age=' + (60 * 60 * 24 * 365);
  }
  
  // Apply theme immediately to prevent flash
  document.documentElement.setAttribute('data-theme', theme);
})();
`,
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { theme, user } = Route.useLoaderData();

  return (
    <html data-theme={theme} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider theme={theme}>
          <div className="toggle-theme-color w-full min-h-screen pt-4">
            <div className="max-w-[800px] mx-auto">
              <GameProvider>
                <Nav user={user} />
                {children}
              </GameProvider>
            </div>
          </div>
        </ThemeProvider>
        <TanStackRouterDevtools position="bottom-right" />
        {/* renders JS bundles and scripts needed for client-side hydration and routing. */}
        <Scripts />
      </body>
    </html>
  );
}
