import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useDriverSettings, driverSettingsActions } from "@/data/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/driver/settings/payments")({
  head: () => ({ meta: [{ title: "Paiements · Paramètres livreur" }] }),
  component: PaymentSettings,
});

const PAYOUT_FREQUENCIES = [
  ["daily", "Quotidien", "Les gains éligibles sont transférés chaque jour."],
  ["weekly", "Hebdomadaire", "Les gains sont regroupés et transférés chaque semaine."],
  ["manual", "Manuel", "Vous choisissez quand demander un retrait."],
] as const;

function PaymentSettings() {
  const settings = useDriverSettings();
  const [methodOpen, setMethodOpen] = useState(false);
  const [methodType, setMethodType] = useState<"Wave" | "Orange Money" | "Free Money" | "Espèces">(
    "Wave",
  );
  const [methodLabel, setMethodLabel] = useState("");

  const submitMethod = () => {
    if (!methodLabel.trim()) return;
    driverSettingsActions.addPaymentMethod(methodType, methodLabel.trim());
    toast.success(`Méthode ${methodType} ajoutée`);
    setMethodOpen(false);
    setMethodLabel("");
    setMethodType("Wave");
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Méthodes de paiement
        </div>
        <div className="mt-3 space-y-2">
          {settings.paymentMethods.map((m) => (
            <div
              key={m.id}
              className={`flex items-center gap-3 rounded-xl border p-3 ${m.active ? "border-primary/40 bg-primary/5" : "border-border"}`}
            >
              <div className="h-10 w-10 rounded-lg bg-primary/20 text-primary grid place-items-center font-bold">
                {m.method[0]}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{m.method}</div>
                <div className="text-xs text-muted-foreground">{m.label}</div>
              </div>
              {m.active ? (
                <span className="text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5">
                  Principal
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    driverSettingsActions.setActivePaymentMethod(m.id);
                    toast.success(`${m.method} définie comme méthode principale`);
                  }}
                >
                  Définir comme principal
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button variant="outline" className="mt-3 w-full gap-2" onClick={() => setMethodOpen(true)}>
          <Plus className="h-4 w-4" />
          Ajouter un moyen de paiement
        </Button>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Fréquence des paiements
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PAYOUT_FREQUENCIES.map(([v, label, desc]) => (
            <button
              key={v}
              onClick={() => {
                driverSettingsActions.setPayoutFrequency(v);
                toast.success(`Fréquence de virement : ${label}`);
              }}
              className={`rounded-xl border p-3 text-left transition ${v === settings.payoutFrequency ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
            >
              <div className="text-sm font-semibold">{label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un moyen de paiement</DialogTitle>
            <DialogDescription>
              Il sera utilisé pour vos prochains virements et retraits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Opérateur</Label>
              <Select
                value={methodType}
                onValueChange={(v) => setMethodType(v as typeof methodType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Wave">Wave</SelectItem>
                  <SelectItem value="Orange Money">Orange Money</SelectItem>
                  <SelectItem value="Free Money">Free Money</SelectItem>
                  <SelectItem value="Espèces">Espèces</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Numéro / identifiant</Label>
              <Input
                value={methodLabel}
                onChange={(e) => setMethodLabel(e.target.value)}
                placeholder="+221 77 000 00 00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMethodOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitMethod} disabled={!methodLabel.trim()}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
