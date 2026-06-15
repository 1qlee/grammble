import { createFileRoute } from "@tanstack/react-router";
import GameModeView from "~/components/game/GameModeView";

export const Route = createFileRoute("/eight")({
  component: EightRoute,
});

function EightRoute() {
  const { user, dailies } = Route.useRouteContext();
  // undefined for non-premium (getAllDaily omits it) -> null -> upsell.
  return <GameModeView mode="EIGHT" data={dailies.EIGHT ?? null} user={user} />;
}
