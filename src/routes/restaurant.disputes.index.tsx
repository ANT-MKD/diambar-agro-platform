import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisputeListView } from "@/components/disputes/dispute-list-view";
import { useCreditNotes, useDisputesForRole } from "@/data/disputes";
import { useBaseMode } from "@/data/demo-only";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/restaurant/disputes/")({
  head: () => ({
    meta: [
      { title: "Mes litiges — Espace restaurant Diambar Agro" },
      {
        name: "description",
        content: "Litiges ouverts sur vos commandes : statut, montant réclamé, avoirs et délais.",
      },
      { property: "og:title", content: "Mes litiges — Espace restaurant" },
      {
        property: "og:description",
        content: "Litiges ouverts sur vos commandes et avoirs obtenus.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RestaurantDisputesIndex,
});

function RestaurantDisputesIndex() {
  const disputes = useDisputesForRole("restaurant");
  const base = useBaseMode();
  return (
    <div className="space-y-6">
      <DisputeListView
        disputes={disputes}
        role="restaurant"
        detailPath="/restaurant/disputes/$disputeId"
        actions={
          <Button asChild className="gap-2">
            <Link to="/restaurant/disputes/new">
              <Plus className="h-4 w-4" />
              Ouvrir un litige
            </Link>
          </Button>
        }
      />
      {base && <MyCreditNotes />}
    </div>
  );
}

/** Avoirs obtenus (mode base) : solde, et commandes où ils ont servi. */
function MyCreditNotes() {
  const credits = useCreditNotes();
  if (!credits.length) return null;
  const available = credits.reduce((s, c) => s + (c.status === "issued" ? c.amount : 0), 0);
  return (
    <div className="glass rounded-2xl p-5 space-y-3" id="avoirs" data-testid="credit-notes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          Mes avoirs
        </h2>
        <span className="text-sm text-muted-foreground">
          Disponible : <b className="text-foreground">{formatFCFA(available)}</b> · à choisir au
          moment de commander
        </span>
      </div>
      <div className="space-y-2">
        {credits.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-sm"
          >
            <span className="font-mono font-semibold">{c.reference}</span>
            <span className="min-w-40 flex-1 text-xs text-muted-foreground">
              {c.reason ?? "Avoir"}
              {c.usages?.length
                ? ` · utilisé sur ${c.usages.map((u) => `${u.orderRef} (${formatFCFA(u.amount)})`).join(", ")}`
                : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              sur {formatFCFA(c.initialAmount ?? c.amount)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "issued" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
            >
              {c.status === "issued" ? `${formatFCFA(c.amount)} restant` : "Utilisé"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
