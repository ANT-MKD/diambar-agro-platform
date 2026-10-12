import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, Route as RouteIcon, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { market, type Result } from "@/data/market-remote";
import { useMarketMode } from "@/data/market-mode";
import {
  deliveryFee,
  driverNetCost,
  type DeliveryPricing,
  type FarmerPlaceRow,
  type PlaceRow,
} from "@/lib/delivery-pricing";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/admin/delivery-pricing")({
  head: () => ({ meta: [{ title: "Tarifs de livraison — Admin Diambar" }] }),
  component: DeliveryPricingPage,
});

// Frais de livraison selon la distance producteur → restaurant : barème par
// tranches, positions des quartiers, corrections par producteur. La même
// distance sert à la paie du livreur.

type Settings = { pricing: DeliveryPricing; places: PlaceRow[]; farmers: FarmerPlaceRow[] };

const notify = (res: Result, success: string) => {
  if (res.ok) toast.success(success);
  else toast.error(res.message);
  return res.ok;
};

/** « 14,69 » ou « 14.69 » ; null si vide ; NaN si illisible. */
const coord = (s: string) => (s.trim() ? Number(s.trim().replace(",", ".")) : null);

/** Latitude et longitude saisies : les deux, ou aucune (null). */
function readCoords(lat: string, lng: string): { lat: number; lng: number } | null | "invalid" {
  const a = coord(lat);
  const b = coord(lng);
  if (a == null && b == null) return null;
  if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return "invalid";
  return { lat: a, lng: b };
}

function DeliveryPricingPage() {
  const { remote } = useMarketMode();
  const [data, setData] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await market.deliverySettings();
    if (res.ok) {
      setData(res);
      setError(null);
    } else setError(res.message);
  }, []);
  useEffect(() => {
    if (remote) void load();
  }, [remote, load]);

  if (!remote) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tarifs de livraison" />
        <EmptyState
          icon={Truck}
          title="Disponible avec la base de données"
          description="Les frais selon la distance se règlent ici une fois l'application reliée à sa base."
        />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarifs de livraison"
        subtitle="Frais payés par le restaurant selon la distance du producteur. La même distance sert à la paie du livreur."
      />
      {error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}
      {!data ? (
        !error && <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <PricingCard initial={data.pricing} onSaved={load} />
          <PlacesCard places={data.places} onSaved={load} />
          <FarmersCard farmers={data.farmers} onSaved={load} />
        </>
      )}
    </div>
  );
}

// --- Barème -----------------------------------------------------------------------

function PricingCard({ initial, onSaved }: { initial: DeliveryPricing; onSaved: () => void }) {
  const [p, setP] = useState(initial);
  const [saving, setSaving] = useState(false);
  const setBracket = (i: number, patch: Partial<DeliveryPricing["brackets"][number]>) =>
    setP({ ...p, brackets: p.brackets.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const save = async () => {
    setSaving(true);
    const res = await market.saveDeliveryPricing(p);
    setSaving(false);
    if (notify(res, "Tarifs enregistrés : ils s'appliquent aux prochaines commandes")) onSaved();
  };
  const examples: [number, number][] = [
    [3, 10],
    [10, 10],
    [24, 10],
    [74, 10],
    [74, 60],
  ];
  return (
    <div className="glass space-y-4 rounded-2xl p-5" data-testid="pricing-card">
      <h3 className="flex items-center gap-2 font-semibold">
        <RouteIcon className="h-4 w-4 text-primary" /> Barème par distance
      </h3>
      <div className="space-y-2">
        {p.brackets.map((b, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 text-muted-foreground">
              {i === 0 ? "0" : p.brackets[i - 1].upToKm} km jusqu'à
            </span>
            <Input
              type="number"
              className="w-24"
              value={b.upToKm}
              onChange={(e) => setBracket(i, { upToKm: Number(e.target.value) })}
              aria-label={`Fin de la tranche ${i + 1} (km)`}
            />
            <span className="text-muted-foreground">km :</span>
            <Input
              type="number"
              className="w-32"
              value={b.fee}
              onChange={(e) => setBracket(i, { fee: Number(e.target.value) })}
              aria-label={`Frais de la tranche ${i + 1} (F CFA)`}
            />
            <span className="text-muted-foreground">F CFA</span>
            {p.brackets.length > 1 && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Supprimer la tranche ${i + 1}`}
                onClick={() => setP({ ...p, brackets: p.brackets.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const last = p.brackets[p.brackets.length - 1];
            setP({
              ...p,
              brackets: [...p.brackets, { upToKm: last.upToKm + 20, fee: last.fee + 2000 }],
            });
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Ajouter une tranche
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberInput
          label="Au-delà : par km (F CFA)"
          value={p.beyondPerKm}
          onChange={(v) => setP({ ...p, beyondPerKm: v })}
        />
        <NumberInput
          label="Supplément par kg (F CFA)"
          value={p.perKgOver}
          onChange={(v) => setP({ ...p, perKgOver: v })}
        />
        <NumberInput
          label="Au-delà de (kg)"
          value={p.freeKg}
          onChange={(v) => setP({ ...p, freeKg: v })}
        />
        <NumberInput
          label="Coefficient route"
          step={0.05}
          value={p.roadFactor}
          onChange={(v) => setP({ ...p, roadFactor: v })}
          hint="Ligne droite × ce nombre ≈ distance par la route"
        />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={p.floorToCost} onCheckedChange={(v) => setP({ ...p, floorToCost: v })} />
        Jamais moins que ce que coûte la course (garde-fou)
      </label>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="pricing-examples">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Exemple</th>
              <th className="py-2 pr-3 text-right">Restaurant paie</th>
              <th className="py-2 pr-3 text-right">Coût de la course</th>
              <th className="py-2 text-right">Diambar garde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {examples.map(([km, kg]) => {
              const q = deliveryFee(km, kg, p);
              const cost = driverNetCost(km, kg);
              return (
                <tr key={`${km}-${kg}`}>
                  <td className="py-2 pr-3">
                    {km} km · {kg} kg
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {formatFCFA(q.fee)}
                    {q.floored ? " (relevé)" : ""}
                  </td>
                  <td className="py-2 pr-3 text-right">{formatFCFA(cost)}</td>
                  <td
                    className={`py-2 text-right font-semibold ${q.fee - cost < 0 ? "text-rose-600" : "text-emerald-600"}`}
                  >
                    {formatFCFA(q.fee - cost)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? "Enregistrement…" : "Enregistrer le barème"}
      </Button>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  hint,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  step?: number;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

// --- Positions des villes et quartiers ----------------------------------------------

const SOURCE: Record<string, string> = {
  admin: "réglée par l'admin",
  reference: "position de référence",
};

function PlacesCard({ places, onSaved }: { places: PlaceRow[]; onSaved: () => void }) {
  const shown = [...places]
    .filter((p) => p.active || p.kind === "zone")
    .sort((a, b) => Number(!!a.source) - Number(!!b.source) || a.name.localeCompare(b.name));
  const missing = shown.filter((p) => !p.source && p.active);
  return (
    <div className="glass space-y-3 rounded-2xl p-5" data-testid="places-card">
      <h3 className="flex items-center gap-2 font-semibold">
        <MapPin className="h-4 w-4 text-primary" /> Positions des villes et quartiers
      </h3>
      <p className="text-sm text-muted-foreground">
        Positions approximatives, à un kilomètre près. Corrigez-les au besoin (latitude et
        longitude, par exemple relevées sur une carte).
        {missing.length > 0 && (
          <span className="font-semibold text-rose-600">
            {" "}
            {missing.length} lieu(x) sans position : les commandes vers ces quartiers sont bloquées.
          </span>
        )}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Lieu</th>
              <th className="py-2 pr-3">Position</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((p) => (
              <PlaceLine key={p.id} place={p} onSaved={onSaved} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlaceLine({ place, onSaved }: { place: PlaceRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [lat, setLat] = useState(place.lat?.toString() ?? "");
  const [lng, setLng] = useState(place.lng?.toString() ?? "");
  const save = async (clear = false) => {
    const coords = clear ? null : readCoords(lat, lng);
    if (coords === "invalid" || (!clear && coords === null)) {
      toast.error("Indiquez la latitude et la longitude (par exemple 14,6928 et -17,4467).");
      return;
    }
    const res = await market.savePlaceCoords(place.kind, place.id, coords);
    if (notify(res, "Position enregistrée")) {
      setEditing(false);
      onSaved();
    }
  };
  return (
    <tr>
      <td className="py-2 pr-3">
        <div className="font-medium">{place.name}</div>
        <div className="text-xs text-muted-foreground">
          {place.kind === "city" ? "Ville" : `Quartier · ${place.cityName}`}
          {!place.active && " · inactif"}
        </div>
      </td>
      <td className="py-2 pr-3">
        {editing ? (
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-28"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="14,6928"
              aria-label={`Latitude de ${place.name}`}
            />
            <Input
              className="w-28"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="-17,4467"
              aria-label={`Longitude de ${place.name}`}
            />
          </div>
        ) : place.source ? (
          <span>
            {place.lat?.toFixed(4)}, {place.lng?.toFixed(4)}
            <span className="block text-xs text-muted-foreground">{SOURCE[place.source]}</span>
          </span>
        ) : (
          <span className="font-semibold text-rose-600">Non localisé</span>
        )}
      </td>
      <td className="py-2 text-right">
        {editing ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Annuler
            </Button>
            <Button size="sm" onClick={() => void save()}>
              Enregistrer
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            {place.source === "admin" && (
              <Button size="sm" variant="ghost" onClick={() => void save(true)}>
                Position de référence
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Modifier
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

// --- Producteurs -----------------------------------------------------------------------

function FarmersCard({ farmers, onSaved }: { farmers: FarmerPlaceRow[]; onSaved: () => void }) {
  return (
    <div className="glass space-y-3 rounded-2xl p-5" data-testid="farmers-card">
      <h3 className="flex items-center gap-2 font-semibold">
        <Truck className="h-4 w-4 text-primary" /> Lieux de collecte des producteurs
      </h3>
      <p className="text-sm text-muted-foreground">
        Lieu détecté à partir de l'adresse ou du quartier du producteur. Ajoutez une correction («
        +3 km » pour une piste absente de la carte) ou sa position exacte.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Producteur</th>
              <th className="py-2 pr-3">Lieu détecté</th>
              <th className="py-2 pr-3">Correction (km)</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {farmers.map((f) => (
              <FarmerLine key={f.id} farmer={f} onSaved={onSaved} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FarmerLine({ farmer, onSaved }: { farmer: FarmerPlaceRow; onSaved: () => void }) {
  const [adjust, setAdjust] = useState(String(farmer.adjustKm));
  const [lat, setLat] = useState(farmer.lat?.toString() ?? "");
  const [lng, setLng] = useState(farmer.lng?.toString() ?? "");
  const save = async () => {
    const coords = readCoords(lat, lng);
    if (coords === "invalid") {
      toast.error("Indiquez la latitude et la longitude, ou laissez les deux vides.");
      return;
    }
    const res = await market.saveFarmerDelivery(
      farmer.id,
      Math.round(Number(adjust.replace(",", ".")) || 0),
      coords,
    );
    if (notify(res, "Lieu de collecte enregistré")) onSaved();
  };
  return (
    <tr>
      <td className="py-2 pr-3">
        <div className="font-medium">{farmer.farmName}</div>
        <div className="text-xs text-muted-foreground">{farmer.pickupAddress}</div>
      </td>
      <td className="py-2 pr-3">
        {farmer.origin ?? <span className="font-semibold text-rose-600">Non localisé</span>}
        <div className="mt-1 flex gap-1">
          <Input
            className="h-8 w-24 text-xs"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="Latitude"
            aria-label={`Latitude de ${farmer.farmName}`}
          />
          <Input
            className="h-8 w-24 text-xs"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="Longitude"
            aria-label={`Longitude de ${farmer.farmName}`}
          />
        </div>
      </td>
      <td className="py-2 pr-3">
        <Input
          type="number"
          className="w-24"
          value={adjust}
          onChange={(e) => setAdjust(e.target.value)}
          aria-label={`Correction de distance pour ${farmer.farmName}`}
        />
      </td>
      <td className="py-2 text-right">
        <Button size="sm" variant="outline" onClick={() => void save()}>
          Enregistrer
        </Button>
      </td>
    </tr>
  );
}
