import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/driver/messages")({ component: () => <Outlet /> });
