import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/driver/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/driver/settings/profile" });
  },
});
