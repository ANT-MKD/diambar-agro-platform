import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  User,
  Bell,
  Wallet,
  Shield,
  LogOut,
  Save,
  Zap,
  Truck,
  MapPin,
  Phone,
  Mail,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { driverProfile } from "@/data/mocks";
import { useDriverSettings, driverSettingsActions, driverOnlineActions } from "@/data/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChannelMatrix, TriggerRules } from "@/components/common/notification-rules";
import { SecurityPanel } from "@/components/common/security-panel";

const DRIVER_EVENTS = [
  {
    key: "missions",
    label: "Nouvelles missions",
    description: "Propositions correspondant à vos critères",
  },
  {
    key: "assigned",
    label: "Mission assignée",
    description: "Une mission vous est directement attribuée",
  },
  { key: "payments", label: "Paiements", description: "Virements et confirmations wallet" },
  { key: "messages", label: "Messages", description: "Restaurants et producteurs" },
  {
    key: "docs",
    label: "Documents véhicule",
    description: "Assurance ou visite technique à renouveler",
  },
] as const;

const DRIVER_RULES = [
  {
    key: "nearby",
    label: "Mission proche",
    condition: "mission à moins de 10 km de ma position",
    channel: "Push + WhatsApp immédiat",
    firedThisMonth: 17,
  },
  {
    key: "express",
    label: "Mission express",
    condition: "urgence = express et rémunération > 8 000 FCFA",
    channel: "Push prioritaire + SMS",
    firedThisMonth: 6,
  },
  {
    key: "payout",
    label: "Virement effectué",
    condition: "paiement Wave crédité",
    channel: "SMS + in-app",
    firedThisMonth: 4,
  },
  {
    key: "docs",
    label: "Document expirant",
    condition: "document véhicule expire dans 30 jours",
    channel: "Email + in-app hebdomadaire",
    firedThisMonth: 2,
  },
] as const;

const PAYOUT_FREQUENCIES = [
  ["daily", "Quotidien"],
  ["weekly", "Hebdomadaire"],
  ["manual", "Manuel"],
] as const;

export const Route = createFileRoute("/driver/settings")({
  head: () => ({ meta: [{ title: "Paramètres · Livreur" }] }),
  component: DriverSettings,
});

function DriverSettings() {
  const settings = useDriverSettings();
  const navigate = useNavigate();

  const [name, setName] = useState(settings.profile.name);
  const [phone, setPhone] = useState(settings.profile.phone);
  const [email, setEmail] = useState(settings.profile.email);
  const [city, setCity] = useState(settings.profile.city);

  const [radius, setRadius] = useState([settings.radius]);
  const [autoAccept, setAutoAccept] = useState(settings.autoAccept);

  const [notif, setNotif] = useState(settings.notif);

  const [methodOpen, setMethodOpen] = useState(false);
  const [methodType, setMethodType] = useState<"Wave" | "Orange Money" | "Free Money" | "Espèces">(
    "Wave",
  );
  const [methodLabel, setMethodLabel] = useState("");

  const [suspendOpen, setSuspendOpen] = useState(false);

  const saveProfile = () => {
    driverSettingsActions.updateProfile({ name, phone, email, city });
    toast.success("Profil enregistré");
  };

  const saveWork = () => {
    driverSettingsActions.setWorkPrefs({ radius: radius[0], autoAccept });
    toast.success("Préférences de travail enregistrées");
  };

  const saveNotif = () => {
    driverSettingsActions.setNotif(notif);
    toast.success("Préférences de notifications enregistrées");
  };

  const submitMethod = () => {
    if (!methodLabel.trim()) return;
    driverSettingsActions.addPaymentMethod(methodType, methodLabel.trim());
    toast.success(`Méthode ${methodType} ajoutée`);
    setMethodOpen(false);
    setMethodLabel("");
    setMethodType("Wave");
  };

  const suspendAccount = () => {
    driverOnlineActions.set(false);
    setSuspendOpen(false);
    toast.success("Compte suspendu · vous êtes déconnecté");
    navigate({ to: "/login" });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" subtitle="Compte, préférences et sécurité" />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="glass">
          <TabsTrigger value="profile">
            <User className="h-3.5 w-3.5 mr-1.5" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="work">
            <Truck className="h-3.5 w-3.5 mr-1.5" />
            Travail
          </TabsTrigger>
          <TabsTrigger value="notif">
            <Bell className="h-3.5 w-3.5 mr-1.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="payments">
            <Wallet className="h-3.5 w-3.5 mr-1.5" />
            Paiements
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            Sécurité
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="glass rounded-2xl p-5 flex items-center gap-4">
            <img
              src={settings.profile.avatar}
              alt=""
              className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/30"
            />
            <div className="flex-1">
              <div className="font-semibold">{settings.profile.name}</div>
              <div className="text-xs text-muted-foreground">
                Livreur depuis{" "}
                {new Date(driverProfile.memberSince).toLocaleDateString("fr-FR", {
                  month: "long",
                  year: "numeric",
                })}{" "}
                · ★ {driverProfile.rating}
              </div>
            </div>
          </div>
          <div className="glass rounded-2xl p-5 grid sm:grid-cols-2 gap-4">
            <Field icon={User} label="Nom complet" value={name} onChange={setName} />
            <Field icon={Phone} label="Téléphone" value={phone} onChange={setPhone} />
            <Field icon={Mail} label="Email" value={email} onChange={setEmail} />
            <Field icon={MapPin} label="Ville de base" value={city} onChange={setCity} />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveProfile} className="gap-2">
              <Save className="h-4 w-4" />
              Enregistrer
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="work" className="space-y-4">
          <div className="glass rounded-2xl p-5 space-y-4">
            <Row
              label="Acceptation automatique"
              description="Accepte les missions correspondant à vos critères"
              value={autoAccept}
              onChange={setAutoAccept}
            />
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold">Rayon d'action</div>
                  <div className="text-xs text-muted-foreground">
                    Distance maximale des missions proposées
                  </div>
                </div>
                <span className="font-mono font-semibold text-primary">{radius[0]} km</span>
              </div>
              <Slider value={radius} onValueChange={setRadius} min={5} max={200} step={5} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveWork} className="gap-2">
              <Save className="h-4 w-4" />
              Enregistrer
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notif" className="space-y-4">
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Matrice événements × canaux
            </div>
            <ChannelMatrix events={DRIVER_EVENTS} />
          </div>
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Règles de déclenchement
            </div>
            <TriggerRules rules={DRIVER_RULES} />
          </div>
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Canaux
            </div>
            <Row
              label="Push mobile"
              description="Notifications en temps réel"
              value={notif.push}
              onChange={(v) => setNotif({ ...notif, push: v })}
            />
            <Row
              label="SMS"
              description="Alertes critiques par SMS"
              value={notif.sms}
              onChange={(v) => setNotif({ ...notif, sms: v })}
            />
            <Row
              label="Email"
              description="Résumé hebdomadaire"
              value={notif.email}
              onChange={(v) => setNotif({ ...notif, email: v })}
            />
          </div>
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Types
            </div>
            <Row
              label="Nouvelles missions"
              description="Recevoir les propositions en temps réel"
              value={notif.missions}
              onChange={(v) => setNotif({ ...notif, missions: v })}
            />
            <Row
              label="Paiements"
              description="Confirmations et virements"
              value={notif.payments}
              onChange={(v) => setNotif({ ...notif, payments: v })}
            />
            <Row
              label="Messages"
              description="Nouveaux messages des restaurants"
              value={notif.messages}
              onChange={(v) => setNotif({ ...notif, messages: v })}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveNotif} className="gap-2">
              <Save className="h-4 w-4" />
              Enregistrer
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
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
                      Actif
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        driverSettingsActions.setActivePaymentMethod(m.id);
                        toast.success(`${m.method} définie comme méthode active`);
                      }}
                    >
                      Activer
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="mt-3 w-full gap-2"
              onClick={() => setMethodOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Ajouter une méthode
            </Button>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Fréquence de virement
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {PAYOUT_FREQUENCIES.map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => {
                    driverSettingsActions.setPayoutFrequency(v);
                    toast.success(`Fréquence de virement : ${l}`);
                  }}
                  className={`rounded-xl border p-3 text-sm font-medium transition ${v === settings.payoutFrequency ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecurityPanel description="Protégez vos gains et votre compte livreur." />
          <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Zone dangereuse
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start gap-2 text-rose-500 hover:text-rose-600"
                onClick={() => setSuspendOpen(true)}
              >
                <Zap className="h-4 w-4" />
                Suspendre mon compte
              </Button>
              <Button variant="outline" asChild className="justify-start gap-2">
                <Link to="/login">
                  <LogOut className="h-4 w-4" />
                  Se déconnecter
                </Link>
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une méthode de paiement</DialogTitle>
            <DialogDescription>
              Elle sera utilisée pour vos prochains virements et retraits.
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

      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspendre votre compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous serez mis hors-ligne et déconnecté. Vos missions en cours restent visibles à
              votre prochaine connexion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-500 hover:bg-rose-600" onClick={suspendAccount}>
              Suspendre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: typeof User;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
