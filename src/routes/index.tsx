import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { MainMenu } from "~/components/MainMenu";
import { ensureDailyForMode } from "~/components/game/loadDailyModeRoute";

export const Route = createFileRoute("/")({
  loader: ({ context }) => ensureDailyForMode("SIX", context),
  component: Home,
});

function Home() {
  const { user } = Route.useRouteContext();
  const six = Route.useLoaderData();
  const navigate = useNavigate();
  // SSR renders the menu immediately; flip after mount so the Play button
  // leaves its loading state only once the app has hydrated and can navigate.
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handlePlay = () => {
    navigate({ to: "/six" });
  };

  if (!six) return null;

  return (
    <MainMenu
      puzzleNumber={six.puzzleNumber}
      date={six.date}
      isLoading={!isHydrated}
      isPremium={!!user?.isPremium}
      onPlay={handlePlay}
    />
  );
}
