import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/farmer/revenue")({
  component: Page,
});

function Page() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-bold capitalize">revenue</h1>
      <div className="glass rounded-2xl p-10 text-center">
        <p className="text-muted-foreground">Cette page sera développée dans la suite de la Phase 3 — pages CRUD dédiées comme convenu.</p>
      </div>
    </div>
  );
}
