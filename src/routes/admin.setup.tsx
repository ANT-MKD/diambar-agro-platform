import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useId, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Rocket,
  Trash2,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatFCFA } from "@/lib/format";
import { formatSenegalPhone } from "@/lib/auth/helpers";
import {
  createStaffInviteFn,
  getSetupFn,
  saveSetupStepFn,
  setRegistrationsOpenFn,
  type SaveStepInput,
} from "@/lib/platform/setup";
import {
  DAKAR_ZONES,
  SETUP_STEPS,
  setupProgress,
  type CommissionTierSetting,
  type SetupSnapshot,
  type SetupStepKey,
} from "@/lib/platform/setup-model";

export const Route = createFileRoute("/admin/setup")({
  head: () => ({
    meta: [
      { title: "Configuration de la plateforme — Administration Diambar Agro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: ({ context }) => {
    // Réservé au super administrateur (vérifié aussi par le serveur).
    if (context.user.adminRole !== "Super Administrateur") {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
  loader: () => getSetupFn(),
  component: SetupWizard,
});

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  hint,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  type?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        />
      )}
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  min?: number;
  max?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className={fieldClass}
        />
      )}
    </Field>
  );
}

type StepProps = {
  snapshot: SetupSnapshot;
  save: (input: SaveStepInput) => Promise<void>;
  saving: boolean;
};

function SaveButton({
  saving,
  label = "Enregistrer et continuer",
}: {
  saving: boolean;
  label?: string;
}) {
  return (
    <Button type="submit" disabled={saving} className="gap-2">
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Check className="h-4 w-4" aria-hidden />
      )}
      {label}
    </Button>
  );
}

// --- 1. Sécurité ----------------------------------------------------------------

function SecurityStep({ snapshot, save, saving }: StepProps) {
  const [twoFa, setTwoFa] = useState(snapshot.me.twoFaEnabled);
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ step: "security", data: { twoFaEnabled: twoFa } });
      }}
    >
      <p className="text-sm text-muted-foreground">
        Vous êtes connecté avec <strong className="text-foreground">{snapshot.me.email}</strong>, le
        compte qui a tous les droits. Gardez son mot de passe dans un gestionnaire de mots de passe
        et ne le partagez jamais : chaque membre de l'équipe aura son propre compte (étape Équipe).
      </p>
      <div className="flex items-start gap-3 rounded-xl border border-border p-4">
        <Switch
          id="two-fa"
          checked={twoFa}
          disabled={!snapshot.codeDeliveryAvailable}
          onCheckedChange={setTwoFa}
        />
        <div>
          <label htmlFor="two-fa" className="text-sm font-medium">
            Double authentification à la connexion
          </label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {snapshot.codeDeliveryAvailable
              ? "Un code à 6 chiffres est demandé après le mot de passe."
              : "Activable dès que l'envoi des codes par SMS ou email sera branché (lot 1.2) : sans cela, vous ne pourriez plus vous connecter."}
          </p>
        </div>
      </div>
      <SaveButton saving={saving} />
    </form>
  );
}

// --- 2. Entreprise ---------------------------------------------------------------

function CompanyStep({ snapshot, save, saving }: StepProps) {
  const c = snapshot.company;
  const [form, setForm] = useState({
    legalName: c?.legalName ?? "",
    tradeName: c?.tradeName ?? "Diambar Agro",
    ninea: c?.ninea ?? "",
    rccm: c?.rccm ?? "",
    address: c?.address ?? "",
    email: c?.email ?? "",
    phone: c?.phone ? formatSenegalPhone(c.phone) : "",
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ step: "company", data: form });
      }}
    >
      <p className="text-sm text-muted-foreground">
        Ces informations apparaissent sur les factures et dans les mentions légales. Le NINEA et le
        RCCM peuvent être ajoutés plus tard si la structure est en cours de création.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nom légal de la structure"
          value={form.legalName}
          onChange={set("legalName")}
        />
        <TextField label="Nom commercial" value={form.tradeName} onChange={set("tradeName")} />
        <TextField
          label="NINEA (facultatif pour l'instant)"
          value={form.ninea}
          onChange={set("ninea")}
        />
        <TextField
          label="RCCM (facultatif pour l'instant)"
          value={form.rccm}
          onChange={set("rccm")}
        />
      </div>
      <TextField label="Adresse du siège" value={form.address} onChange={set("address")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Email de contact"
          type="email"
          inputMode="email"
          value={form.email}
          onChange={set("email")}
        />
        <TextField
          label="Téléphone de contact"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={set("phone")}
          hint="9 chiffres, sans l'indicatif."
        />
      </div>
      <SaveButton saving={saving} />
    </form>
  );
}

// --- 3. Zone pilote --------------------------------------------------------------

function ZoneStep({ snapshot, save, saving }: StepProps) {
  const z = snapshot.zone;
  const [city, setCity] = useState(z?.city ?? "Dakar");
  const [baseFee, setBaseFee] = useState(z?.baseFee ?? 1000);
  const [perKmFee, setPerKmFee] = useState(z?.perKmFee ?? 120);
  const [zones, setZones] = useState<string[]>(z?.zones.length ? z.zones : [...DAKAR_ZONES]);
  const [draft, setDraft] = useState("");
  const addZone = () => {
    const name = draft.trim();
    if (name.length < 2) return;
    if (!zones.some((x) => x.toLowerCase() === name.toLowerCase())) setZones([...zones, name]);
    setDraft("");
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ step: "zone", data: { city, baseFee, perKmFee, zones } });
      }}
    >
      <p className="text-sm text-muted-foreground">
        Pendant le pilote, une seule ville est ouverte : les autres sont désactivées. Les quartiers
        listés ici sont proposés aux livreurs et utilisés pour les livraisons. Un quartier retiré
        est désactivé, jamais effacé.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Ville pilote" value={city} onChange={setCity} />
        <NumberField label="Frais de base (F CFA)" value={baseFee} onChange={setBaseFee} min={0} />
        <NumberField label="Frais par km (F CFA)" value={perKmFee} onChange={setPerKmFee} min={0} />
      </div>
      <div>
        <div className="text-sm font-medium">Quartiers livrés ({zones.length})</div>
        <ul className="mt-2 flex flex-wrap gap-2">
          {zones.map((name) => (
            <li
              key={name}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-3 pr-1 py-1 text-sm"
            >
              {name}
              <button
                type="button"
                onClick={() => setZones(zones.filter((x) => x !== name))}
                className="grid h-6 w-6 place-items-center rounded-full hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Retirer ${name}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addZone();
              }
            }}
            placeholder="Ajouter un quartier"
            aria-label="Nom du quartier à ajouter"
            className={`${fieldClass} mt-0`}
          />
          <Button type="button" variant="outline" onClick={addZone} className="gap-1 shrink-0">
            <Plus className="h-4 w-4" aria-hidden /> Ajouter
          </Button>
        </div>
      </div>
      <SaveButton saving={saving} />
    </form>
  );
}

// --- 4. Règles de commande -------------------------------------------------------

function OrdersStep({ snapshot, save, saving }: StepProps) {
  const [o, setO] = useState(snapshot.orders);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ step: "orders", data: o });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Heure limite de commande"
          hint="Commande passée avant cette heure : livrée le lendemain matin."
        >
          {(id) => (
            <select
              id={id}
              value={o.cutoffHour}
              onChange={(e) => setO({ ...o, cutoffHour: Number(e.target.value) })}
              className={fieldClass}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h} h
                </option>
              ))}
            </select>
          )}
        </Field>
        <NumberField
          label="Minimum par producteur (F CFA)"
          value={o.minOrderPerProducer}
          onChange={(v) => setO({ ...o, minOrderPerProducer: v })}
          min={0}
          hint="Montant de marchandise minimum commandé à un même producteur."
        />
        <NumberField
          label="Délai de réclamation (heures)"
          value={o.receptionWindowHours}
          onChange={(v) => setO({ ...o, receptionWindowHours: v })}
          min={1}
          max={168}
          hint="Temps laissé au restaurant pour signaler un produit abîmé ou manquant."
        />
      </div>
      <SaveButton saving={saving} />
    </form>
  );
}

// --- 5. Commission et TVA --------------------------------------------------------

function MoneyStep({ snapshot, save, saving }: StepProps) {
  const [tiers, setTiers] = useState<CommissionTierSetting[]>(snapshot.money.tiers);
  const [tva, setTva] = useState(snapshot.money.tva);
  const update = (i: number, patch: Partial<CommissionTierSetting>) =>
    setTiers(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ step: "money", data: { tiers, tva } });
      }}
    >
      <p className="text-sm text-muted-foreground">
        Commission prélevée sur les ventes de chaque producteur, selon son volume du mois.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2 pr-2 font-medium">Palier</th>
              <th className="py-2 pr-2 font-medium">Taux (%)</th>
              <th className="py-2 pr-2 font-medium">À partir de (F CFA)</th>
              <th className="py-2 pr-2 font-medium">Jusqu'à (vide = sans limite)</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {tiers.map((t, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`Nom du palier ${i + 1}`}
                    value={t.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    className={`${fieldClass} mt-0`}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`Taux du palier ${i + 1}`}
                    type="number"
                    min={0}
                    max={50}
                    step="0.5"
                    value={t.rate}
                    onChange={(e) => update(i, { rate: Number(e.target.value) })}
                    className={`${fieldClass} mt-0 w-24`}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`Minimum du palier ${i + 1}`}
                    type="number"
                    min={0}
                    value={t.min}
                    onChange={(e) => update(i, { min: Number(e.target.value) })}
                    className={`${fieldClass} mt-0`}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`Maximum du palier ${i + 1}`}
                    type="number"
                    min={0}
                    value={t.max ?? ""}
                    onChange={(e) =>
                      update(i, { max: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className={`${fieldClass} mt-0`}
                  />
                </td>
                <td className="py-1">
                  <button
                    type="button"
                    disabled={tiers.length <= 1}
                    onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                    className="grid h-9 w-9 place-items-center rounded-lg hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                    aria-label={`Supprimer le palier ${t.label || i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        disabled={tiers.length >= 8}
        onClick={() => {
          const last = tiers[tiers.length - 1];
          const min = last ? (last.max ?? last.min) + 1 : 0;
          setTiers([...tiers, { label: "Nouveau palier", rate: last?.rate ?? 10, min, max: null }]);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden /> Ajouter un palier
      </Button>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-4">
        <div className="flex items-center gap-3">
          <Switch
            id="tva"
            checked={tva.enabled}
            onCheckedChange={(v) => setTva({ ...tva, enabled: v })}
          />
          <label htmlFor="tva" className="text-sm font-medium">
            Facturer la TVA
          </label>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="tva-rate">Taux</label>
          <input
            id="tva-rate"
            type="number"
            min={0}
            max={30}
            value={tva.rate}
            disabled={!tva.enabled}
            onChange={(e) => setTva({ ...tva, rate: Number(e.target.value) })}
            className={`${fieldClass} mt-0 w-20`}
          />
          %
        </div>
        <p className="text-xs text-muted-foreground w-full">
          À activer selon le régime fiscal de la structure (à confirmer avec votre comptable).
        </p>
      </div>
      <SaveButton saving={saving} />
    </form>
  );
}

// --- 6. Paiements ----------------------------------------------------------------

function PaymentsStep({ snapshot, save, saving }: StepProps) {
  const p = snapshot.payments;
  const [wave, setWave] = useState({
    enabled: p?.wave.enabled ?? true,
    number: p?.wave.number ? formatSenegalPhone(p.wave.number) : "",
  });
  const [om, setOm] = useState({
    enabled: p?.orangeMoney.enabled ?? true,
    number: p?.orangeMoney.number ? formatSenegalPhone(p.orangeMoney.number) : "",
  });
  const [cash, setCash] = useState(p?.cashOnDelivery.enabled ?? true);
  const row = (
    id: string,
    label: string,
    value: { enabled: boolean; number: string },
    set: (v: { enabled: boolean; number: string }) => void,
  ) => (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Switch
          id={id}
          checked={value.enabled}
          onCheckedChange={(v) => set({ ...value, enabled: v })}
        />
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      </div>
      {value.enabled && (
        <TextField
          label={`Numéro marchand ${label}`}
          type="tel"
          inputMode="tel"
          value={value.number}
          onChange={(v) => set({ ...value, number: v })}
          hint="Le numéro sur lequel les restaurants paient. 9 chiffres."
        />
      )}
    </div>
  );
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save({
          step: "payments",
          data: { wave, orangeMoney: om, cashOnDelivery: { enabled: cash } },
        });
      }}
    >
      <p className="text-sm text-muted-foreground">
        Pendant le pilote, les paiements arrivent sur vos numéros marchands et l'équipe confirme
        chaque paiement reçu (lot 1.4).
      </p>
      {row("wave", "Wave", wave, setWave)}
      {row("om", "Orange Money", om, setOm)}
      <div className="flex items-center gap-3 rounded-xl border border-border p-4">
        <Switch id="cash" checked={cash} onCheckedChange={setCash} />
        <label htmlFor="cash" className="text-sm font-medium">
          Paiement en espèces à la livraison
        </label>
      </div>
      <SaveButton saving={saving} />
    </form>
  );
}

// --- 7. Catalogue ----------------------------------------------------------------

function CatalogStep({ snapshot, save, saving }: StepProps) {
  const [names, setNames] = useState(snapshot.categories.map((c) => c.name));
  const used = new Set(snapshot.categories.filter((c) => c.used).map((c) => c.name));
  const [draft, setDraft] = useState("");
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= names.length) return;
    const next = [...names];
    [next[i], next[j]] = [next[j], next[i]];
    setNames(next);
  };
  const add = () => {
    const name = draft.trim();
    if (name.length < 2) return;
    if (!names.some((n) => n.toLowerCase() === name.toLowerCase())) setNames([...names, name]);
    setDraft("");
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ step: "catalog", data: { names } });
      }}
    >
      <p className="text-sm text-muted-foreground">
        Les catégories dans lesquelles les producteurs rangent leurs produits, dans l'ordre
        d'affichage. Une catégorie déjà utilisée ne peut pas être supprimée.
      </p>
      <ol className="space-y-2">
        {names.map((name, i) => (
          <li
            key={name}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
          >
            <span className="w-6 text-xs text-muted-foreground">{i + 1}.</span>
            <span className="flex-1 text-sm">{name}</span>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent disabled:opacity-30"
              aria-label={`Monter ${name}`}
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === names.length - 1}
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent disabled:opacity-30"
              aria-label={`Descendre ${name}`}
            >
              <ArrowDown className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setNames(names.filter((n) => n !== name))}
              disabled={used.has(name) || names.length <= 1}
              title={used.has(name) ? "Utilisée par des produits" : undefined}
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
              aria-label={`Supprimer ${name}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Nouvelle catégorie"
          aria-label="Nom de la catégorie à ajouter"
          className={`${fieldClass} mt-0`}
        />
        <Button type="button" variant="outline" onClick={add} className="gap-1 shrink-0">
          <Plus className="h-4 w-4" aria-hidden /> Ajouter
        </Button>
      </div>
      <SaveButton saving={saving} />
    </form>
  );
}

// --- 8. Équipe -------------------------------------------------------------------

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super administrateur",
  operations: "Opérations",
  finance: "Finance",
  support: "Support",
};

function TeamStep({ snapshot, save, saving }: StepProps) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    staffRole: "operations" as "operations" | "finance" | "support",
  });
  const [link, setLink] = useState<{ url: string; name: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const set = (k: "firstName" | "lastName" | "email") => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const invite = async () => {
    setInviting(true);
    try {
      const res = await createStaffInviteFn({ data: form });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setLink({ url: `${window.location.origin}${res.path}`, name: form.firstName });
      setForm({ firstName: "", lastName: "", email: "", staffRole: form.staffRole });
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Invitation impossible.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium">Équipe actuelle</h3>
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
          {snapshot.team.map((m) => (
            <li key={m.email} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
              <span className="font-medium">{m.name}</span>
              <span className="text-muted-foreground">{m.email}</span>
              <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs">
                {m.staffRole ? ROLE_LABEL[m.staffRole] : "Sans rôle"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-4">
        <h3 className="text-sm font-medium">Inviter un membre</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Prénom" value={form.firstName} onChange={set("firstName")} />
          <TextField label="Nom" value={form.lastName} onChange={set("lastName")} />
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            value={form.email}
            onChange={set("email")}
          />
          <Field label="Rôle">
            {(id) => (
              <select
                id={id}
                value={form.staffRole}
                onChange={(e) =>
                  setForm({ ...form, staffRole: e.target.value as typeof form.staffRole })
                }
                className={fieldClass}
              >
                <option value="operations">Opérations : validations, livraisons, litiges</option>
                <option value="finance">Finance : paiements, remboursements, versements</option>
                <option value="support">Support : messages et réclamations</option>
              </select>
            )}
          </Field>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={invite}
          disabled={inviting}
          className="gap-2"
        >
          {inviting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Créer le lien d'invitation
        </Button>
        {link && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 space-y-2">
            <p>
              Lien personnel pour {link.name}, valable 72 heures et utilisable une seule fois.
              Envoyez-le-lui directement :
            </p>
            <input
              readOnly
              value={link.url}
              aria-label="Lien d'invitation"
              className={`${fieldClass} mt-0 font-mono text-xs`}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={async () => {
                  await navigator.clipboard?.writeText(link.url);
                  toast.success("Lien copié");
                }}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden /> Copier
              </Button>
              <Button type="button" size="sm" variant="outline" className="gap-1" asChild>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Ton invitation Diambar Agro : ${link.url}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save({ step: "team", data: {} });
        }}
      >
        <SaveButton
          saving={saving}
          label={
            snapshot.team.length > 1 ? "Valider l'équipe" : "Continuer sans inviter pour l'instant"
          }
        />
      </form>
    </div>
  );
}

// --- Assistant -------------------------------------------------------------------

const STEP_COMPONENTS: Record<SetupStepKey, (props: StepProps) => ReactNode> = {
  security: SecurityStep,
  company: CompanyStep,
  zone: ZoneStep,
  orders: OrdersStep,
  money: MoneyStep,
  payments: PaymentsStep,
  catalog: CatalogStep,
  team: TeamStep,
};

function firstUndone(snapshot: SetupSnapshot): SetupStepKey | null {
  return SETUP_STEPS.find((s) => !snapshot.setup.steps?.[s.key])?.key ?? null;
}

function SetupWizard() {
  const snapshot = Route.useLoaderData();
  const router = useRouter();
  const { done, total } = setupProgress(snapshot.setup);
  const [current, setCurrent] = useState<SetupStepKey | "finish">(
    firstUndone(snapshot) ?? "finish",
  );
  const [saving, setSaving] = useState(false);
  // Après un enregistrement, on passe à la prochaine étape à faire dès que les
  // données rechargées (qui contiennent l'étape validée) sont arrivées.
  const [justSaved, setJustSaved] = useState<SetupStepKey | null>(null);

  useEffect(() => {
    if (!justSaved || !snapshot.setup.steps?.[justSaved]) return;
    setJustSaved(null);
    setCurrent(firstUndone(snapshot) ?? "finish");
  }, [justSaved, snapshot]);

  useEffect(() => {
    document.getElementById("setup-panel")?.focus();
  }, [current]);

  const save = async (input: SaveStepInput) => {
    setSaving(true);
    try {
      const res = await saveSetupStepFn({ data: input });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Étape enregistrée", { description: res.notice });
      setJustSaved(input.step);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const setOpen = async (open: boolean) => {
    setSaving(true);
    try {
      const res = await setRegistrationsOpenFn({ data: { open } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(open ? "Inscriptions ouvertes" : "Inscriptions fermées");
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Action impossible.");
    } finally {
      setSaving(false);
    }
  };

  const Step = current === "finish" ? null : STEP_COMPONENTS[current];
  const stepMeta = SETUP_STEPS.find((s) => s.key === current);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration de la plateforme"
        subtitle="Les réglages indispensables avant d'accueillir les premiers restaurants, producteurs et livreurs"
      />

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            Configuration {done}/{total}
          </span>
          <span className="text-muted-foreground">
            {snapshot.registrationsOpen ? "Inscriptions ouvertes" : "Inscriptions fermées"}
          </span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label="Progression de la configuration"
        >
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
        {snapshot.demoMode && (
          <p className="mt-2 text-xs text-muted-foreground">
            Mode démo : les réglages sont enregistrés{" "}
            {snapshot.setup.demo ? "dans la base de démonstration" : "dans la base"}.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Étapes de la configuration" className="glass rounded-2xl p-2 h-fit">
          <ol className="space-y-1">
            {SETUP_STEPS.map((s, i) => {
              const isDone = !!snapshot.setup.steps?.[s.key] || !!snapshot.setup.demo;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => setCurrent(s.key)}
                    aria-current={current === s.key ? "step" : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${current === s.key ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${isDone ? "bg-emerald-600 text-white" : current === s.key ? "bg-white/20" : "bg-muted text-muted-foreground"}`}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" aria-label="faite" /> : i + 1}
                    </span>
                    {s.label}
                  </button>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => setCurrent("finish")}
                aria-current={current === "finish" ? "step" : undefined}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${current === "finish" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Rocket className="h-3.5 w-3.5" aria-hidden />
                </span>
                Ouverture
              </button>
            </li>
          </ol>
        </nav>

        <section
          id="setup-panel"
          tabIndex={-1}
          aria-labelledby="setup-step-title"
          className="glass rounded-2xl p-5 sm:p-6 outline-none"
        >
          {Step && stepMeta ? (
            <>
              <h2 id="setup-step-title" className="font-display text-xl font-semibold">
                {stepMeta.label}
              </h2>
              <p className="mt-1 mb-5 text-sm text-muted-foreground">{stepMeta.hint}</p>
              <Step key={current} snapshot={snapshot} save={save} saving={saving} />
            </>
          ) : (
            <FinishPanel
              snapshot={snapshot}
              done={done}
              total={total}
              saving={saving}
              setOpen={setOpen}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function FinishPanel({
  snapshot,
  done,
  total,
  saving,
  setOpen,
}: {
  snapshot: SetupSnapshot;
  done: number;
  total: number;
  saving: boolean;
  setOpen: (open: boolean) => Promise<void>;
}) {
  const ready = done >= total;
  const zone = snapshot.zone;
  return (
    <div className="space-y-4">
      <h2 id="setup-step-title" className="font-display text-xl font-semibold">
        Ouverture des inscriptions
      </h2>
      {snapshot.registrationsOpen ? (
        <p className="text-sm text-muted-foreground">
          Les inscriptions sont ouvertes : chaque nouveau compte arrive dans Validations et attend
          votre accord avant d'accéder à la plateforme.
        </p>
      ) : ready ? (
        <p className="text-sm text-muted-foreground">
          Tout est prêt. En ouvrant les inscriptions, la page d'inscription devient accessible à
          tous ; chaque compte reste en attente jusqu'à votre validation.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Encore {total - done} étape{total - done > 1 ? "s" : ""} avant de pouvoir ouvrir les
          inscriptions.
        </p>
      )}
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-border p-3">
          <dt className="text-xs text-muted-foreground">Zone pilote</dt>
          <dd className="font-medium">
            {zone ? `${zone.city} · ${zone.zones.length} quartiers` : "À configurer"}
          </dd>
        </div>
        <div className="rounded-xl border border-border p-3">
          <dt className="text-xs text-muted-foreground">Heure limite · minimum</dt>
          <dd className="font-medium">
            {snapshot.orders.cutoffHour} h · {formatFCFA(snapshot.orders.minOrderPerProducer)}
          </dd>
        </div>
      </dl>
      {snapshot.registrationsOpen ? (
        <Button
          variant="outline"
          disabled={saving}
          onClick={() => setOpen(false)}
          className="gap-2"
        >
          <Lock className="h-4 w-4" aria-hidden /> Fermer les inscriptions
        </Button>
      ) : (
        <Button disabled={saving || !ready} onClick={() => setOpen(true)} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Unlock className="h-4 w-4" aria-hidden />
          )}
          Ouvrir les inscriptions
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Les règles de commande, la commission et les paiements enregistrés ici seront appliqués aux
        commandes quand elles passeront dans la base (lots 1.3 et 1.4).
      </p>
    </div>
  );
}
