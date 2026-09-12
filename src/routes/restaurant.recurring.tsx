import { createFileRoute } from "@tanstack/react-router";
import { Repeat, Calendar, Plus, SkipForward, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { products, farmers } from "@/data/mocks";
import { useRecurring, recurringActions } from "@/data/store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

export const Route = createFileRoute("/restaurant/recurring")({
  head: () => ({ meta: [{ title: "Commandes récurrentes" }] }),
  component: Recurring,
});

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function Recurring() {
  const items = useRecurring();
  const today = new Date();
  const monthIndex = today.getMonth();
  const year = today.getFullYear();
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const deliveriesByDay: Record<number, typeof items> = {};
  items
    .filter((r) => r.active)
    .forEach((r) => {
      const d = new Date(r.nextDelivery === "—" ? today : r.nextDelivery);
      if (d.getMonth() === monthIndex && d.getFullYear() === year) {
        const day = d.getDate();
        if (!deliveriesByDay[day]) deliveriesByDay[day] = [];
        deliveriesByDay[day].push(r);
      }
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commandes récurrentes"
        subtitle="Programmez vos livraisons automatiques"
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle
          </Button>
        }
      />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          {items.length === 0 && (
            <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
              Aucune commande récurrente.
            </div>
          )}
          {items.map((r, idx) => {
            const farmer = farmers[idx % farmers.length];
            return (
              <div
                key={r.id}
                className={`glass rounded-2xl p-5 space-y-3 ${!r.active ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                      <Repeat className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {r.frequency === "weekly"
                          ? "Hebdomadaire"
                          : r.frequency === "biweekly"
                            ? "Bi-hebdo"
                            : "Mensuelle"}{" "}
                        · {DAYS[r.dayOfWeek]}
                      </h3>
                      <div className="text-[11px] text-muted-foreground">via {farmer.farm}</div>
                    </div>
                  </div>
                  <Switch
                    checked={r.active}
                    onCheckedChange={() => {
                      recurringActions.toggle(r.id);
                      toast.success(r.active ? "Récurrence mise en pause" : "Récurrence réactivée");
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  {r.items.map((it, i) => {
                    const p = products.find((x) => x.id === it.productId);
                    return (
                      <div key={i} className="text-sm flex justify-between">
                        <span>{p?.name}</span>
                        <span className="text-muted-foreground">
                          ×{it.qty}
                          {p?.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Prochaine: <b className="text-foreground">{r.nextDelivery}</b>
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1"
                      onClick={() => {
                        recurringActions.skipNext(r.id);
                        toast.success("Prochaine livraison sautée");
                      }}
                    >
                      <SkipForward className="h-3 w-3" />
                      Sauter
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      }
                      title="Supprimer cette récurrence ?"
                      description="Cette action est irréversible."
                      destructive
                      confirmLabel="Supprimer"
                      onConfirm={() => {
                        recurringActions.remove(r.id);
                        toast.success("Récurrence supprimée");
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="glass rounded-2xl p-5 h-fit sticky top-20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold">
              {MONTHS[monthIndex]} {year}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {Object.values(deliveriesByDay).flat().length} livraison(s)
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground mb-1">
            {DAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === today.getDate();
              const drops = deliveriesByDay[day] ?? [];
              return (
                <div
                  key={day}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative ${isToday ? "bg-primary text-primary-foreground font-bold" : drops.length > 0 ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"}`}
                >
                  {day}
                  {drops.length > 0 && !isToday && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" /> Livraison prévue
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
