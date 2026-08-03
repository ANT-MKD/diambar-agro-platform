import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/farmer/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/farmer/settings/profile" });
  },
});