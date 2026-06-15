import { createFileRoute } from "@tanstack/react-router";
import GameModeView from "~/components/game/GameModeView";

export const Route = createFileRoute("/seven")({
  component: SevenRoute,
});

function SevenRoute() {
  const { user, dailies } = Route.useRouteContext();
  // undefined for non-premium (getAllDaily omits it) -> null -> upsell.
  return <GameModeView mode="SEVEN" data={dailies.SEVEN ?? null} user={user} />;
}
