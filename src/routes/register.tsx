import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { Sprout, UtensilsCrossed, Truck, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthSplitLayout } from "@/components/auth/split-layout";
import { RoleCard } from "@/components/auth/role-card";
import { OtpInput } from "@/components/auth/otp-input";
import { PasswordStrength, passwordScore } from "@/components/auth/password-strength";
import { useCities } from "@/data/admin-store";
import {
  getAuthConfigFn,
  registerValidateFn,
  registerVerifyFn,
  resendRegistrationCodeFn,
} from "@/lib/auth/functions";
import {
  formatSenegalPhone,
  normalizeSenegalPhone,
  registerDetailsProblem,
} from "@/lib/auth/helpers";
import { DemoNotice } from "@/components/auth/demo-notice";
import type { RegisterDetails } from "@/lib/auth/session.server";

export const Route = createFileRoute("/register")({
  // Seuls les trois profils publics sont acceptés dans l'adresse (?role=).
  validateSearch: (s: Record<string, unknown>): { role?: Role } => ({
    role: PUBLIC_ROLES.includes(s.role as Role) ? (s.role as Role) : undefined,
  }),
  loader: () => getAuthConfigFn(),
  head: () => ({ meta: [{ title: "Inscription · Diambar Agro" }] }),
  component: RegisterPage,
});

type Role = "farmer" | "restaurant" | "driver";
const PUBLIC_ROLES: Role[] = ["farmer", "restaurant", "driver"];
const NETWORK_ERROR = "Connexion impossible. Vérifiez votre accès à internet et réessayez.";

type RegisterForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  city: string;
  acceptTerms: boolean;
};

function RegisterPage() {
  const { role: initialRole } = Route.useSearch();
  const config = Route.useLoaderData();
  const navigate = useNavigate();
  const [step, setStep] = useState(initialRole ? 2 : 1);
  const [role, setRole] = useState<Role | "">(initialRole ?? "");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    city: "Dakar",
    acceptTerms: false,
  });
  const [details, setDetails] = useState<RegisterDetails>({});
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const phoneDigits = normalizeSenegalPhone(form.phone);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submitStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    const schema = z
      .object({
        firstName: z.string().trim().min(2, "Prénom requis"),
        lastName: z.string().trim().min(2, "Nom requis"),
        email: z.string().trim().email("Email invalide"),
        phone: z.string().refine((p) => normalizeSenegalPhone(p) !== null, {
          message: "Numéro sénégalais à 9 chiffres attendu (ex. 77 123 45 67)",
        }),
        password: z.string().min(8, "8 caractères minimum").max(128, "128 caractères maximum"),
        confirm: z.string(),
        acceptTerms: z.literal(true, {
          errorMap: () => ({ message: "Acceptez les conditions générales pour continuer" }),
        }),
      })
      .refine((d) => d.password === d.confirm, {
        message: "Les mots de passe diffèrent",
        path: ["confirm"],
      });
    const r = schema.safeParse(form);
    if (!r.success) {
      toast.error(r.error.issues[0].message);
      return;
    }
    if (passwordScore(form.password) < 2) {
      toast.warning("Renforcez votre mot de passe");
    }
    next();
  };

  const submitStep3 = async () => {
    const chosenRole = (role || "farmer") as Role;
    const problem = registerDetailsProblem(chosenRole, details);
    if (problem) {
      toast.error(problem);
      return;
    }
    setLoading(true);
    try {
      const res = await registerValidateFn({
        data: {
          role: chosenRole,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          city: form.city,
          acceptTerms: form.acceptTerms as true,
          details,
        },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setOtp("");
      setResendIn(res.resendInSeconds);
      toast.info("Code de vérification envoyé", {
        description: res.devCode ? `Code démo : ${res.devCode}` : undefined,
      });
      next();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    try {
      const res = await resendRegistrationCodeFn();
      if (res.ok) {
        setOtp("");
        setResendIn(res.resendInSeconds);
        toast.info("Nouveau code envoyé", {
          description: res.devCode ? `Code démo : ${res.devCode}` : undefined,
        });
      } else if (res.waitSeconds) {
        setResendIn(res.waitSeconds);
      } else {
        toast.error(res.message);
        setStep(2);
      }
    } catch {
      toast.error(NETWORK_ERROR);
    }
  };

  const submitOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otp.replace(/\s/g, "").length < 6) {
      toast.error("Code à 6 chiffres requis");
      return;
    }
    setLoading(true);
    try {
      const res = await registerVerifyFn({ data: { code: otp } });
      if (!res.ok) {
        toast.error(res.message);
        setOtp("");
        if (res.restart) setStep(2);
        return;
      }
      toast.success("Compte créé !");
      navigate({ to: "/onboarding", search: { role: role || "farmer" } });
    } catch {
      toast.error(NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout>
      <div>
        {config.demoMode && <DemoNotice />}
        <Stepper step={step} />
        {step === 1 && <Step1 role={role} setRole={(r) => setRole(r)} onNext={next} />}
        {step === 2 && <Step2 form={form} setForm={setForm} onNext={submitStep2} onBack={back} />}
        {step === 3 && (
          <Step3
            role={role as Role}
            details={details}
            setDetails={setDetails}
            onNext={submitStep3}
            onBack={back}
            loading={loading}
          />
        )}
        {step === 4 && (
          <form onSubmit={submitOtp}>
            <button
              type="button"
              onClick={back}
              className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4 hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Retour
            </button>
            <h1 className="font-display text-2xl font-bold">Vérifiez votre numéro</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Code envoyé au{" "}
              <span className="font-medium text-foreground">
                +221 {phoneDigits ? formatSenegalPhone(phoneDigits) : form.phone}
              </span>
              . Il est valable 10 minutes.
            </p>
            <div className="mt-8">
              <OtpInput value={otp} onChange={setOtp} />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Vérifier et créer mon compte
            </button>
            <button
              type="button"
              disabled={resendIn > 0}
              onClick={resendOtp}
              className="mt-3 w-full text-sm font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              {resendIn > 0 ? `Renvoyer le code dans ${resendIn} s` : "Renvoyer le code"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link to="/login" className="text-primary hover:underline font-semibold">
            Se connecter
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>Étape {step}/4</span>
        <span>{Math.round(step * 25)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${step * 25}%` }}
        />
      </div>
    </div>
  );
}

function Step1({
  role,
  setRole,
  onNext,
}: {
  role: string;
  setRole: (r: Role) => void;
  onNext: () => void;
}) {
  const roles: {
    id: Role;
    icon: typeof Sprout;
    title: string;
    desc: string;
    accent: "emerald" | "amber" | "blue" | "violet";
  }[] = [
    {
      id: "farmer",
      icon: Sprout,
      title: "Agriculteur",
      desc: "Je vends mes produits agricoles",
      accent: "emerald",
    },
    {
      id: "restaurant",
      icon: UtensilsCrossed,
      title: "Restaurant",
      desc: "Je m'approvisionne directement",
      accent: "amber",
    },
    {
      id: "driver",
      icon: Truck,
      title: "Livreur",
      desc: "Je livre les commandes",
      accent: "blue",
    },
  ];
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Bienvenue sur Diambar Agro</h1>
      <p className="mt-1 text-sm text-muted-foreground">Quel est votre profil ?</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {roles.map((r) => (
          <RoleCard key={r.id} {...r} selected={role === r.id} onClick={() => setRole(r.id)} />
        ))}
      </div>
      <button
        disabled={!role}
        onClick={onNext}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-40"
      >
        Continuer <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Step2({
  form,
  setForm,
  onNext,
  onBack,
}: {
  form: RegisterForm;
  setForm: React.Dispatch<React.SetStateAction<RegisterForm>>;
  onNext: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  const cities = useCities();
  const phoneId = useId();
  const cityId = useId();
  const set = <K extends keyof RegisterForm>(k: K, v: RegisterForm[K]) =>
    setForm({ ...form, [k]: v });
  return (
    <form onSubmit={onNext}>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4 hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour
      </button>
      <h1 className="font-display text-2xl font-bold">Informations personnelles</h1>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Input
          label="Prénom"
          autoComplete="given-name"
          value={form.firstName}
          onChange={(v) => set("firstName", v)}
        />
        <Input
          label="Nom"
          autoComplete="family-name"
          value={form.lastName}
          onChange={(v) => set("lastName", v)}
        />
      </div>
      <div className="mt-3">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(v) => set("email", v)}
        />
      </div>
      <div className="mt-3">
        <label htmlFor={phoneId} className="text-sm font-medium">
          Téléphone
        </label>
        <div className="mt-1.5 flex gap-2">
          <span className="glass rounded-xl px-3 py-3 text-sm font-medium" aria-hidden>
            🇸🇳 +221
          </span>
          <input
            id={phoneId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            aria-describedby={`${phoneId}-hint`}
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="77 123 45 67"
            className="flex-1 glass rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <p id={`${phoneId}-hint`} className="mt-1 text-[11px] text-muted-foreground">
          9 chiffres, sans l'indicatif. Le code de vérification sera envoyé à ce numéro.
        </p>
      </div>
      <div className="mt-3">
        <Input
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(v) => set("password", v)}
        />
        <PasswordStrength value={form.password} />
      </div>
      <div className="mt-3">
        <Input
          label="Confirmer mot de passe"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={(v) => set("confirm", v)}
        />
      </div>
      <div className="mt-3">
        <label htmlFor={cityId} className="text-sm font-medium">
          Ville
        </label>
        <select
          id={cityId}
          value={form.city}
          onChange={(e) => set("city", e.target.value)}
          className="mt-1.5 w-full glass rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.acceptTerms}
          onChange={(e) => set("acceptTerms", e.target.checked)}
          className="mt-0.5 rounded border-border"
        />
        <span className="text-muted-foreground">
          J'accepte les{" "}
          <a
            href="/legal/terms"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            conditions générales d'utilisation
          </a>{" "}
          et la{" "}
          <a
            href="/legal/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            politique de confidentialité
          </a>
          .
        </span>
      </label>
      <button
        type="submit"
        className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold"
      >
        Continuer <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

function Step3({
  role,
  details,
  setDetails,
  onNext,
  onBack,
  loading,
}: {
  role: string;
  details: RegisterDetails;
  setDetails: React.Dispatch<React.SetStateAction<RegisterDetails>>;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const cities = useCities();
  const vehicleId = useId();
  const set = <K extends keyof RegisterDetails>(k: K, v: RegisterDetails[K]) =>
    setDetails((d) => ({ ...d, [k]: v }));
  const toggleInArray = (k: "productTypes" | "zones", value: string) =>
    setDetails((d) => {
      const arr = d[k] ?? [];
      return { ...d, [k]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4 hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour
      </button>
      <h1 className="font-display text-2xl font-bold">Informations spécifiques</h1>
      <p className="mt-1 text-sm text-muted-foreground">Quelques détails sur votre activité</p>
      <div className="mt-6 space-y-3">
        {role === "farmer" && (
          <>
            <Input
              label="Nom de l'exploitation"
              value={details.farmName}
              onChange={(v) => set("farmName", v)}
            />
            <Input
              label="Localisation précise"
              value={details.location}
              onChange={(v) => set("location", v)}
            />
            <Input
              label="Superficie (hectares)"
              type="number"
              value={details.areaHectares}
              onChange={(v) => set("areaHectares", v)}
            />
            <div className="text-sm font-medium">Types de produits</div>
            <div className="grid grid-cols-2 gap-2">
              {["Légumes", "Fruits", "Céréales", "Volaille", "Tubercules", "Épices"].map((t) => (
                <label
                  key={t}
                  className="glass rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={details.productTypes?.includes(t) ?? false}
                    onChange={() => toggleInArray("productTypes", t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </>
        )}
        {role === "restaurant" && (
          <>
            <Input
              label="Nom du restaurant"
              value={details.restaurantName}
              onChange={(v) => set("restaurantName", v)}
            />
            <Input
              label="Adresse complète"
              value={details.address}
              onChange={(v) => set("address", v)}
            />
            <Input
              label="Téléphone professionnel (facultatif)"
              value={details.professionalPhone}
              onChange={(v) => set("professionalPhone", v)}
            />
            <Input
              label="NINEA (optionnel)"
              value={details.ninea}
              onChange={(v) => set("ninea", v)}
            />
          </>
        )}
        {role === "driver" && (
          <>
            <div>
              <label htmlFor={vehicleId} className="text-sm font-medium">
                Type de véhicule
              </label>
              <select
                id={vehicleId}
                value={details.vehicleType ?? "Moto"}
                onChange={(e) => set("vehicleType", e.target.value)}
                className="mt-1.5 w-full glass rounded-xl px-3 py-3 text-sm"
              >
                <option>Moto</option>
                <option>Vélo</option>
                <option>Voiture</option>
                <option>Camionnette</option>
              </select>
            </div>
            <Input
              label={
                (details.vehicleType ?? "Moto") === "Vélo"
                  ? "Numéro de permis (facultatif à vélo)"
                  : "Numéro de permis"
              }
              value={details.licenseNumber}
              onChange={(v) => set("licenseNumber", v)}
            />
            <div className="text-sm font-medium">Zones de livraison</div>
            <div className="grid grid-cols-2 gap-2">
              {cities.map((z) => (
                <label
                  key={z}
                  className="glass rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={details.zones?.includes(z) ?? false}
                    onChange={() => toggleInArray("zones", z)}
                  />
                  {z}
                </label>
              ))}
            </div>
          </>
        )}
      </div>
      <button
        disabled={loading}
        onClick={onNext}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Continuer <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Input({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type?: string;
  value?: string;
  onChange?: (v: string) => void;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1.5 w-full glass rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
