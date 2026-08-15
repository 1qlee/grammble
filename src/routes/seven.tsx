import { createFileRoute } from "@tanstack/react-router";
import GameModeView from "~/components/game/GameModeView";
import { ensureDailyForMode } from "~/components/game/loadDailyModeRoute";

export const Route = createFileRoute("/seven")({
  // null for non-premium (getAllDaily omits it) -> upsell.
  loader: ({ context }) => ensureDailyForMode("SEVEN", context),
  component: SevenRoute,
});

function SevenRoute() {
  const { user } = Route.useRouteContext();
  const data = Route.useLoaderData();
  return <GameModeView mode="SEVEN" data={data} user={user} />;
}
