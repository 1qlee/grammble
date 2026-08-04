import { createFileRoute } from "@tanstack/react-router";
import GameModeView from "~/components/game/GameModeView";
import {
  assertArchiveAccess,
  loadArchivePuzzle,
} from "~/components/game/archive/loadArchiveRoute";

export const Route = createFileRoute("/seven_/$date")({
  ssr: false,
  beforeLoad: ({ params }) => assertArchiveAccess("SEVEN", params.date),
  loader: ({ params, context }) =>
    loadArchivePuzzle("SEVEN", params.date, context.user),
  component: SevenArchiveRoute,
});

function SevenArchiveRoute() {
  const { user } = Route.useRouteContext();
  const data = Route.useLoaderData();
  const { date } = Route.useParams();
  return (
    <GameModeView
      mode="SEVEN"
      data={data}
      user={user}
      isArchive
      archiveDate={date}
    />
  );
}
