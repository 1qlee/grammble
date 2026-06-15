import { createFileRoute } from "@tanstack/react-router";
import GameModeView from "~/components/game/GameModeView";

export const Route = createFileRoute("/six")({
  component: SixRoute,
});

function SixRoute() {
  const { user, dailies } = Route.useRouteContext();
  return <GameModeView mode="SIX" data={dailies.SIX ?? null} user={user} />;
}
