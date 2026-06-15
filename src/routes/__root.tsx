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
import { seo } from "~/utils/seo.js";
import { getInitialAppDataServerFn } from "~/utils/trpc/server-caller";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "~/utils/query-client";

import type { User } from "~/prisma-generated/browser";
import { ThemeProvider } from "~/utils/providers/theme-provider";
import { useAnonymousSessionSync } from "~/hooks/useAnonymousSessionSync";
import Toast from "~/components/ui/Toast";

export const Route = createRootRoute({
  beforeLoad: async () => {
    const { user, theme, dailies } = await getInitialAppDataServerFn();
    return {
      user: (user ?? undefined) as User | undefined,
      theme,
      dailies,
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
      {
        children: `
(function() {
  document.addEventListener('mousedown', function() {
    document.documentElement.classList.add('using-mouse');
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      document.documentElement.classList.remove('using-mouse');
    }
  });
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
  const { theme, user } = Route.useRouteContext();
  // Guard against interaction until the app has hydrated.
  const [isHydrated, setIsHydrated] = React.useState(false);

  useAnonymousSessionSync(user?.id);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <html data-theme={theme} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <div inert={!isHydrated}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
              <Toast />
              <div className="toggle-theme-color w-full min-h-screen py-4">
                <div className="max-w-[360px] mx-auto">
                  <div
                    className={`transition-opacity duration-500 ${
                      isHydrated ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <Nav user={user} />
                  </div>
                  {children}
                </div>
              </div>
            </ThemeProvider>
          </QueryClientProvider>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
