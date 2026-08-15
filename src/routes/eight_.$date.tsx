import { createFileRoute } from "@tanstack/react-router";
import GameModeView from "~/components/game/GameModeView";
import {
  assertArchiveAccess,
  loadArchivePuzzle,
} from "~/components/game/archive/loadArchiveRoute";

export const Route = createFileRoute("/eight_/$date")({
  ssr: false,
  beforeLoad: ({ params }) => assertArchiveAccess("EIGHT", params.date),
  loader: ({ params, context }) =>
    loadArchivePuzzle("EIGHT", params.date, context.user),
  component: EightArchiveRoute,
});

function EightArchiveRoute() {
  const { user } = Route.useRouteContext();
  const data = Route.useLoaderData();
  const { date } = Route.useParams();
  return (
    <GameModeView
      mode="EIGHT"
      data={data}
      user={user}
      isArchive
      archiveDate={date}
    />
  );
}
