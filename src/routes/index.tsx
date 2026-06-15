import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { MainMenu } from "~/components/MainMenu";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { user, dailies } = Route.useRouteContext();
  const navigate = useNavigate();
  // SSR renders the menu immediately; flip after mount so the Play button
  // leaves its loading state only once the app has hydrated and can navigate.
  const [isHydrated, setIsHydrated] = React.useState(false);
  const six = dailies.SIX;

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
