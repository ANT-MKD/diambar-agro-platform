import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/driver/notifications")({
  component: () => <Outlet />,
});
