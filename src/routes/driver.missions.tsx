import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Truck, MapPin, Clock, Package, Search, Zap, Filter } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { useMissions } from "@/data/store";
import { restaurants, farmers } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/driver/missions")({
  head: () => ({ meta: [{ title: "Missions · Livreur Diambar" }] }),
  component: MissionsPage,
});

const URGENCY_TONE = {
  standard: "bg-muted text-muted-foreground border-border",
  priority: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  express: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
} as const;

function MissionsPage() {
  const all = useMissions();
  const [tab, setTab] = useState<"available" | "active" | "delivered" | "cancelled">("available");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("all");

  const items = useMemo(() => {
    return all.filter((m) => {
      if (tab === "available") return m.status === "available";
      if (tab === "active") return m.driverId === "d1" && (m.status === "accepted" || m.status === "pickup" || m.status === "loaded");
      if (tab === "delivered") return m.driverId === "d1" && m.status === "delivered";
      return m.status === "cancelled";
    }).filter((m) => (q === "" || m.reference.toLowerCase().includes(q.toLowerCase()) || m.pickup.city.toLowerCase().includes(q.toLowerCase()) || m.dropoff.city.toLowerCase().includes(q.toLowerCase())))
      .filter((m) => city === "all" || m.pickup.city === city || m.dropoff.city === city);
  }, [all, tab, q, city]);

  const cities = Array.from(new Set(all.flatMap((m) => [m.pickup.city, m.dropoff.city])));

  const count = (t: typeof tab) => all.filter((m) => {
    if (t === "available") return m.status === "available";
    if (t === "active") return m.driverId === "d1" && ["accepted", "pickup", "loaded"].includes(m.status);
    if (t === "delivered") return m.driverId === "d1" && m.status === "delivered";
    return m.status === "cancelled";
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Missions" subtitle={`${count("available")} disponible(s) · ${count("active")} en cours`} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="available">Disponibles ({count("available")})</TabsTrigger>
          <TabsTrigger value="active">En cours ({count("active")})</TabsTrigger>
          <TabsTrigger value="delivered">Livrées ({count("delivered")})</TabsTrigger>
          <TabsTrigger value="cancelled">Annulées ({count("cancelled")})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Référence, ville…" className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes villes</SelectItem>
              {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Truck} title="Aucune mission" description="Aucune mission ne correspond à vos filtres." />
      ) : (
        <div className="grid gap-3">
          {items.map((m) => {
            const r = restaurants.find((x) => x.id === m.restaurantId);
            const f = farmers.find((x) => x.id === m.farmerId);
            return (
              <Link key={m.id} to="/driver/missions/$missionId" params={{ missionId: m.id }}
                className="group glass rounded-2xl p-4 hover:border-primary/50 border border-transparent transition flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary shrink-0"><Truck className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{m.reference}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${URGENCY_TONE[m.urgency]}`}>
                        {m.urgency === "express" && <Zap className="h-2.5 w-2.5" />}{m.urgency}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{m.orderRef} · {f?.farm} → {r?.name}</div>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <Info icon={MapPin} label="Trajet">{m.pickup.city} → {m.dropoff.city}</Info>
                  <Info icon={Clock} label="Durée">~ {m.estimatedMinutes} min</Info>
                  <Info icon={Package} label="Poids">{m.weightKg} kg</Info>
                  <Info icon={Clock} label="Programmée">{relativeTime(m.scheduledFor)}</Info>
                </div>

                <div className="text-right md:ml-auto">
                  <div className="text-[10px] text-muted-foreground">Rémunération</div>
                  <div className="font-display font-bold text-primary text-lg">{formatFCFA(m.payout)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, children }: { icon: typeof Truck; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1"><Icon className="h-3 w-3" />{label}</span>
      <span className="text-xs font-medium truncate">{children}</span>
    </div>
  );
}