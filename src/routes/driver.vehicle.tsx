import { createFileRoute } from "@tanstack/react-router";
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
import { driverVehicle, driverProfile } from "@/data/mocks";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/driver/vehicle")({
  head: () => ({ meta: [{ title: "Véhicule · Livreur" }] }),
  component: DriverVehiclePage,
});

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function DriverVehiclePage() {
  const v = driverVehicle;
  const insD = daysUntil(v.insuranceExpiry);
  const inspD = daysUntil(v.inspectionExpiry);
  const docs = driverProfile.documents;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon véhicule"
        subtitle="Informations, documents et maintenance"
        actions={
          <Button variant="outline" className="gap-2">
            <Camera className="h-4 w-4" />
            Changer la photo
          </Button>
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
          <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Actions
            </div>
            <div className="mt-3 space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Wrench className="h-4 w-4" />
                Signaler un problème
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Calendar className="h-4 w-4" />
                Planifier un entretien
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Car className="h-4 w-4" />
                Changer de véhicule
              </Button>
            </div>
          </div>
        </div>
      </div>
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
