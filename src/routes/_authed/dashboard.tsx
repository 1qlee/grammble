import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Hello {user?.email || "User"}!</p>
    </div>
  );
}
