import { createFileRoute } from "@tanstack/react-router";
import GameModeView from "~/components/game/GameModeView";
import { ensureDailyForMode } from "~/components/game/loadDailyModeRoute";

export const Route = createFileRoute("/six")({
  loader: ({ context }) => ensureDailyForMode("SIX", context),
  component: SixRoute,
});

function SixRoute() {
  const { user } = Route.useRouteContext();
  const data = Route.useLoaderData();
  return <GameModeView mode="SIX" data={data} user={user} />;
}
