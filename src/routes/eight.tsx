import { createFileRoute } from "@tanstack/react-router";
import GameModeView from "~/components/game/GameModeView";
import { ensureDailyForMode } from "~/components/game/loadDailyModeRoute";

export const Route = createFileRoute("/eight")({
  // null for non-premium (getAllDaily omits it) -> upsell.
  loader: ({ context }) => ensureDailyForMode("EIGHT", context),
  component: EightRoute,
});

function EightRoute() {
  const { user } = Route.useRouteContext();
  const data = Route.useLoaderData();
  return <GameModeView mode="EIGHT" data={data} user={user} />;
}
