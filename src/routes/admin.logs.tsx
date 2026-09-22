import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ScrollText,
  Search,
  Download,
  Printer,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  ChevronRight,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import {
  AUDIT_LEVEL_DOT,
  AUDIT_LEVEL_LABEL,
  AUDIT_MODULE_LABEL,
  type AuditLevel,
  type AuditModule,
  type AuditStatus,
} from "@/data/admin-mocks";
import { useAuditLogs, auditModulesFor, useAdminRoleForEmail } from "@/data/admin-store";

export const Route = createFileRoute("/admin/logs")({
  head: () => ({
    meta: [
      { title: "Journal d'audit — Administration Diambar Agro" },
      {
        name: "description",
        content: "Traçabilité complète des actions administratives et système.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogs,
});

const STATUS_LABEL: Record<AuditStatus, string> = {
  success: "Réussi",
  failed: "Échoué",
  blocked: "Bloqué",
  cancelled: "Annulé",
};

const STATUS_CLASS: Record<AuditStatus, string> = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  blocked: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const STATUS_ICON: Record<AuditStatus, LucideIcon> = {
  success: CheckCircle2,
  failed: XCircle,
  blocked: Ban,
  cancelled: XCircle,
};

// Aucune connexion échouée légitime en rafale ne devrait franchir ce seuil
// sur une fenêtre courte — dérivé uniquement des événements de connexion
// réels du journal, jamais d'une IP ou d'un appareil (rien de tel n'est
// capturé dans l'app).
const FAILED_LOGIN_WINDOW_MS = 15 * 60_000;
const FAILED_LOGIN_THRESHOLD = 3;

function extractRef(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = s.match(/[A-Z]{2,6}-\d{2,6}/);
  return m ? m[0] : null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminLogs() {
  const { user } = useRouteContext({ from: "/admin" });
  const role = useAdminRoleForEmail(user.email);
  const accessibleModules = useMemo(() => auditModulesFor(role), [role]);
  const allLogs = useAuditLogs();

  // Périmètre réel, pas cosmétique : un événement dont le module n'est pas
  // dans le périmètre du rôle connecté n'apparaît nulle part sur cette page
  // — ni dans les filtres, ni dans les KPI, ni dans l'export.
  const scopedLogs = useMemo(
    () => allLogs.filter((l) => accessibleModules.includes(l.module)),
    [allLogs, accessibleModules],
  );

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<AuditModule | "all">("all");
  const [levelFilter, setLevelFilter] = useState<AuditLevel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AuditStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return scopedLogs.filter((l) => {
      if (moduleFilter !== "all" && l.module !== moduleFilter) return false;
      if (levelFilter !== "all" && l.level !== levelFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !l.action.toLowerCase().includes(q) &&
          !l.target.toLowerCase().includes(q) &&
          !l.actor.toLowerCase().includes(q) &&
          !(l.reason ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [scopedLogs, moduleFilter, levelFilter, statusFilter, search]);

  // Ancrage sur l'événement le plus récent du périmètre plutôt que sur
  // l'horloge système (démo figée dans le passé) — même logique déjà
  // utilisée pour les remboursements et les retours.
  const refNow =
    scopedLogs.length > 0
      ? Math.max(...scopedLogs.map((l) => new Date(l.at).getTime()))
      : Date.now();
  const last24h = scopedLogs.filter((l) => refNow - new Date(l.at).getTime() < 24 * 3600_000);
  const criticalEvents = scopedLogs.filter((l) => l.level === "critical");
  const failedCount = scopedLogs.filter(
    (l) => l.status === "failed" || l.status === "blocked" || l.status === "cancelled",
  ).length;

  const failedLoginBursts = useMemo(() => {
    const failedLogins = scopedLogs
      .filter((l) => l.action === "Connexion échouée")
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const byTarget = new Map<string, string[]>();
    for (const l of failedLogins) {
      const arr = byTarget.get(l.target) ?? [];
      arr.push(l.at);
      byTarget.set(l.target, arr);
    }
    const bursts: { target: string; count: number }[] = [];
    for (const [target, times] of byTarget) {
      for (let i = 0; i + FAILED_LOGIN_THRESHOLD - 1 < times.length; i++) {
        const start = new Date(times[i]).getTime();
        const end = new Date(times[i + FAILED_LOGIN_THRESHOLD - 1]).getTime();
        if (end - start <= FAILED_LOGIN_WINDOW_MS) {
          bursts.push({ target, count: times.length });
          break;
        }
      }
    }
    return bursts;
  }, [scopedLogs]);

  const selected = filtered.find((l) => l.id === selectedId) ?? null;
  const relatedEvents = useMemo(() => {
    if (!selected) return [];
    const ref =
      extractRef(selected.target) ?? extractRef(selected.action) ?? extractRef(selected.reason);
    if (!ref) return [];
    return scopedLogs.filter(
      (l) =>
        l.id !== selected.id &&
        (l.target.includes(ref) || l.action.includes(ref) || (l.reason ?? "").includes(ref)),
    );
  }, [selected, scopedLogs]);

  const exportCsv = () =>
    downloadCsv(
      "journal-audit",
      ["Date", "Action", "Cible", "Acteur", "Module", "Gravité", "Statut", "Motif"],
      filtered.map((l) => [
        formatDateTime(l.at),
        l.action,
        l.target,
        l.actor,
        AUDIT_MODULE_LABEL[l.module],
        AUDIT_LEVEL_LABEL[l.level],
        STATUS_LABEL[l.status],
        l.reason ?? "",
      ]),
    );

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Journal d'audit"
          subtitle={`${scopedLogs.length} événement(s) dans votre périmètre (${role})`}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={exportCsv}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Exporter en PDF
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        <StatCard
          label="Événements (périmètre)"
          value={String(scopedLogs.length)}
          icon={ScrollText}
        />
        <StatCard label="Dernières 24h" value={String(last24h.length)} icon={Clock} />
        <StatCard
          label="Critiques"
          value={String(criticalEvents.length)}
          icon={ShieldAlert}
          hint={criticalEvents.length > 0 ? "À examiner" : undefined}
        />
        <StatCard label="Échecs / blocages" value={String(failedCount)} icon={XCircle} />
      </div>

      {(criticalEvents.length > 0 || failedLoginBursts.length > 0) && (
        <div className="glass rounded-2xl p-5 space-y-2.5 print:hidden">
          <h2 className="font-semibold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Anomalies détectées
          </h2>
          {failedLoginBursts.map((b) => (
            <button
              key={b.target}
              onClick={() => {
                setSearch(b.target);
                setModuleFilter("all");
                setLevelFilter("all");
                setStatusFilter("all");
              }}
              className="flex w-full items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-left text-sm hover:bg-destructive/10"
            >
              <span>
                🔴 {b.count} échecs de connexion pour {b.target}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          ))}
          {criticalEvents.slice(0, 3).map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id)}
              className="flex w-full items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-left text-sm hover:bg-destructive/10"
            >
              <span>
                ⚠ {l.action} — {l.target}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une action, une cible, un acteur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={moduleFilter}
          onValueChange={(v) => setModuleFilter(v as AuditModule | "all")}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modules</SelectItem>
            {accessibleModules.map((m) => (
              <SelectItem key={m} value={m}>
                {AUDIT_MODULE_LABEL[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as AuditLevel | "all")}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toute gravité</SelectItem>
            {(["info", "attention", "important", "critical"] as const).map((l) => (
              <SelectItem key={l} value={l}>
                {AUDIT_LEVEL_LABEL[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as AuditStatus | "all")}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout statut</SelectItem>
            {(["success", "failed", "blocked", "cancelled"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Aucun événement"
          description="Aucun événement ne correspond à ces filtres dans votre périmètre."
        />
      ) : (
        <div className="glass rounded-2xl divide-y divide-border overflow-hidden print:hidden">
          {filtered.map((l) => {
            const StatusIcon = STATUS_ICON[l.status];
            return (
              <button
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-left hover:bg-accent transition"
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", AUDIT_LEVEL_DOT[l.level])} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {l.action}
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-normal text-muted-foreground shrink-0">
                      {AUDIT_MODULE_LABEL[l.module]}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {l.target} · par {l.actor}
                  </div>
                </div>
                {l.status !== "success" && (
                  <StatusIcon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      l.status === "failed" || l.status === "blocked"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  />
                )}
                <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
                  {relativeTime(l.at)}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Vue impression uniquement : table lisible sans contrôles interactifs */}
      <div className="hidden print:block space-y-1">
        <h1 className="text-lg font-bold">Journal d'audit — {role}</h1>
        <p className="text-xs text-muted-foreground mb-4">
          Exporté le {formatDateTime(new Date().toISOString())} · {filtered.length} événement(s)
        </p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-black/20 text-left">
              <th className="py-1 pr-2">Date</th>
              <th className="py-1 pr-2">Action</th>
              <th className="py-1 pr-2">Cible</th>
              <th className="py-1 pr-2">Acteur</th>
              <th className="py-1 pr-2">Module</th>
              <th className="py-1 pr-2">Gravité</th>
              <th className="py-1 pr-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-b border-black/10">
                <td className="py-1 pr-2 whitespace-nowrap">{formatDateTime(l.at)}</td>
                <td className="py-1 pr-2">{l.action}</td>
                <td className="py-1 pr-2">{l.target}</td>
                <td className="py-1 pr-2">{l.actor}</td>
                <td className="py-1 pr-2">{AUDIT_MODULE_LABEL[l.module]}</td>
                <td className="py-1 pr-2">{AUDIT_LEVEL_LABEL[l.level]}</td>
                <td className="py-1 pr-2">{STATUS_LABEL[l.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span
                    className={cn("h-2.5 w-2.5 rounded-full", AUDIT_LEVEL_DOT[selected.level])}
                  />
                  {selected.action}
                </SheetTitle>
                <SheetDescription>{formatDateTime(selected.at)}</SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Cible</div>
                    <div className="font-medium">{selected.target}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Acteur</div>
                    <div className="font-medium">{selected.actor}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Module</div>
                    <div className="font-medium">{AUDIT_MODULE_LABEL[selected.module]}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Statut</div>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold mt-0.5",
                        STATUS_CLASS[selected.status],
                      )}
                    >
                      {STATUS_LABEL[selected.status]}
                    </span>
                  </div>
                </div>

                {selected.reason && (
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1">Motif</div>
                    <p className="rounded-xl border border-border bg-muted/30 p-3">
                      {selected.reason}
                    </p>
                  </div>
                )}

                {selected.changes && selected.changes.length > 0 && (
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1">Modifications</div>
                    <div className="space-y-1.5">
                      {selected.changes.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border p-2.5 text-xs"
                        >
                          <span className="text-muted-foreground shrink-0">{c.field}</span>
                          <span className="flex items-center gap-1.5 font-medium text-right">
                            <span className="text-muted-foreground line-through">{c.before}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span>{c.after}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {relatedEvents.length > 0 && (
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1">
                      Événements liés ({relatedEvents.length})
                    </div>
                    <div className="space-y-1.5">
                      {relatedEvents.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => setSelectedId(l.id)}
                          className="flex w-full items-center gap-2 rounded-xl border border-border p-2.5 text-xs text-left hover:bg-accent"
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full shrink-0",
                              AUDIT_LEVEL_DOT[l.level],
                            )}
                          />
                          <span className="flex-1 min-w-0 truncate">{l.action}</span>
                          <span className="text-muted-foreground shrink-0">
                            {relativeTime(l.at)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
