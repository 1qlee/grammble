import { createFileRoute } from "@tanstack/react-router";
import { t } from "~/trpc/init";

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return request.json();
      },
    },
  },
});
