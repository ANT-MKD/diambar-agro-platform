import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/farmer/messages")({ component: () => <Outlet /> });