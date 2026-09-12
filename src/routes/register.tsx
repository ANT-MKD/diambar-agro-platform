import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sprout,
  UtensilsCrossed,
  Truck,
  Wrench,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthSplitLayout } from "@/components/auth/split-layout";
import { RoleCard } from "@/components/auth/role-card";
import { OtpInput } from "@/components/auth/otp-input";
import { PasswordStrength, passwordScore } from "@/components/auth/password-strength";
import { cities } from "@/data/mocks";

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>): { role?: string } => ({
    role: (s.role as string) || undefined,
  }),
  head: () => ({ meta: [{ title: "Inscription · Diambar Agro" }] }),
  component: RegisterPage,
});

type Role = "farmer" | "restaurant" | "driver" | "admin";

type RegisterForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  city: string;
};

function RegisterPage() {
  const { role: initialRole } = Route.useSearch();
  const navigate = useNavigate();
  const [step, setStep] = useState(initialRole ? 2 : 1);
  const [role, setRole] = useState<Role | "">((initialRole as Role) || "");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    city: "Dakar",
  });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submitStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    const schema = z
      .object({
        firstName: z.string().min(2, "Prénom requis"),
        lastName: z.string().min(2, "Nom requis"),
        email: z.string().email("Email invalide"),
        phone: z.string().min(8, "Téléphone invalide"),
        password: z.string().min(8, "8 caractères minimum"),
        confirm: z.string(),
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

  const submitOtp = () => {
    if (otp.length < 6) {
      toast.error("Code à 6 chiffres requis");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Compte créé ! (simulé)");
      navigate({ to: "/onboarding", search: { role: role || "farmer" } });
    }, 800);
  };

  return (
    <AuthSplitLayout>
      <div>
        <Stepper step={step} />
        {step === 1 && <Step1 role={role} setRole={(r) => setRole(r)} onNext={next} />}
        {step === 2 && <Step2 form={form} setForm={setForm} onNext={submitStep2} onBack={back} />}
        {step === 3 && <Step3 role={role as Role} onNext={next} onBack={back} />}
        {step === 4 && (
          <div>
            <button
              onClick={back}
              className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4 hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour
            </button>
            <h1 className="font-display text-2xl font-bold">Vérifiez votre numéro</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Code envoyé au{" "}
              <span className="font-medium text-foreground">
                +221 {form.phone || "77 XXX XXXX"}
              </span>
            </p>
            <div className="mt-8">
              <OtpInput value={otp} onChange={setOtp} />
            </div>
            <button
              disabled={loading}
              onClick={submitOtp}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Vérifier et créer mon compte
            </button>
            <button
              onClick={() => toast.info("Code renvoyé")}
              className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Renvoyer le code
            </button>
          </div>
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
    {
      id: "admin",
      icon: Wrench,
      title: "Admin",
      desc: "Je gère la plateforme (avec code)",
      accent: "violet",
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
  const set = (k: keyof RegisterForm, v: string) => setForm({ ...form, [k]: v });
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
        <Input label="Prénom" value={form.firstName} onChange={(v) => set("firstName", v)} />
        <Input label="Nom" value={form.lastName} onChange={(v) => set("lastName", v)} />
      </div>
      <div className="mt-3">
        <Input label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
      </div>
      <div className="mt-3">
        <label className="text-sm font-medium">Téléphone</label>
        <div className="mt-1.5 flex gap-2">
          <span className="glass rounded-xl px-3 py-3 text-sm font-medium">🇸🇳 +221</span>
          <input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="77 123 45 67"
            className="flex-1 glass rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      <div className="mt-3">
        <Input
          label="Mot de passe"
          type="password"
          value={form.password}
          onChange={(v) => set("password", v)}
        />
        <PasswordStrength value={form.password} />
      </div>
      <div className="mt-3">
        <Input
          label="Confirmer mot de passe"
          type="password"
          value={form.confirm}
          onChange={(v) => set("confirm", v)}
        />
      </div>
      <div className="mt-3">
        <label className="text-sm font-medium">Ville</label>
        <select
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
      <button
        type="submit"
        className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold"
      >
        Continuer <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

function Step3({ role, onNext, onBack }: { role: string; onNext: () => void; onBack: () => void }) {
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
            <Input label="Nom de l'exploitation" />
            <Input label="Localisation précise" />
            <Input label="Superficie (hectares)" type="number" />
            <div className="text-sm font-medium">Types de produits</div>
            <div className="grid grid-cols-2 gap-2">
              {["Légumes", "Fruits", "Céréales", "Volaille", "Tubercules", "Épices"].map((t) => (
                <label
                  key={t}
                  className="glass rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <input type="checkbox" className="rounded" />
                  {t}
                </label>
              ))}
            </div>
          </>
        )}
        {role === "restaurant" && (
          <>
            <Input label="Nom du restaurant" />
            <Input label="Adresse complète" />
            <Input label="Téléphone professionnel" />
            <Input label="NINEA (optionnel)" />
          </>
        )}
        {role === "driver" && (
          <>
            <div>
              <label className="text-sm font-medium">Type de véhicule</label>
              <select className="mt-1.5 w-full glass rounded-xl px-3 py-3 text-sm">
                <option>Moto</option>
                <option>Vélo</option>
                <option>Voiture</option>
                <option>Camionnette</option>
              </select>
            </div>
            <Input label="Numéro de permis" />
            <div className="text-sm font-medium">Zones de livraison</div>
            <div className="grid grid-cols-2 gap-2">
              {["Dakar-Plateau", "Dakar-Banlieue", "Thiès", "Mbour"].map((z) => (
                <label
                  key={z}
                  className="glass rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input type="checkbox" className="rounded" />
                  {z}
                </label>
              ))}
            </div>
          </>
        )}
        {role === "admin" && <Input label="Code d'accès admin" type="password" />}
      </div>
      <button
        onClick={onNext}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold"
      >
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
}: {
  label: string;
  type?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1.5 w-full glass rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
