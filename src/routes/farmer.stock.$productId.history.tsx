import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, ClipboardEdit } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { useMovements, useProduct } from "@/data/store";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/farmer/stock/$productId/history")({
  head: () => ({ meta: [{ title: "Historique stock · Diambar Agro" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const { productId } = Route.useParams();
  const product = useProduct(productId);
  const movements = useMovements().filter((m) => m.productId === productId);
  const inSum = movements.filter((m) => m.type === "in").reduce((a, m) => a + m.qty, 0);
  const outSum = movements.filter((m) => m.type === "out").reduce((a, m) => a + m.qty, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={product?.name ?? "Produit"}
        subtitle="Historique des mouvements"
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/farmer/stock">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
        }
      />

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="text-xs text-muted-foreground">Entrées</div>
          <div className="font-display text-2xl font-bold text-emerald-500">
            +{inSum} {product?.unit}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-xs text-muted-foreground">Sorties</div>
          <div className="font-display text-2xl font-bold text-rose-500">
            -{outSum} {product?.unit}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-xs text-muted-foreground">Stock actuel</div>
          <div className="font-display text-2xl font-bold">
            {product?.stock ?? 0} {product?.unit}
          </div>
        </div>
      </div>

      {movements.length === 0 ? (
        <EmptyState
          icon={ClipboardEdit}
          title="Aucun mouvement"
          description="L'historique des mouvements apparaîtra ici."
        />
      ) : (
        <div className="glass rounded-2xl p-5 space-y-3">
          {movements.map((m) => {
            const Icon =
              m.type === "in" ? ArrowDownCircle : m.type === "out" ? ArrowUpCircle : ClipboardEdit;
            const tone =
              m.type === "in"
                ? "text-emerald-500"
                : m.type === "out"
                  ? "text-rose-500"
                  : "text-blue-500";
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
              >
                <Icon className={`h-5 w-5 ${tone}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{m.reason}</div>
                  <div className="text-xs text-muted-foreground">
                    {relativeTime(m.at)} · {m.operator}
                  </div>
                </div>
                <div className={`font-bold ${tone}`}>
                  {m.type === "out" ? "-" : "+"}
                  {m.qty} {product?.unit}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
