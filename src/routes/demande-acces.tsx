import { createFileRoute, Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { CheckCircle2, Loader2, Sprout, Truck, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { Eyebrow } from "@/components/landing/ui";
import { useCities } from "@/data/admin-store";
import { submitAccessRequestFn, type AccessRequestInput } from "@/lib/access/functions";
import { normalizeSenegalPhone } from "@/lib/auth/helpers";

type Role = "restaurant" | "farmer" | "driver";
const ROLES: { id: Role; label: string; icon: typeof Sprout; org?: string }[] = [
  { id: "restaurant", label: "Restaurant", icon: UtensilsCrossed, org: "Nom de l'établissement" },
  { id: "farmer", label: "Producteur", icon: Sprout, org: "Nom de l'exploitation" },
  { id: "driver", label: "Livreur", icon: Truck },
];

export const Route = createFileRoute("/demande-acces")({
  validateSearch: (s: Record<string, unknown>): { role?: Role } => ({
    role: ROLES.some((r) => r.id === s.role) ? (s.role as Role) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Demander l'accès · Diambar Agro" },
      {
        name: "description",
        content:
          "Pendant le pilote, Diambar Agro ouvre les accès zone par zone. Demandez votre accès en deux minutes.",
      },
    ],
  }),
  component: AccessRequestPage,
});

const NETWORK_ERROR = "Connexion impossible. Vérifiez votre accès à internet et réessayez.";

function AccessRequestPage() {
  const { role: initialRole } = Route.useSearch();
  const cities = useCities();
  const [role, setRole] = useState<Role>(initialRole ?? "restaurant");
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    organization: "",
    city: "Dakar",
    area: "",
    message: "",
    consent: false,
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<null | { alreadyPending: boolean }>(null);
  const ids = {
    name: useId(),
    phone: useId(),
    org: useId(),
    city: useId(),
    area: useId(),
    msg: useId(),
  };
  const roleInfo = ROLES.find((r) => r.id === role)!;
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.fullName.trim().length < 3) return toast.error("Indiquez votre nom complet");
    if (!normalizeSenegalPhone(form.phone)) {
      return toast.error("Numéro sénégalais à 9 chiffres attendu (ex. 77 123 45 67)");
    }
    if (roleInfo.org && form.organization.trim().length < 2) {
      return toast.error(`Indiquez le ${roleInfo.org.toLowerCase()}`);
    }
    if (!form.consent) return toast.error("Acceptez d'être recontacté pour envoyer la demande");
    setLoading(true);
    try {
      const data: AccessRequestInput = {
        role,
        fullName: form.fullName,
        phone: form.phone,
        organization: roleInfo.org ? form.organization : undefined,
        city: form.city,
        area: form.area || undefined,
        message: form.message || undefined,
        consent: true,
      };
      const res = await submitAccessRequestFn({ data });
      setSent({ alreadyPending: res.alreadyPending });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const input =
    "mt-1.5 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10";

  return (
    <div className="public-surface min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pt-28 pb-20 sm:pt-36">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div>
            <Eyebrow>Accès sur demande · Pilote</Eyebrow>
            <h1 className="display-xl mt-4 text-5xl sm:text-6xl lg:text-7xl">
              Rejoignez le pilote.
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Pendant le pilote, nous ouvrons Diambar Agro zone par zone. Laissez-nous vos
              coordonnées : nous vous rappelons pour vérifier votre zone et préparer vos débuts.
            </p>
            <ol className="mt-10 space-y-5">
              {[
                ["01", "Vous envoyez votre demande", "Deux minutes, sans paiement ni engagement."],
                [
                  "02",
                  "Nous vous appelons",
                  "Nous vérifions votre zone et répondons à vos questions.",
                ],
                [
                  "03",
                  "Vous recevez votre invitation",
                  "Un lien personnel pour créer votre compte.",
                ],
              ].map(([n, t, d]) => (
                <li key={n} className="flex gap-4">
                  <span className="eyebrow mt-1 text-emerald-700">{n}</span>
                  <div>
                    <div className="font-semibold">{t}</div>
                    <div className="text-sm text-muted-foreground">{d}</div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-10 text-sm text-muted-foreground">
              Déjà un compte ?{" "}
              <Link
                to="/login"
                className="font-semibold text-foreground underline underline-offset-4"
              >
                Se connecter
              </Link>
            </p>
          </div>

          <div className="rounded-[2rem] border border-black/5 bg-white p-5 shadow-xl shadow-black/[0.04] sm:p-8">
            {sent ? (
              <div className="py-8 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-8 w-8" aria-hidden />
                </div>
                <h2 className="display-xl mt-6 text-3xl sm:text-4xl">
                  {sent.alreadyPending ? "Demande déjà reçue." : "Demande envoyée."}
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
                  {sent.alreadyPending
                    ? "Nous avons déjà une demande en cours pour ce numéro. Notre équipe vous recontacte bientôt."
                    : "Merci ! Notre équipe vous appelle dans les prochains jours au numéro indiqué."}
                </p>
                <Link
                  to="/"
                  className="mt-8 inline-flex rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-black/5"
                >
                  Retour à l'accueil
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <fieldset>
                  <legend className="text-sm font-semibold">Vous êtes</legend>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {ROLES.map((r) => (
                      <label
                        key={r.id}
                        className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-sm font-medium transition ${
                          role === r.id
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-border bg-white hover:border-neutral-400"
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={r.id}
                          checked={role === r.id}
                          onChange={() => setRole(r.id)}
                          className="sr-only"
                        />
                        <r.icon className="h-5 w-5" aria-hidden />
                        {r.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor={ids.name} className="text-sm font-medium">
                      Nom et prénom
                    </label>
                    <input
                      id={ids.name}
                      autoComplete="name"
                      value={form.fullName}
                      onChange={(e) => set("fullName", e.target.value)}
                      className={input}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={ids.phone} className="text-sm font-medium">
                      Téléphone (WhatsApp de préférence)
                    </label>
                    <div className="mt-1.5 flex gap-2">
                      <span
                        className="grid place-items-center rounded-2xl border border-border bg-white px-3 text-sm font-medium"
                        aria-hidden
                      >
                        +221
                      </span>
                      <input
                        id={ids.phone}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        placeholder="77 123 45 67"
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        className={`${input} mt-0 flex-1`}
                      />
                    </div>
                  </div>
                  {roleInfo.org && (
                    <div className="sm:col-span-2">
                      <label htmlFor={ids.org} className="text-sm font-medium">
                        {roleInfo.org}
                      </label>
                      <input
                        id={ids.org}
                        autoComplete="organization"
                        value={form.organization}
                        onChange={(e) => set("organization", e.target.value)}
                        className={input}
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor={ids.city} className="text-sm font-medium">
                      Ville
                    </label>
                    <select
                      id={ids.city}
                      value={form.city}
                      onChange={(e) => set("city", e.target.value)}
                      className={input}
                    >
                      {cities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={ids.area} className="text-sm font-medium">
                      Commune ou quartier
                    </label>
                    <input
                      id={ids.area}
                      placeholder="Ex. Plateau, Pikine…"
                      value={form.area}
                      onChange={(e) => set("area", e.target.value)}
                      className={input}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={ids.msg} className="text-sm font-medium">
                      Un mot pour nous (facultatif)
                    </label>
                    <textarea
                      id={ids.msg}
                      rows={3}
                      placeholder={
                        role === "restaurant"
                          ? "Produits recherchés, volumes, jours de livraison…"
                          : role === "farmer"
                            ? "Ce que vous produisez, quantités, saisons…"
                            : "Votre véhicule, vos zones, vos disponibilités…"
                      }
                      value={form.message}
                      onChange={(e) => set("message", e.target.value)}
                      className={`${input} resize-none`}
                    />
                  </div>
                </div>

                <label className="mt-5 flex items-start gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => set("consent", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  <span>
                    J'accepte d'être recontacté par Diambar Agro au sujet de ma demande. Voir la{" "}
                    <a
                      href="/legal/privacy"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      politique de confidentialité
                    </a>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 py-3.5 font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Envoyer ma demande
                </button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Gratuit et sans engagement. Aucun paiement à cette étape.
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
