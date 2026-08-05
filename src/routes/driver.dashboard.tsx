import { createFileRoute, Link } from "@tanstack/react-router";
import { Truck, Wallet, Route as RouteIcon, Star, Zap, ArrowRight, Clock, MapPin, TrendingUp, Package, ZapOff } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/farmer/page-header";
import { useMissions, useDriverOnline, driverOnlineActions, useDriverWallet } from "@/data/store";
import { driverProfile, restaurants, farmers, driverEarningsChart } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/driver/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord · Livreur Diambar" }] }),
  component: DriverDashboard,
});

function DriverDashboard() {
  const missions = useMissions();
  const online = useDriverOnline();
  const wallet = useDriverWallet();
  const grossMissions = wallet.transactions.filter((t) => t.kind === "mission").reduce((s, t) => s + t.amount, 0);
  const bonusTotal = wallet.transactions.filter((t) => t.kind === "bonus").reduce((s, t) => s + t.amount, 0);
  const commissionTotal = wallet.transactions.filter((t) => t.kind === "commission").reduce((s, t) => s + t.amount, 0);
  const commissionRate = grossMissions ? Math.round((Math.abs(commissionTotal) / grossMissions) * 1000) / 10 : 0;
  const available = missions.filter((m) => m.status === "available");
  const active = missions.filter((m) => m.driverId === "d1" && (m.status === "accepted" || m.status === "pickup" || m.status === "loaded"));
  const nextMission = active[0] ?? null;

  const kpis = [
    { label: "Gains du jour", value: formatFCFA(driverProfile.todayEarnings), icon: Wallet, tone: "from-emerald-500/20 to-emerald-500/0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" },
    { label: "Livraisons", value: `${driverProfile.todayMissions}`, icon: Truck, tone: "from-blue-500/20 to-blue-500/0 border-blue-500/30 text-blue-600 dark:text-blue-400" },
    { label: "Distance", value: `${driverProfile.todayKm} km`, icon: RouteIcon, tone: "from-violet-500/20 to-violet-500/0 border-violet-500/30 text-violet-600 dark:text-violet-400" },
    { label: "Note client", value: `${driverProfile.rating} ★`, icon: Star, tone: "from-amber-500/20 to-amber-500/0 border-amber-500/30 text-amber-600 dark:text-amber-400" },
  ];

  const bonusProgress = Math.min(100, Math.round((driverProfile.todayMissions / 6) * 100));
  const maxChart = Math.max(...driverEarningsChart.map((d) => d.amount));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour ${driverProfile.name.split(" ")[0]} 👋`}
        subtitle={online ? "Vous êtes en ligne · les missions vous seront proposées en temps réel" : "Vous êtes hors-ligne · aucune mission ne vous sera proposée"}
        actions={
          <Button variant={online ? "outline" : "default"} onClick={() => driverOnlineActions.toggle()} className="gap-2">
            {online ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
            {online ? "Passer hors-ligne" : "Se mettre en ligne"}
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className={`glass rounded-2xl p-4 border-l-4 bg-gradient-to-br ${k.tone}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{k.label}</span>
              <k.icon className="h-4 w-4 opacity-80" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold">{k.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Prochaine mission */}
        <div className="lg:col-span-2 space-y-6">
          {nextMission ? (
            (() => {
              const r = restaurants.find((x) => x.id === nextMission.restaurantId);
              const f = farmers.find((x) => x.id === nextMission.farmerId);
              return (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl overflow-hidden border-l-4 border-primary">
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Mission en cours</div>
                        <div className="font-display text-xl font-bold mt-1">{nextMission.reference}</div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold">
                        <Clock className="h-3 w-3" />{nextMission.status === "loaded" ? "En livraison" : nextMission.status === "pickup" ? "En pickup" : "Acceptée"}
                      </span>
                    </div>

                    <div className="mt-4 grid sm:grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/40 p-3">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase"><MapPin className="h-3.5 w-3.5" /> Pickup · {f?.farm}</div>
                        <div className="mt-1 text-sm">{nextMission.pickup.address}</div>
                      </div>
                      <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-primary uppercase"><MapPin className="h-3.5 w-3.5" /> Livraison · {r?.name}</div>
                        <div className="mt-1 text-sm">{nextMission.dropoff.address}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><RouteIcon className="h-3.5 w-3.5" />{nextMission.distanceKm} km</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />~ {nextMission.estimatedMinutes} min</span>
                      <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" />{nextMission.weightKg} kg</span>
                      <span className="ml-auto font-bold text-primary text-base">{formatFCFA(nextMission.payout)}</span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button asChild className="flex-1 gap-2"><Link to="/driver/missions/$missionId" params={{ missionId: nextMission.id }}>Ouvrir la mission <ArrowRight className="h-4 w-4" /></Link></Button>
                    </div>
                  </div>
                </motion.div>
              );
            })()
          ) : (
            <div className="glass rounded-2xl p-10 text-center">
              <Truck className="h-10 w-10 mx-auto text-muted-foreground" />
              <h3 className="mt-3 font-semibold">Aucune mission en cours</h3>
              <p className="mt-1 text-sm text-muted-foreground">Parcourez le marketplace pour accepter votre prochaine mission.</p>
              <Button asChild className="mt-4 gap-2"><Link to="/driver/missions">Voir les missions <ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
          )}

          {/* Missions disponibles */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-bold">Missions disponibles</h3>
                <p className="text-xs text-muted-foreground">{available.length} mission(s) autour de vous</p>
              </div>
              <Button asChild variant="outline" size="sm" className="gap-1"><Link to="/driver/missions">Toutes <ArrowRight className="h-3 w-3" /></Link></Button>
            </div>
            <div className="space-y-2">
              {available.slice(0, 3).map((m) => {
                const r = restaurants.find((x) => x.id === m.restaurantId);
                return (
                  <Link key={m.id} to="/driver/missions/$missionId" params={{ missionId: m.id }} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-accent/40 transition">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0"><Truck className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{m.pickup.city} → {m.dropoff.city}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{r?.name} · {m.distanceKm} km · {m.weightKg} kg</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">{formatFCFA(m.payout)}</div>
                      <div className="text-[10px] text-muted-foreground">{relativeTime(m.createdAt)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar droite */}
        <div className="space-y-6">
          {/* Bonus / objectif jour */}
          <div className="glass rounded-2xl p-5 border-t-4 border-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Objectif du jour</div>
                <div className="mt-1 font-display font-bold">Bonus +2 000 FCFA</div>
              </div>
              <Star className="h-6 w-6 text-amber-500" />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">{driverProfile.todayMissions} / 6 missions</div>
            <div className="mt-1.5 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all" style={{ width: `${bonusProgress}%` }} />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">Complétez {6 - driverProfile.todayMissions} mission(s) de plus pour débloquer le bonus.</p>
          </div>

          {/* Portefeuille */}
          <div className="glass rounded-2xl p-5 bg-gradient-to-br from-primary/10 via-transparent to-blue-500/10">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Portefeuille</div>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-1 font-display text-3xl font-bold text-primary">{formatFCFA(wallet.balance)}</div>
            <div className="text-[11px] text-muted-foreground">disponible · {formatFCFA(wallet.pending)} en attente</div>

            <div className="mt-4 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dernières transactions</div>
              {wallet.transactions.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted-foreground">{t.label}</span>
                  <span className={`font-semibold shrink-0 ${t.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                    {t.amount > 0 ? "+" : "−"}{formatFCFA(Math.abs(t.amount))}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-border p-3 text-xs space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Commission</div>
              <div className="flex justify-between"><span className="text-muted-foreground">Gains bruts</span><span className="font-medium">{formatFCFA(grossMissions)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Diambar ({commissionRate}%)</span><span className="font-medium text-rose-500">− {formatFCFA(Math.abs(commissionTotal))}</span></div>
              <div className="flex justify-between border-t border-border pt-1.5"><span className="text-muted-foreground">Net</span><span className="font-bold text-primary">{formatFCFA(grossMissions + bonusTotal + commissionTotal)}</span></div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button asChild size="sm"><Link to="/driver/wallet">Portefeuille</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to="/driver/earnings">Revenus</Link></Button>
            </div>
          </div>

          {/* Graph semaine */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Cette semaine</div>
                <div className="mt-1 font-display font-bold flex items-center gap-1.5">{formatFCFA(driverEarningsChart.reduce((s, d) => s + d.amount, 0))} <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /></div>
              </div>
            </div>
            <div className="flex items-end gap-1.5 h-24">
              {driverEarningsChart.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-md bg-gradient-to-t from-primary to-primary/40" style={{ height: `${(d.amount / maxChart) * 100}%` }} />
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}