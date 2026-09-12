import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/restaurant/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/restaurant/settings/profile" });
  },
});
