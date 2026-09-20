import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Car,
  Truck,
  Shield,
  Wrench,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Camera,
  Weight,
  Gauge,
  Disc,
  Battery,
  Droplet,
  Lightbulb,
  ArrowRight,
  Check,
  Plus,
  LifeBuoy,
  Package,
  TrendingUp,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/farmer/page-header";
import { driverProfile, VEHICLE_ISSUE_TYPE_LABEL, VEHICLE_CHANGE_REASON_LABEL } from "@/data/mocks";
import type { VehicleIssueType, VehicleIssueSeverity, VehicleChangeReason } from "@/data/mocks";
import {
  useDriverVehicle,
  useVehicleIssues,
  useMaintenanceHistory,
  useVehicleChangeRequests,
  useMissions,
  vehicleActions,
} from "@/data/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileDrop } from "@/components/disputes/file-drop";
import type { DisputeAttachment } from "@/data/disputes";
import { dayKey, referenceDay } from "@/lib/driver-day";
import { vehicleCompliance, VEHICLE_STATUS_LABEL } from "@/lib/vehicle-status";
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
  head: () => ({ meta: [{ title: "Mon véhicule · Livreur" }] }),
  component: DriverVehiclePage,
});

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

type DocStatus = "valid" | "expiring" | "expired";
function docStatus(days: number): DocStatus {
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
}
const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  valid: "Validé",
  expiring: "Expire bientôt",
  expired: "Expiré",
};
const DOC_STATUS_CLASS: Record<DocStatus, string> = {
  valid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  expiring: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  expired: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const CONDITION_ITEMS: {
  key: keyof ReturnType<typeof useDriverVehicle>["condition"];
  label: string;
  icon: typeof Disc;
}[] = [
  { key: "tires", label: "Pneus", icon: Disc },
  { key: "brakes", label: "Freins", icon: Disc },
  { key: "battery", label: "Batterie", icon: Battery },
  { key: "oil", label: "Huile moteur", icon: Droplet },
  { key: "lights", label: "Éclairage", icon: Lightbulb },
  { key: "body", label: "Carrosserie", icon: Car },
];

const ISSUE_TYPES = Object.keys(VEHICLE_ISSUE_TYPE_LABEL) as VehicleIssueType[];
const CHANGE_REASONS = Object.keys(VEHICLE_CHANGE_REASON_LABEL) as VehicleChangeReason[];

function DriverVehiclePage() {
  const v = useDriverVehicle();
  const issues = useVehicleIssues();
  const maintenance = useMaintenanceHistory();
  const changeRequests = useVehicleChangeRequests();
  const missions = useMissions();

  const insD = daysUntil(v.insuranceExpiry);
  const inspD = daysUntil(v.inspectionExpiry);
  const insStatus = docStatus(insD);
  const inspStatus = docStatus(inspD);
  const docs = driverProfile.documents;

  const validDocsCount =
    (insStatus !== "expired" ? 1 : 0) +
    (inspStatus !== "expired" ? 1 : 0) +
    (docs.permitVerified ? 1 : 0) +
    (docs.idVerified ? 1 : 0);
  const documentsPct = Math.round((validDocsCount / 4) * 100);

  const conditionEntries = Object.entries(v.condition) as [
    keyof typeof v.condition,
    "good" | "check",
  ][];
  const goodCount = conditionEntries.filter(([, s]) => s === "good").length;
  const mechanicalPct = Math.round((goodCount / conditionEntries.length) * 100);

  const activeMission = missions.find(
    (m) => m.driverId === "d1" && ["pickup", "loaded"].includes(m.status),
  );

  const { status: globalStatus } = vehicleCompliance(v, issues);
  const GLOBAL_STATUS = {
    ok: {
      label: VEHICLE_STATUS_LABEL.ok,
      cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    warning: {
      label: VEHICLE_STATUS_LABEL.warning,
      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    blocked: {
      label: VEHICLE_STATUS_LABEL.blocked,
      cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    },
  }[globalStatus];

  const availability =
    insStatus === "expired" || inspStatus === "expired"
      ? "Non conforme"
      : activeMission
        ? "En mission"
        : "Disponible";

  const { today } = useMemo(() => referenceDay(missions), [missions]);
  const monthPrefix = today.slice(0, 7);
  const myDelivered = missions.filter((m) => m.driverId === "d1" && m.status === "delivered");
  const myMonthMissions = myDelivered.filter((m) => dayKey(m.scheduledFor).startsWith(monthPrefix));
  const distanceThisMonth = myMonthMissions.reduce((s, m) => s + m.distanceKm, 0);
  const weightTotalTons = myDelivered.reduce((s, m) => s + m.weightKg, 0) / 1000;
  const avgLoadPct = myDelivered.length
    ? Math.round(
        (myDelivered.reduce((s, m) => s + m.weightKg / v.capacityKg, 0) / myDelivered.length) * 100,
      )
    : 0;

  const chartData = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const m of myDelivered) {
      const d = dayKey(m.scheduledFor);
      byDay.set(d, (byDay.get(d) ?? 0) + m.distanceKm);
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([day, km]) => ({ day: day.slice(5), km }));
  }, [myDelivered]);

  // --- Photo ---
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pickPhoto = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      vehicleActions.setPhoto(String(reader.result));
      toast.success("Photo du véhicule mise à jour");
    };
    reader.readAsDataURL(file);
  };

  // --- Signaler un problème ---
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueStep, setIssueStep] = useState(1);
  const [issueType, setIssueType] = useState<VehicleIssueType>("tires");
  const [issueSeverity, setIssueSeverity] = useState<VehicleIssueSeverity>("medium");
  const [issueDescription, setIssueDescription] = useState("");
  const [issuePhotos, setIssuePhotos] = useState<DisputeAttachment[]>([]);
  const [lastIssueRef, setLastIssueRef] = useState<string | null>(null);

  const resetIssueForm = () => {
    setIssueStep(1);
    setIssueType("tires");
    setIssueSeverity("medium");
    setIssueDescription("");
    setIssuePhotos([]);
    setLastIssueRef(null);
  };
  const submitIssue = () => {
    const issue = vehicleActions.reportIssue({
      type: issueType,
      severity: issueSeverity,
      description: issueDescription.trim(),
      photos: issuePhotos,
    });
    setLastIssueRef(issue.reference);
    setIssueStep(5);
  };

  // --- Maintenance ---
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [mileageInput, setMileageInput] = useState(String(v.mileageKm));
  const submitMaintenance = () => {
    if (!maintenanceDate) return;
    vehicleActions.scheduleMaintenance(maintenanceDate);
    toast.success(
      `Entretien programmé le ${new Date(maintenanceDate).toLocaleDateString("fr-FR")}`,
    );
    setMaintenanceOpen(false);
  };
  const submitMileage = () => {
    const val = Number(mileageInput.replace(/\D/g, ""));
    if (!val || val < v.mileageKm) {
      toast.error("Le kilométrage doit être supérieur au précédent");
      return;
    }
    vehicleActions.updateMileage(val);
    toast.success("Kilométrage mis à jour");
  };

  // --- Remplacer le véhicule ---
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeStep, setChangeStep] = useState(1);
  const [changeReason, setChangeReason] = useState<VehicleChangeReason>("new_vehicle");
  const [newVehicle, setNewVehicle] = useState({
    type: v.type,
    brand: "",
    model: "",
    year: String(new Date().getFullYear()),
    plate: "",
    capacityKg: "",
    mileageKm: "",
  });
  const [changeDocs, setChangeDocs] = useState<DisputeAttachment[]>([]);
  const [lastChangeRef, setLastChangeRef] = useState<string | null>(null);

  const resetChangeForm = () => {
    setChangeStep(1);
    setChangeReason("new_vehicle");
    setNewVehicle({
      type: v.type,
      brand: "",
      model: "",
      year: String(new Date().getFullYear()),
      plate: "",
      capacityKg: "",
      mileageKm: "",
    });
    setChangeDocs([]);
    setLastChangeRef(null);
  };
  const submitChangeRequest = () => {
    const req = vehicleActions.requestChange({
      reason: changeReason,
      newVehicle: {
        type: newVehicle.type,
        brand: newVehicle.brand.trim(),
        model: newVehicle.model.trim(),
        year: Number(newVehicle.year) || v.year,
        plate: newVehicle.plate.trim(),
        capacityKg: Number(newVehicle.capacityKg) || 0,
        mileageKm: Number(newVehicle.mileageKm) || 0,
      },
      docs: changeDocs,
    });
    setLastChangeRef(req.reference);
    setChangeStep(4);
  };

  const pendingChangeRequest = changeRequests.find((r) => r.status === "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon véhicule"
        subtitle="Gérez votre véhicule, ses documents, son entretien et son aptitude aux missions."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2">
              <LifeBuoy className="h-4 w-4" />
              Contacter le support
            </Button>
            <Button
              className="gap-2"
              onClick={() => {
                resetChangeForm();
                setChangeOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Ajouter / remplacer un véhicule
            </Button>
          </div>
        }
      />

      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${GLOBAL_STATUS.cls}`}
      >
        <span className="h-2 w-2 rounded-full bg-current" />
        {GLOBAL_STATUS.label}
      </span>

      {pendingChangeRequest && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            Votre demande {pendingChangeRequest.reference} (
            {VEHICLE_CHANGE_REASON_LABEL[pendingChangeRequest.reason]}) est en cours de
            vérification.
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Shield} label="État du véhicule" value={GLOBAL_STATUS.label} />
        <KpiCard icon={CheckCircle2} label="Documents" value={`${validDocsCount} / 4 validés`} />
        <KpiCard
          icon={Gauge}
          label="Kilométrage"
          value={`${v.mileageKm.toLocaleString("fr-FR")} km`}
        />
        <KpiCard
          icon={Calendar}
          label="Prochain entretien"
          value={
            v.nextMaintenanceAt
              ? new Date(v.nextMaintenanceAt).toLocaleDateString("fr-FR")
              : "Non planifié"
          }
          hint={v.nextMaintenanceAt ? `Dans ${daysUntil(v.nextMaintenanceAt)} jours` : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="relative">
              <img src={v.photo} alt="" className="w-full h-56 object-cover" />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
              />
              <Button
                size="sm"
                variant="outline"
                className="absolute bottom-3 right-3 gap-2 bg-background/90"
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5" />
                Changer la photo
              </Button>
            </div>
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
                <Stat
                  icon={Wrench}
                  label="Missions réalisées"
                  value={String(driverProfile.totalMissions)}
                />
              </div>

              <div className="mt-5 space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Aptitude aux missions
                </h4>
                <AptitudeBar label="Capacité véhicule" pct={100} suffix={`${v.capacityKg} kg`} />
                <AptitudeBar label="Documents" pct={documentsPct} suffix={`${documentsPct} %`} />
                <AptitudeBar
                  label="État mécanique"
                  pct={mechanicalPct}
                  suffix={`${mechanicalPct} %`}
                />
                <div className="flex items-center justify-between text-sm pt-1">
                  <span className="text-muted-foreground">Disponibilité</span>
                  <span className="font-semibold">{availability}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Documents &amp; conformité
            </h3>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <DocCard label="Assurance" date={v.insuranceExpiry} status={insStatus} />
              <DocCard label="Contrôle technique" date={v.inspectionExpiry} status={inspStatus} />
              <DocCard
                label="Permis de conduire"
                date={null}
                status={docs.permitVerified ? "valid" : "expiring"}
              />
              <DocCard
                label="Pièce d'identité"
                date={null}
                status={docs.idVerified ? "valid" : "expiring"}
              />
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                Maintenance
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => setMaintenanceOpen(true)}
              >
                <Calendar className="h-3.5 w-3.5" />
                Planifier un entretien
              </Button>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Kilométrage actuel
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    inputMode="numeric"
                    value={mileageInput}
                    onChange={(e) => setMileageInput(e.target.value.replace(/\D/g, ""))}
                    className="h-8 w-32"
                  />
                  <Button size="sm" variant="outline" onClick={submitMileage}>
                    Mettre à jour
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Prochain entretien
                </div>
                <div className="mt-1 font-semibold">
                  {v.nextMaintenanceAt
                    ? new Date(v.nextMaintenanceAt).toLocaleDateString("fr-FR")
                    : "Non planifié"}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Historique des entretiens
              </h4>
              {maintenance.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun entretien enregistré.</p>
              ) : (
                maintenance.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{m.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(m.at).toLocaleDateString("fr-FR")} ·{" "}
                        {m.mileageKm.toLocaleString("fr-FR")} km
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      ✓ Terminée
                    </span>
                  </div>
                ))
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  const label = window.prompt("Type d'entretien (ex : Vidange, Freins, Pneus)");
                  if (label?.trim()) {
                    vehicleActions.logMaintenance(label.trim());
                    toast.success("Entretien ajouté à l'historique");
                  }
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter un entretien
              </Button>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                État du véhicule
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  resetIssueForm();
                  setIssueOpen(true);
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Signaler un problème
              </Button>
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-2.5">
              {CONDITION_ITEMS.map(({ key, label, icon: Icon }) => {
                const state = v.condition[key];
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 rounded-xl border border-border p-3"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm">{label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${state === "good" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
                    >
                      {state === "good" ? "Bon" : "À vérifier"}
                    </span>
                  </div>
                );
              })}
            </div>

            {issues.length > 0 && (
              <div className="mt-5 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Problèmes signalés
                </h4>
                {issues.map((i) => (
                  <div key={i.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold">{i.reference}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${i.status === "resolved" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
                      >
                        {i.status === "resolved"
                          ? "Résolu"
                          : i.status === "in_progress"
                            ? "En traitement"
                            : "Signalé"}
                      </span>
                    </div>
                    <div className="mt-1 text-sm">
                      {VEHICLE_ISSUE_TYPE_LABEL[i.type]} — {i.description}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Signalé le {new Date(i.at).toLocaleDateString("fr-FR")}
                    </div>
                    {i.status !== "resolved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7"
                        onClick={() => {
                          vehicleActions.resolveIssue(i.id);
                          toast.success("Problème marqué comme résolu");
                        }}
                      >
                        Marquer comme résolu
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Utilisation du véhicule
            </h3>
            <div className="mt-4 grid sm:grid-cols-3 gap-3">
              <Stat
                icon={Truck}
                label="Missions réalisées"
                value={String(driverProfile.totalMissions)}
              />
              <Stat
                icon={Truck}
                label="Distance parcourue"
                value={`${driverProfile.totalDistanceKm.toLocaleString("fr-FR")} km`}
              />
              <Stat
                icon={Truck}
                label="Distance ce mois"
                value={`${distanceThisMonth.toLocaleString("fr-FR")} km`}
              />
              <Stat
                icon={Package}
                label="Poids transporté"
                value={`${weightTotalTons.toFixed(1)} t`}
              />
              <Stat icon={Gauge} label="Taux de charge moyen" value={`${avgLoadPct} %`} />
            </div>
            {chartData.length > 0 && (
              <div className="mt-4" style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: number) => `${val} km`} />
                    <Bar dataKey="km" name="Distance" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
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

          <div className="glass rounded-2xl p-5 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Besoin d'aide ?
            </div>
            <p className="text-xs text-muted-foreground">
              Notre équipe support est disponible 7j/7.
            </p>
            <Button variant="outline" size="sm" className="w-full gap-2">
              <LifeBuoy className="h-3.5 w-3.5" />
              Contacter le support
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog : Signaler un problème */}
      <Dialog
        open={issueOpen}
        onOpenChange={(o) => {
          setIssueOpen(o);
          if (!o) resetIssueForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler un problème</DialogTitle>
            <DialogDescription>
              Décrivez le problème rencontré avec votre véhicule.
            </DialogDescription>
          </DialogHeader>

          {issueStep === 1 && (
            <div className="space-y-2">
              <Label>Type de problème</Label>
              <div className="grid grid-cols-2 gap-2">
                {ISSUE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setIssueType(t)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${issueType === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                  >
                    {VEHICLE_ISSUE_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {issueStep === 2 && (
            <div className="space-y-2">
              <Label>Gravité</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["low", "medium", "high"] as VehicleIssueSeverity[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setIssueSeverity(s)}
                    className={`rounded-xl border p-3 text-sm font-medium transition ${issueSeverity === s ? (s === "high" ? "border-rose-500 bg-rose-500/10 text-rose-500" : s === "medium" ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-blue-500 bg-blue-500/10 text-blue-500") : "border-border"}`}
                  >
                    {s === "low" ? "Faible" : s === "medium" ? "Moyenne" : "Critique"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {issueStep === 3 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Ex : bruit anormal au freinage, pneu usé..."
                  rows={4}
                />
              </div>
              <FileDrop
                value={issuePhotos}
                onChange={setIssuePhotos}
                by={driverProfile.name}
                kind="photo"
                label="Photos"
                max={4}
              />
            </div>
          )}

          {issueStep === 5 && lastIssueRef && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                Problème enregistré
              </div>
              <p className="mt-1 text-muted-foreground">
                Votre problème a été enregistré sous <b>{lastIssueRef}</b>.
              </p>
            </div>
          )}

          <DialogFooter>
            {issueStep < 4 && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    issueStep === 1 ? setIssueOpen(false) : setIssueStep((s) => s - 1)
                  }
                >
                  {issueStep === 1 ? "Annuler" : "Retour"}
                </Button>
                {issueStep < 3 ? (
                  <Button onClick={() => setIssueStep((s) => s + 1)} className="gap-2">
                    Suivant <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={submitIssue}
                    disabled={!issueDescription.trim()}
                    className="gap-2"
                  >
                    Envoyer
                  </Button>
                )}
              </>
            )}
            {issueStep === 5 && <Button onClick={() => setIssueOpen(false)}>Fermer</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : Planifier un entretien */}
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

      {/* Dialog : Remplacer / ajouter un véhicule */}
      <Dialog
        open={changeOpen}
        onOpenChange={(o) => {
          setChangeOpen(o);
          if (!o) resetChangeForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter / remplacer un véhicule</DialogTitle>
            <DialogDescription>
              Votre demande sera examinée par l'équipe Diambar Agro. Vous recevrez une notification
              une fois la validation effectuée.
            </DialogDescription>
          </DialogHeader>

          {changeStep === 1 && (
            <div className="space-y-2">
              <Label>Pourquoi souhaitez-vous changer ?</Label>
              <div className="space-y-1.5">
                {CHANGE_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setChangeReason(r)}
                    className={`w-full text-left rounded-xl border px-3 py-2 text-sm font-medium transition ${changeReason === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                  >
                    {VEHICLE_CHANGE_REASON_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {changeStep === 2 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={newVehicle.type}
                  onValueChange={(val) =>
                    setNewVehicle((f) => ({ ...f, type: val as typeof f.type }))
                  }
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
                  <Label>Marque</Label>
                  <Input
                    value={newVehicle.brand}
                    onChange={(e) => setNewVehicle((f) => ({ ...f, brand: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Modèle</Label>
                  <Input
                    value={newVehicle.model}
                    onChange={(e) => setNewVehicle((f) => ({ ...f, model: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Année</Label>
                  <Input
                    inputMode="numeric"
                    value={newVehicle.year}
                    onChange={(e) =>
                      setNewVehicle((f) => ({ ...f, year: e.target.value.replace(/\D/g, "") }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Immatriculation</Label>
                  <Input
                    value={newVehicle.plate}
                    onChange={(e) => setNewVehicle((f) => ({ ...f, plate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Capacité (kg)</Label>
                  <Input
                    inputMode="numeric"
                    value={newVehicle.capacityKg}
                    onChange={(e) =>
                      setNewVehicle((f) => ({
                        ...f,
                        capacityKg: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kilométrage</Label>
                  <Input
                    inputMode="numeric"
                    value={newVehicle.mileageKm}
                    onChange={(e) =>
                      setNewVehicle((f) => ({ ...f, mileageKm: e.target.value.replace(/\D/g, "") }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {changeStep === 3 && (
            <FileDrop
              value={changeDocs}
              onChange={setChangeDocs}
              by={driverProfile.name}
              kind="other"
              label="Documents (assurance, carte grise, contrôle technique, photos)"
              max={6}
            />
          )}

          {changeStep === 4 && lastChangeRef && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <div className="font-semibold text-amber-600 dark:text-amber-400">
                Votre demande {lastChangeRef} est en cours de vérification.
              </div>
              <p className="mt-1 text-muted-foreground">
                🟠 En attente de validation — votre véhicule actuel reste actif pour vos missions
                jusqu'à la décision de l'équipe support.
              </p>
            </div>
          )}

          <DialogFooter>
            {changeStep < 4 && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    changeStep === 1 ? setChangeOpen(false) : setChangeStep((s) => s - 1)
                  }
                >
                  {changeStep === 1 ? "Annuler" : "Retour"}
                </Button>
                {changeStep < 3 ? (
                  <Button onClick={() => setChangeStep((s) => s + 1)} className="gap-2">
                    Suivant <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={submitChangeRequest}
                    disabled={!newVehicle.brand.trim() || !newVehicle.plate.trim()}
                    className="gap-2"
                  >
                    Envoyer la demande
                  </Button>
                )}
              </>
            )}
            {changeStep === 4 && <Button onClick={() => setChangeOpen(false)}>Fermer</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Car;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="font-display text-xl font-bold mt-1">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
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

function AptitudeBar({ label, pct, suffix }: { label: string; pct: number; suffix: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{suffix}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${pct >= 90 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function DocCard({
  label,
  date,
  status,
}: {
  label: string;
  date: string | null;
  status: DocStatus;
}) {
  const Icon = status === "valid" ? CheckCircle2 : AlertTriangle;
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${DOC_STATUS_CLASS[status]}`}
        >
          <Icon className="h-3 w-3" />
          {DOC_STATUS_LABEL[status]}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {date ? `Expire le ${new Date(date).toLocaleDateString("fr-FR")}` : "Validité longue durée"}
      </div>
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
