import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Wallet, TrendingUp, ArrowUpRight, Download, Filter, ArrowDown } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { driverEarnings, driverEarningsChart, driverProfile } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/export";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/driver/earnings")({
  head: () => ({ meta: [{ title: "Mes Revenus · Livreur Diambar" }] }),
  component: EarningsPage,
});

function EarningsPage() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [method, setMethod] = useState("all");

  const items = useMemo(
    () => driverEarnings.filter((e) => method === "all" || e.method === method),
    [method],
  );
  const total = items.reduce((s, e) => s + e.net, 0);
  const totalBonus = items.reduce((s, e) => s + e.bonus, 0);
  const totalFees = items.reduce((s, e) => s + e.fee, 0);
  const paidCount = items.filter((e) => e.status === "Payé").length;
  const max = Math.max(...driverEarningsChart.map((d) => d.amount));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes Revenus"
        subtitle={`Solde disponible · ${formatFCFA(driverProfile.balance)}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                downloadCsv(
                  "revenus-livreur",
                  [
                    "Date",
                    "Mission",
                    "Commande",
                    "Restaurant",
                    "Brut",
                    "Bonus",
                    "Frais",
                    "Net",
                    "Méthode",
                    "Statut",
                  ],
                  items.map((e) => [
                    e.date,
                    e.missionRef,
                    e.orderRef,
                    e.restaurantName,
                    e.gross,
                    e.bonus,
                    e.fee,
                    e.net,
                    e.method,
                    e.status,
                  ]),
                )
              }
            >
              <Download className="h-4 w-4" />
              Exporter
            </Button>
            <Button className="gap-2">
              <ArrowDown className="h-4 w-4" />
              Retirer
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Solde disponible"
          value={formatFCFA(driverProfile.balance)}
          icon={Wallet}
          tone="text-primary"
        />
        <Kpi
          label="Gains période"
          value={formatFCFA(total)}
          icon={TrendingUp}
          tone="text-emerald-600 dark:text-emerald-400"
          delta="+18% vs période précédente"
        />
        <Kpi
          label="Bonus cumulés"
          value={formatFCFA(totalBonus)}
          icon={ArrowUpRight}
          tone="text-amber-600 dark:text-amber-400"
        />
        <Kpi
          label="Missions payées"
          value={String(paidCount)}
          icon={Wallet}
          tone="text-blue-600 dark:text-blue-400"
        />
      </div>

      {/* Graph + méthodes */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold">Évolution</h3>
              <p className="text-xs text-muted-foreground">Gains par jour de la semaine</p>
            </div>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <TabsList className="h-8">
                <TabsTrigger value="7d" className="text-xs h-6">
                  7j
                </TabsTrigger>
                <TabsTrigger value="30d" className="text-xs h-6">
                  30j
                </TabsTrigger>
                <TabsTrigger value="90d" className="text-xs h-6">
                  90j
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-end gap-3 h-52">
            {driverEarningsChart.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-[10px] font-semibold text-muted-foreground">
                  {formatFCFA(d.amount).replace(" FCFA", "")}
                </div>
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-primary via-primary/70 to-primary/30 hover:brightness-110 transition"
                  style={{ height: `${(d.amount / max) * 100}%` }}
                />
                <span className="text-[11px] text-muted-foreground">{d.day}</span>
                <span className="text-[9px] text-muted-foreground/70">{d.missions} miss.</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-bold mb-3">Répartition</h3>
          <div className="space-y-3 text-sm">
            <RowStat
              label="Gains bruts"
              value={formatFCFA(items.reduce((s, e) => s + e.gross, 0))}
            />
            <RowStat label="Bonus" value={`+ ${formatFCFA(totalBonus)}`} tone="text-emerald-600" />
            <RowStat
              label="Commission plateforme (5%)"
              value={`- ${formatFCFA(totalFees)}`}
              tone="text-rose-500"
            />
            <div className="border-t border-border pt-3">
              <RowStat label="Net versé" value={formatFCFA(total)} bold />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Prochain versement
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
              <div className="text-xs text-muted-foreground">Programmé demain</div>
              <div className="font-display text-xl font-bold text-primary mt-1">
                {formatFCFA(8575)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">Wave · +221 77 888 99 00</div>
            </div>
          </div>
        </div>
      </div>

      {/* Historique table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-border">
          <h3 className="font-display font-bold flex-1">Historique des paiements</h3>
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes méthodes</SelectItem>
              <SelectItem value="Wave">Wave</SelectItem>
              <SelectItem value="Orange Money">Orange Money</SelectItem>
              <SelectItem value="Free Money">Free Money</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Mission</th>
                <th className="text-left p-3">Restaurant</th>
                <th className="text-right p-3">Brut</th>
                <th className="text-right p-3">Bonus</th>
                <th className="text-right p-3">Net</th>
                <th className="text-left p-3">Méthode</th>
                <th className="text-left p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-t border-border hover:bg-accent/30">
                  <td className="p-3 text-xs text-muted-foreground">{e.date}</td>
                  <td className="p-3 font-medium">{e.missionRef}</td>
                  <td className="p-3 text-muted-foreground">{e.restaurantName}</td>
                  <td className="p-3 text-right">{formatFCFA(e.gross)}</td>
                  <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">
                    {e.bonus ? `+${formatFCFA(e.bonus)}` : "—"}
                  </td>
                  <td className="p-3 text-right font-semibold text-primary">{formatFCFA(e.net)}</td>
                  <td className="p-3 text-xs">{e.method}</td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                        e.status === "Payé"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : e.status === "Programmé"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Les paiements sont versés sous 24h sur votre méthode préférée ·{" "}
        <Link to="/driver/settings" className="text-primary hover:underline">
          Modifier
        </Link>
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  delta,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  tone: string;
  delta?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className={`mt-2 font-display text-2xl font-bold ${tone}`}>{value}</div>
      {delta && (
        <div className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">{delta}</div>
      )}
    </div>
  );
}

function RowStat({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${tone ?? ""} ${bold ? "font-display text-lg font-bold" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
