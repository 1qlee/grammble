import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { MainMenu } from "~/components/MainMenu";
import { ensureDailyForMode } from "~/components/game/loadDailyModeRoute";
import {
  GAME_MODES,
  MODE_ROUTE_BY_MODE,
  type GameMode,
} from "~/utils/game/constants";
import type { DailyModeData } from "~/trpc/router";

export const Route = createFileRoute("/")({
  // Load every mode the user is entitled to (6-letter for all; 7/8 for premium)
  // so the menu's mode picker can swap the displayed gram/number per mode. The
  // first fetch caches all dailies, so the extra modes cost no extra request.
  loader: async ({ context }) => {
    const modes: GameMode[] = context.user?.isPremium ? GAME_MODES : ["SIX"];
    const entries = await Promise.all(
      modes.map(
        async (mode) => [mode, await ensureDailyForMode(mode, context)] as const,
      ),
    );
    const dailies: Partial<Record<GameMode, DailyModeData>> = {};
    for (const [mode, data] of entries) {
      if (data) dailies[mode] = data;
    }
    return dailies;
  },
  component: Home,
});

function Home() {
  const { user } = Route.useRouteContext();
  const dailies = Route.useLoaderData();
  const navigate = useNavigate();
  // SSR renders the menu immediately; flip after mount so the Play button
  // leaves its loading state only once the app has hydrated and can navigate.
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handlePlay = (mode: GameMode) => {
    navigate({ to: MODE_ROUTE_BY_MODE[mode] });
  };

  if (!dailies.SIX) return null;

  return (
    <div
      className={`transition-opacity duration-500 ${
        isHydrated ? "opacity-100" : "opacity-0"
      }`}
    >
      <MainMenu
        dailies={dailies}
        isLoading={!isHydrated}
        showModePicker={!!user && !!user.isPremium}
        onPlay={handlePlay}
      />
    </div>
  );
}
