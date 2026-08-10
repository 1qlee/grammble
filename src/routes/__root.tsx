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
import { getDateString } from "~/utils/game/daily-puzzle";
import {
  readDailiesCache,
  writeDailiesCache,
} from "~/utils/game/dailies-cache";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "~/utils/query-client";
import { useEndGameDialogStore } from "~/hooks/useEndGameDialog";

import type { User } from "~/prisma-generated/browser";
import { ThemeProvider } from "~/utils/providers/theme-provider";
import { SettingsProvider } from "~/utils/providers/settings-provider";
import { useAnonymousSessionSync } from "~/hooks/useAnonymousSessionSync";
import Toast from "~/components/ui/Toast";

// Only the game routes read `dailies` from context (index + the three mode
// routes, plus ModeTabs/EndGameDialog rendered within them). Other routes skip
// the puzzle fetch. Archive routes (/six/$date) run their own loaders and read
// only `user`, so they're intentionally excluded.
const GAME_PATHS = new Set(["/", "/six", "/seven", "/eight"]);

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const isGamePath = GAME_PATHS.has(location.pathname);
    const date = getDateString();
    // Reuse today's already-fetched puzzle data (all modes) when it's cached for
    // this tab, so switching modes doesn't re-run the heavy getAllDaily on every
    // navigation. The cache is client-only; the server always fetches fresh.
    const cached = isGamePath ? readDailiesCache(date) : null;

    const { user, theme, confirmAllGuesses, colorBlindMode, reduceMotion, dailies } =
      await getInitialAppDataServerFn({
        data: { needsDailies: isGamePath && !cached },
      });
    const userId = (user?.id as string | undefined) ?? null;

    let resolvedDailies = dailies;
    if (isGamePath) {
      if (cached && cached.userId === userId) {
        resolvedDailies = cached.data;
      } else {
        // No cache yet, or it belongs to a different account signed in within
        // the same tab. The former already fetched above; the latter skipped the
        // fetch, so pull fresh data for the current user before caching it.
        resolvedDailies =
          cached && cached.userId !== userId
            ? (
                await getInitialAppDataServerFn({
                  data: { needsDailies: true },
                })
              ).dailies
            : dailies;
        writeDailiesCache(date, userId, resolvedDailies);
      }
    }

    return {
      user: (user ?? undefined) as User | undefined,
      theme,
      confirmAllGuesses,
      colorBlindMode,
      reduceMotion,
      dailies: resolvedDailies,
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

  // Color-blind mode: apply pre-paint so tiles never flash the standard
  // green/yellow before the color-safe palette takes over.
  document.documentElement.setAttribute(
    'data-colorblind',
    getCookie('_color-blind-mode') === 'true' ? 'true' : 'false'
  );

  // Reduce motion: honor an explicit cookie, otherwise fall back to the OS
  // prefers-reduced-motion signal so the first-load board reveal is suppressed
  // for users who asked for it at the system level. Applied pre-paint.
  let reduceMotion = getCookie('_reduce-motion');
  if (reduceMotion !== 'true' && reduceMotion !== 'false') {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'true'
      : 'false';
    document.cookie = '_reduce-motion=' + reduceMotion + ';path=/;max-age=' + (60 * 60 * 24 * 365);
  }
  document.documentElement.setAttribute('data-reduce-motion', reduceMotion);
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
  const { theme, confirmAllGuesses, colorBlindMode, reduceMotion, user, dailies } =
    Route.useRouteContext();
  // Guard against interaction until the app has hydrated.
  const [isHydrated, setIsHydrated] = React.useState(false);

  useAnonymousSessionSync(user?.id);

  React.useEffect(() => {
    setIsHydrated(true);
    // Mark the app hydrated at the root, not just when a GameBoard first mounts.
    // The index route never mounts a GameBoard, so gating this flag there meant
    // navigating from the menu into any mode always replayed the first-load
    // overlay even though the puzzle data was already in context. Setting it
    // here lets client-side mode switches from the menu seed synchronously and
    // skip the overlay.
    useEndGameDialogStore.getState().setIsAppHydrated(true);
  }, []);

  // Warm the per-tab dailies cache from the initial SSR payload so the first
  // client-side mode switch reuses it instead of refetching. Runs once on the
  // initial load; subsequent writes are owned by beforeLoad and the submit
  // write-through, so this deliberately does not re-run when `dailies` changes.
  React.useEffect(() => {
    if (Object.keys(dailies).length > 0) {
      writeDailiesCache(getDateString(), user?.id ?? null, dailies);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <html
      data-theme={theme}
      data-colorblind={colorBlindMode ? "true" : "false"}
      data-reduce-motion={reduceMotion ? "true" : "false"}
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body>
        <div inert={!isHydrated}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
              <SettingsProvider
                confirmAllGuesses={confirmAllGuesses}
                colorBlindMode={colorBlindMode}
                reduceMotion={reduceMotion}
              >
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
              </SettingsProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
