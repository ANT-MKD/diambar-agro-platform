import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Car,
  Shield,
  Wrench,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Camera,
  Weight,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { driverProfile } from "@/data/mocks";
import { useDriverVehicle, useVehicleIssues, vehicleActions } from "@/data/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/driver/vehicle")({
  head: () => ({ meta: [{ title: "Véhicule · Livreur" }] }),
  component: DriverVehiclePage,
});

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function DriverVehiclePage() {
  const v = useDriverVehicle();
  const issues = useVehicleIssues();
  const insD = daysUntil(v.insuranceExpiry);
  const inspD = daysUntil(v.inspectionExpiry);
  const docs = driverProfile.documents;

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueText, setIssueText] = useState("");
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [changeOpen, setChangeOpen] = useState(false);
  const [form, setForm] = useState({
    type: v.type,
    brand: v.brand,
    model: v.model,
    plate: v.plate,
    capacityKg: String(v.capacityKg),
  });

  const pickPhoto = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      vehicleActions.setPhoto(String(reader.result));
      toast.success("Photo du véhicule mise à jour");
    };
    reader.readAsDataURL(file);
  };

  const submitIssue = () => {
    if (!issueText.trim()) return;
    vehicleActions.reportIssue(issueText.trim());
    toast.success("Problème signalé · notre équipe vous recontacte sous 24h");
    setIssueText("");
    setIssueOpen(false);
  };

  const submitMaintenance = () => {
    if (!maintenanceDate) return;
    vehicleActions.scheduleMaintenance(maintenanceDate);
    toast.success(
      `Entretien programmé le ${new Date(maintenanceDate).toLocaleDateString("fr-FR")}`,
    );
    setMaintenanceOpen(false);
  };

  const submitChange = () => {
    vehicleActions.update({
      type: form.type,
      brand: form.brand,
      model: form.model,
      plate: form.plate,
      capacityKg: Number(form.capacityKg) || v.capacityKg,
    });
    toast.success("Véhicule mis à jour");
    setChangeOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon véhicule"
        subtitle="Informations, documents et maintenance"
        actions={
          <>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => photoInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Changer la photo
            </Button>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl overflow-hidden">
            <img src={v.photo} alt="" className="w-full h-56 object-cover" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-2xl font-bold">
                    {v.brand} {v.model}{" "}
                    <span className="text-muted-foreground font-normal text-lg">· {v.year}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {v.type} · Couleur {v.color}
                  </div>
                </div>
                <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold font-mono">
                  {v.plate}
                </span>
              </div>
              <div className="mt-5 grid sm:grid-cols-3 gap-3">
                <Stat icon={Weight} label="Capacité" value={`${v.capacityKg} kg`} />
                <Stat icon={Car} label="Type" value={v.type} />
                <Stat icon={Wrench} label="Année" value={String(v.year)} />
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Documents et échéances
            </h3>
            <div className="mt-4 space-y-3">
              <DocRow
                label="Assurance"
                date={v.insuranceExpiry}
                days={insD}
                verified={docs.insuranceVerified}
              />
              <DocRow label="Contrôle technique" date={v.inspectionExpiry} days={inspD} verified />
              <DocRow
                label="Permis de conduire"
                date="—"
                days={365}
                verified={docs.permitVerified}
              />
              <DocRow label="Pièce d'identité" date="—" days={365} verified={docs.idVerified} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Statistiques
            </div>
            <div className="mt-2 space-y-3">
              <MiniLine label="Missions total" value={String(driverProfile.totalMissions)} />
              <MiniLine
                label="Distance total"
                value={`${driverProfile.totalDistanceKm.toLocaleString("fr-FR")} km`}
              />
              <MiniLine label="Note moyenne" value={`★ ${driverProfile.rating}`} />
            </div>
          </div>
          {v.nextMaintenanceAt && (
            <div className="glass rounded-2xl p-5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Prochain entretien
              </div>
              <div className="mt-1 font-semibold">
                {new Date(v.nextMaintenanceAt).toLocaleDateString("fr-FR")}
              </div>
            </div>
          )}

          {issues.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Problèmes signalés
              </div>
              <div className="mt-2 space-y-2">
                {issues.slice(0, 3).map((i) => (
                  <div key={i.id} className="rounded-lg border border-border p-2.5 text-xs">
                    <div className="font-medium">{i.description}</div>
                    <div className="text-muted-foreground mt-0.5">
                      {new Date(i.at).toLocaleDateString("fr-FR")} · {i.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Actions
            </div>
            <div className="mt-3 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setIssueOpen(true)}
              >
                <Wrench className="h-4 w-4" />
                Signaler un problème
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setMaintenanceOpen(true)}
              >
                <Calendar className="h-4 w-4" />
                Planifier un entretien
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setChangeOpen(true)}
              >
                <Car className="h-4 w-4" />
                Changer de véhicule
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler un problème</DialogTitle>
            <DialogDescription>
              Décrivez le problème rencontré avec votre véhicule.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={issueText}
            onChange={(e) => setIssueText(e.target.value)}
            placeholder="Ex : bruit anormal au freinage, pneu usé..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitIssue} disabled={!issueText.trim()}>
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planifier un entretien</DialogTitle>
            <DialogDescription>
              Choisissez une date pour votre prochain entretien.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="maintenance-date">Date</Label>
            <Input
              id="maintenance-date"
              type="date"
              value={maintenanceDate}
              onChange={(e) => setMaintenanceDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitMaintenance} disabled={!maintenanceDate}>
              Programmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer de véhicule</DialogTitle>
            <DialogDescription>Mettez à jour les informations de votre véhicule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(val) => setForm((f) => ({ ...f, type: val as typeof f.type }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Moto">Moto</SelectItem>
                  <SelectItem value="Camionnette">Camionnette</SelectItem>
                  <SelectItem value="Camion">Camion</SelectItem>
                  <SelectItem value="Tricycle">Tricycle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brand">Marque</Label>
                <Input
                  id="brand"
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">Modèle</Label>
                <Input
                  id="model"
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="plate">Immatriculation</Label>
                <Input
                  id="plate"
                  value={form.plate}
                  onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="capacity">Capacité (kg)</Label>
                <Input
                  id="capacity"
                  inputMode="numeric"
                  value={form.capacityKg}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, capacityKg: e.target.value.replace(/\D/g, "") }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitChange}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Car; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function DocRow({
  label,
  date,
  days,
  verified,
}: {
  label: string;
  date: string;
  days: number;
  verified: boolean;
}) {
  const critical = days < 30 && date !== "—";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div
        className={`grid h-9 w-9 place-items-center rounded-lg ${verified ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
      >
        {verified ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">
          {date !== "—"
            ? `Expire le ${new Date(date).toLocaleDateString("fr-FR")}`
            : "Validité longue durée"}
        </div>
      </div>
      {date !== "—" && (
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${critical ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-muted text-muted-foreground"}`}
        >
          {days > 0 ? `${days}j restants` : "Expiré"}
        </span>
      )}
    </div>
  );
}

function MiniLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
