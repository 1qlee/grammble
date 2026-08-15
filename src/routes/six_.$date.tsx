import { createFileRoute } from "@tanstack/react-router";
import GameModeView from "~/components/game/GameModeView";
import {
  assertArchiveAccess,
  loadArchivePuzzle,
} from "~/components/game/archive/loadArchiveRoute";

export const Route = createFileRoute("/six_/$date")({
  ssr: false,
  beforeLoad: ({ params }) => assertArchiveAccess("SIX", params.date),
  loader: ({ params, context }) =>
    loadArchivePuzzle("SIX", params.date, context.user),
  component: SixArchiveRoute,
});

function SixArchiveRoute() {
  const { user } = Route.useRouteContext();
  const data = Route.useLoaderData();
  const { date } = Route.useParams();
  return (
    <GameModeView mode="SIX" data={data} user={user} isArchive archiveDate={date} />
  );
}
