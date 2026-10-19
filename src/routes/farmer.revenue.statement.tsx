import { createFileRoute } from "@tanstack/react-router";
import { MonthlyStatement } from "@/components/common/monthly-statement";

export const Route = createFileRoute("/farmer/revenue/statement")({
  head: () => ({ meta: [{ title: "Relevé mensuel · Diambar Agro" }] }),
  component: MonthlyStatement,
});
