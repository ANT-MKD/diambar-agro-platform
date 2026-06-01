import { createFileRoute } from "@tanstack/react-router";
import { Repeat, Calendar, Plus } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { recurringOrders, products, farmers } from "@/data/mocks";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

export const Route = createFileRoute("/restaurant/recurring")({
  head: () => ({ meta: [{ title: "Commandes récurrentes" }] }),
  component: Recurring,
});

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function Recurring() {
  const [items, setItems] = useState(recurringOrders);
  return (
    <div className="space-y-6">
      <PageHeader title="Commandes récurrentes" subtitle="Programmez vos livraisons hebdomadaires automatiques" actions={
        <Button className="gap-2"><Plus className="h-4 w-4" />Nouvelle</Button>
      } />
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((r) => {
          const farmer = farmers[items.indexOf(r) % farmers.length];
          return (
            <div key={r.id} className="glass rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><Repeat className="h-5 w-5" /></div>
                  <div>
                    <h3 className="font-semibold capitalize">{r.frequency === "weekly" ? "Hebdomadaire" : r.frequency === "biweekly" ? "Bi-hebdo" : "Mensuelle"}</h3>
                    <div className="text-[11px] text-muted-foreground">via {farmer.farm}</div>
                  </div>
                </div>
                <Switch checked={r.active} onCheckedChange={(v) => setItems(items.map((x) => x.id === r.id ? { ...x, active: v } : x))} />
              </div>
              <div className="space-y-1.5">
                {r.items.map((it, i) => {
                  const p = products.find((x) => x.id === it.productId);
                  return <div key={i} className="text-sm flex justify-between"><span>{p?.name}</span><span className="text-muted-foreground">×{it.qty}{p?.unit}</span></div>;
                })}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Chaque {DAYS[r.dayOfWeek]}</span>
                <span className="font-medium">Prochaine: {r.nextDelivery}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}