import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Banknote, Check, X, Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatFCFA, relativeTime } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { auditActions } from "@/data/admin-store";
import {
  useRefunds, refundActions, REFUND_SOURCE_LABEL, REFUND_STATUS_LABEL,
  type RefundStatus, type Refund,
} from "@/data/business";

export const Route = createFileRoute("/admin/refunds")({
  head: () => ({ meta: [
    { title: "Remboursements — Administration Diambar Agro" },
    { name: "description", content: "Validez, rejetez et exécutez les remboursements issus des litiges, retours et incidents de course." },
    { property: "og:title", content: "Remboursements — Administration" },
    { property: "og:description", content: "Outil de remboursement de la plateforme Diambar Agro." },
    { name: "robots", content: "noindex" },
  ] }),
  component: RefundsPage,
});

const TABS: { key: RefundStatus | "all"; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "À valider" },
  { key: "approved", label: "Approuvés" },
  { key: "paid", label: "Remboursés" },
  { key: "rejected", label: "Rejetés" },
];

const STATUS_CLASS: Record<RefundStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  approved: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const METHODS: Refund["method"][] = ["Wave", "Orange Money", "Free Money", "Virement"];

function RefundsPage() {
  const refunds = useRefunds();
  const [tab, setTab] = useState<RefundStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ orderRef: "", requester: "", amount: "", method: "Wave" as Refund["method"], reason: "" });
  const [noteId, setNoteId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const list = tab === "all" ? refunds : refunds.filter((r) => r.status === tab);
  const pending = refunds.filter((r) => r.status === "pending");
  const paidTotal = refunds.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const pendingTotal = pending.reduce((s, r) => s + r.amount, 0);

  const exportCsv = () =>
    downloadCsv("remboursements", ["Référence", "Origine", "Commande", "Bénéficiaire", "Montant", "Moyen", "Statut", "Date"],
      refunds.map((r) => [r.reference, REFUND_SOURCE_LABEL[r.source], r.orderRef, r.requester, r.amount, r.method, REFUND_STATUS_LABEL[r.status], new Date(r.createdAt).toLocaleDateString("fr-FR")]));

  const submit = () => {
    if (!form.requester.trim() || !form.reason.trim() || !Number(form.amount)) { toast.error("Bénéficiaire, montant et motif sont obligatoires"); return; }
    refundActions.create({ source: "manual", orderRef: form.orderRef.trim() || "—", requester: form.requester.trim(), amount: Number(form.amount), method: form.method, reason: form.reason.trim() });
    auditActions.log("Remboursement créé (geste commercial)", form.requester.trim(), "info");
    setForm({ orderRef: "", requester: "", amount: "", method: "Wave", reason: "" });
    setShowForm(false);
    toast.success("Demande de remboursement créée");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Remboursements"
        subtitle="Litiges, retours, incidents et gestes commerciaux"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" />Export comptable</Button>
            <Button className="gap-2" onClick={() => setShowForm((v) => !v)}><Plus className="h-4 w-4" />Nouveau</Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl p-4"><div className="text-xs text-muted-foreground">En attente de validation</div><div className="mt-1 text-2xl font-bold">{pending.length}</div><div className="text-xs text-muted-foreground">{formatFCFA(pendingTotal)}</div></div>
        <div className="glass rounded-2xl p-4"><div className="text-xs text-muted-foreground">Remboursé (cumul)</div><div className="mt-1 text-2xl font-bold">{formatFCFA(paidTotal)}</div></div>
        <div className="glass rounded-2xl p-4"><div className="text-xs text-muted-foreground">Dossiers traités</div><div className="mt-1 text-2xl font-bold">{refunds.filter((r) => r.status !== "pending").length}/{refunds.length}</div></div>
      </div>

      {showForm && (
        <div className="glass rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold">Nouveau remboursement</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Bénéficiaire</label><Input placeholder="Le Baobab" value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Commande liée</label><Input placeholder="CMD-2851" value={form.orderRef} onChange={(e) => setForm({ ...form, orderRef: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Montant (FCFA)</label><Input inputMode="numeric" placeholder="5000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Moyen</label>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <button key={m} type="button" onClick={() => setForm({ ...form, method: m })}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${form.method === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>{m}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1 sm:col-span-2"><label className="text-xs font-medium text-muted-foreground">Motif</label><Textarea placeholder="Motif du remboursement…" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <div className="flex gap-2"><Button onClick={submit}>Créer</Button><Button variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button></div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${tab === t.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>{t.label}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Banknote} title="Aucun remboursement" description="Aucun dossier dans cette catégorie." />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.reference}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[r.status]}`}>{REFUND_STATUS_LABEL[r.status]}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{REFUND_SOURCE_LABEL[r.source]}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{r.requester} · {r.orderRef} · {r.method} · {relativeTime(r.createdAt)}</div>
                  <p className="mt-1 text-sm">{r.reason}</p>
                  {r.note && <p className="mt-1 text-xs text-muted-foreground">Note : {r.note}</p>}
                </div>
                <div className="text-right"><div className="text-xs text-muted-foreground">Montant</div><div className="text-lg font-bold">{formatFCFA(r.amount)}</div></div>
              </div>

              {r.status === "pending" && (
                noteId === r.id ? (
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <Textarea placeholder="Note de décision" value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="gap-2" onClick={() => { refundActions.approve(r.id, note || undefined); auditActions.log("Remboursement approuvé", r.reference, "info"); setNoteId(null); setNote(""); toast.success("Remboursement approuvé"); }}><Check className="h-4 w-4" />Approuver</Button>
                      <Button size="sm" variant="destructive" className="gap-2" onClick={() => { if (!note.trim()) { toast.error("Indiquez un motif de rejet"); return; } refundActions.reject(r.id, note); auditActions.log("Remboursement rejeté", r.reference, "warning"); setNoteId(null); setNote(""); toast.success("Remboursement rejeté"); }}><X className="h-4 w-4" />Rejeter</Button>
                      <Button size="sm" variant="ghost" onClick={() => setNoteId(null)}>Annuler</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => { setNoteId(r.id); setNote(""); }}>Traiter le dossier</Button>
                )
              )}

              {r.status === "approved" && (
                <Button size="sm" className="gap-2" onClick={() => { refundActions.markPaid(r.id); auditActions.log("Remboursement exécuté", r.reference, "info"); toast.success("Remboursement exécuté", { description: `${formatFCFA(r.amount)} via ${r.method}` }); }}>
                  <Banknote className="h-4 w-4" />Marquer comme remboursé
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
