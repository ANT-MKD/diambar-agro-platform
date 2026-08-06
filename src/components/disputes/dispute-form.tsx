import { useState } from "react";
import { Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDrop } from "./file-drop";
import { DISPUTE_CATEGORIES, PARTY_LABEL, disputeActions, type DisputeAttachment, type DisputeParty, type NewDisputeInput } from "@/data/disputes";
import { formatFCFA } from "@/lib/format";

type Props = {
  openedByRole: DisputeParty;
  openedByName: string;
  againstOptions: { role: DisputeParty; name: string }[];
  orderRef: string;
  orderId?: string;
  invoiceId?: string;
  missionId?: string;
  hasGpsTrack?: boolean;
  maxAmount?: number;
  defaultCategory?: string;
  onCreated: (id: string) => void;
  onCancel: () => void;
};

export function DisputeForm(p: Props) {
  const [category, setCategory] = useState(p.defaultCategory ?? "quality");
  const [subcategory, setSubcategory] = useState(DISPUTE_CATEGORIES[p.defaultCategory ?? "quality"].subs[0]);
  const [againstIdx, setAgainstIdx] = useState("0");
  const [amount, setAmount] = useState(String(p.maxAmount ?? 0));
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<DisputeAttachment[]>([]);

  const submit = () => {
    if (!description.trim() || description.trim().length < 20) { toast.error("Décrivez le problème (20 caractères minimum)"); return; }
    const value = Number(amount) || 0;
    if (value <= 0) { toast.error("Indiquez le montant réclamé"); return; }
    if (p.maxAmount && value > p.maxAmount) { toast.error(`Le montant ne peut dépasser ${formatFCFA(p.maxAmount)}`); return; }
    const against = p.againstOptions[Number(againstIdx)];
    const input: NewDisputeInput = {
      category, subcategory, description: description.trim(),
      orderRef: p.orderRef, orderId: p.orderId, invoiceId: p.invoiceId, missionId: p.missionId,
      hasGpsTrack: p.hasGpsTrack,
      openedByRole: p.openedByRole, openedByName: p.openedByName,
      againstRole: against.role, againstName: against.name,
      claimedAmount: value, priority, channel: "app", attachments: files,
    };
    const id = disputeActions.open(input);
    toast.success("Litige ouvert · le support répond selon le SLA affiché");
    p.onCreated(id);
  };

  const slaHours = priority === "high" ? 24 : priority === "medium" ? 48 : 72;

  return (
    <div className="glass space-y-5 rounded-2xl p-6">
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <Scale className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="text-sm">
          <div className="font-semibold text-amber-500">Ouverture d'un dossier officiel</div>
          <div className="mt-0.5 text-muted-foreground">
            Commande <b>{p.orderRef}</b>{p.maxAmount ? <> · montant maximum réclamable <b>{formatFCFA(p.maxAmount)}</b></> : null} · réponse du support sous <b>{slaHours}h</b>.
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Catégorie</Label>
          <Select value={category} onValueChange={(v) => { setCategory(v); setSubcategory(DISPUTE_CATEGORIES[v].subs[0]); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(DISPUTE_CATEGORIES).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Sous-catégorie</Label>
          <Select value={subcategory} onValueChange={setSubcategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DISPUTE_CATEGORIES[category].subs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Partie mise en cause</Label>
          <Select value={againstIdx} onValueChange={setAgainstIdx}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{p.againstOptions.map((o, i) => <SelectItem key={`${o.role}-${o.name}`} value={String(i)}>{PARTY_LABEL[o.role]} · {o.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Montant réclamé (FCFA)</Label>
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Gravité</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["low", "medium", "high"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setPriority(s)}
              className={`rounded-xl border p-3 text-sm font-medium transition ${priority === s ? (s === "high" ? "border-rose-500 bg-rose-500/10 text-rose-500" : s === "medium" ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-blue-500 bg-blue-500/10 text-blue-500") : "border-border"}`}>
              {s === "low" ? "Faible · 72h" : s === "medium" ? "Moyenne · 48h" : "Élevée · 24h"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description détaillée</Label>
        <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Décrivez les faits : heure, quantités, personnes impliquées, échanges déjà eus…" />
      </div>

      <FileDrop value={files} onChange={setFiles} by={p.openedByName} kind="photo" label="Preuves (photos, bon de livraison, capture de paiement)" />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={p.onCancel}>Annuler</Button>
        <Button onClick={submit}>Ouvrir le litige</Button>
      </div>
    </div>
  );
}
