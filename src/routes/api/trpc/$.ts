import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "~/trpc/router";
import { createTRPCContext } from "~/trpc/init";

const handler = ({ request }: { request: Request }) =>
  fetchRequestHandler({
    router: appRouter,
    req: request,
    endpoint: "/api/trpc",
    createContext: createTRPCContext,
  });

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
