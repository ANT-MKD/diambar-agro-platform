import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Flag, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { useOrder } from "@/data/store";
import { disputeActions } from "@/data/disputes";
import { restaurants } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/farmer/orders/$orderId/report")({
  head: () => ({ meta: [{ title: "Signaler un problème · Diambar Agro" }] }),
  component: ReportPage,
});

const ISSUES = [
  { v: "no_show", label: "Restaurant absent à la livraison" },
  { v: "payment", label: "Paiement non reçu" },
  { v: "behavior", label: "Comportement inapproprié" },
  { v: "address", label: "Adresse incorrecte" },
  { v: "driver", label: "Problème avec le livreur" },
  { v: "other", label: "Autre" },
];

function ReportPage() {
  const { orderId } = Route.useParams();
  const order = useOrder(orderId);
  const navigate = useNavigate();
  const [issue, setIssue] = useState("no_show");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [description, setDescription] = useState("");

  if (!order)
    return <p className="text-center text-muted-foreground py-12">Commande introuvable</p>;
  const r = restaurants.find((x) => x.id === order.restaurantId);

  const submit = () => {
    if (!description.trim()) {
      toast.error("Veuillez décrire le problème");
      return;
    }
    const map: Record<string, [string, string]> = {
      no_show: ["delivery", "Client absent"],
      payment: ["payment", "Paiement non reçu"],
      behavior: ["behaviour", "Comportement inapproprié"],
      address: ["delivery", "Adresse incorrecte"],
      driver: ["delivery", "Retard important"],
      other: ["other", "Autre motif"],
    };
    const [category, subcategory] = map[issue] ?? ["other", "Autre motif"];
    const id = disputeActions.open({
      category,
      subcategory,
      description: description.trim(),
      orderRef: order.reference,
      orderId: order.id,
      hasGpsTrack: Boolean(order.driverId),
      openedByRole: "farmer",
      openedByName: "Coopérative Sow",
      againstRole: issue === "driver" ? "driver" : issue === "payment" ? "platform" : "restaurant",
      againstName:
        issue === "driver"
          ? "Livreur assigné"
          : issue === "payment"
            ? "Plateforme Diambar"
            : (r?.name ?? "Restaurant"),
      claimedAmount: order.total,
      priority: severity,
      channel: "app",
    });
    toast.success("Signalement enregistré · dossier de litige créé");
    navigate({ to: "/farmer/disputes/$disputeId", params: { disputeId: id } });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Signaler un problème"
        subtitle={`${order.reference} · ${r?.name}`}
        actions={
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/farmer/orders/$orderId", params: { orderId } })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        }
      />

      <div className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
          <Flag className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-amber-500">
              Support Diambar prendra contact sous 4h
            </div>
            <div className="text-muted-foreground mt-0.5">
              Commande : <b>{formatFCFA(order.total)}</b>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Type de problème</Label>
          <Select value={issue} onValueChange={setIssue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ISSUES.map((i) => (
                <SelectItem key={i.v} value={i.v}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Gravité</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["low", "medium", "high"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={`rounded-xl border p-3 text-sm font-medium capitalize transition ${severity === s ? (s === "high" ? "border-rose-500 bg-rose-500/10 text-rose-500" : s === "medium" ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-blue-500 bg-blue-500/10 text-blue-500") : "border-border"}`}
              >
                {s === "low" ? "Faible" : s === "medium" ? "Moyenne" : "Élevée"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Description détaillée</Label>
          <Textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez ce qui s'est passé, l'heure, les personnes impliquées…"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Pièces jointes (photos, captures)</Label>
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 transition">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Glissez vos fichiers ou cliquez (JPG, PNG, PDF · max 5 Mo)
            </span>
            <Input type="file" multiple className="hidden" />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/farmer/orders/$orderId", params: { orderId } })}
          >
            Annuler
          </Button>
          <Button onClick={submit}>Envoyer le signalement</Button>
        </div>
      </div>
    </div>
  );
}
