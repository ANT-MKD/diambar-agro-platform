import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { User, Bell, Wallet, Shield, LogOut, Save, Zap, Truck, MapPin, Phone, Mail } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { driverProfile } from "@/data/mocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/driver/settings")({
  head: () => ({ meta: [{ title: "Paramètres · Livreur" }] }),
  component: DriverSettings,
});

function DriverSettings() {
  const [name, setName] = useState(driverProfile.name);
  const [phone, setPhone] = useState(driverProfile.phone);
  const [email, setEmail] = useState(driverProfile.email);
  const [city, setCity] = useState(driverProfile.city);
  const [radius, setRadius] = useState([50]);
  const [notif, setNotif] = useState({ push: true, sms: true, email: false, missions: true, payments: true, messages: true });
  const [autoAccept, setAutoAccept] = useState(false);

  const save = () => toast.success("Paramètres enregistrés");

  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" subtitle="Compte, préférences et sécurité" />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="glass">
          <TabsTrigger value="profile"><User className="h-3.5 w-3.5 mr-1.5" />Profil</TabsTrigger>
          <TabsTrigger value="work"><Truck className="h-3.5 w-3.5 mr-1.5" />Travail</TabsTrigger>
          <TabsTrigger value="notif"><Bell className="h-3.5 w-3.5 mr-1.5" />Notifications</TabsTrigger>
          <TabsTrigger value="payments"><Wallet className="h-3.5 w-3.5 mr-1.5" />Paiements</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-3.5 w-3.5 mr-1.5" />Sécurité</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="glass rounded-2xl p-5 flex items-center gap-4">
            <img src={driverProfile.avatar} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/30" />
            <div className="flex-1">
              <div className="font-semibold">{driverProfile.name}</div>
              <div className="text-xs text-muted-foreground">Livreur depuis {new Date(driverProfile.memberSince).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} · ★ {driverProfile.rating}</div>
            </div>
            <Button variant="outline">Changer la photo</Button>
          </div>
          <div className="glass rounded-2xl p-5 grid sm:grid-cols-2 gap-4">
            <Field icon={User} label="Nom complet" value={name} onChange={setName} />
            <Field icon={Phone} label="Téléphone" value={phone} onChange={setPhone} />
            <Field icon={Mail} label="Email" value={email} onChange={setEmail} />
            <Field icon={MapPin} label="Ville de base" value={city} onChange={setCity} />
          </div>
          <div className="flex justify-end"><Button onClick={save} className="gap-2"><Save className="h-4 w-4" />Enregistrer</Button></div>
        </TabsContent>

        <TabsContent value="work" className="space-y-4">
          <div className="glass rounded-2xl p-5 space-y-4">
            <Row label="Acceptation automatique" description="Accepte les missions correspondant à vos critères" value={autoAccept} onChange={setAutoAccept} />
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold">Rayon d'action</div>
                  <div className="text-xs text-muted-foreground">Distance maximale des missions proposées</div>
                </div>
                <span className="font-mono font-semibold text-primary">{radius[0]} km</span>
              </div>
              <Slider value={radius} onValueChange={setRadius} min={5} max={200} step={5} />
            </div>
          </div>
          <div className="flex justify-end"><Button onClick={save} className="gap-2"><Save className="h-4 w-4" />Enregistrer</Button></div>
        </TabsContent>

        <TabsContent value="notif" className="space-y-4">
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Canaux</div>
            <Row label="Push mobile" description="Notifications en temps réel" value={notif.push} onChange={(v) => setNotif({ ...notif, push: v })} />
            <Row label="SMS" description="Alertes critiques par SMS" value={notif.sms} onChange={(v) => setNotif({ ...notif, sms: v })} />
            <Row label="Email" description="Résumé hebdomadaire" value={notif.email} onChange={(v) => setNotif({ ...notif, email: v })} />
          </div>
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Types</div>
            <Row label="Nouvelles missions" description="Recevoir les propositions en temps réel" value={notif.missions} onChange={(v) => setNotif({ ...notif, missions: v })} />
            <Row label="Paiements" description="Confirmations et virements" value={notif.payments} onChange={(v) => setNotif({ ...notif, payments: v })} />
            <Row label="Messages" description="Nouveaux messages des restaurants" value={notif.messages} onChange={(v) => setNotif({ ...notif, messages: v })} />
          </div>
          <div className="flex justify-end"><Button onClick={save} className="gap-2"><Save className="h-4 w-4" />Enregistrer</Button></div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Méthode de paiement principale</div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 text-primary grid place-items-center font-bold">W</div>
              <div className="flex-1">
                <div className="font-semibold text-sm">Wave</div>
                <div className="text-xs text-muted-foreground">{phone}</div>
              </div>
              <span className="text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5">Actif</span>
            </div>
            <Button variant="outline" className="mt-3 w-full gap-2"><Wallet className="h-4 w-4" />Ajouter une méthode</Button>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Fréquence de virement</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[["daily", "Quotidien"], ["weekly", "Hebdomadaire"], ["manual", "Manuel"]].map(([v, l]) => (
                <button key={v} className={`rounded-xl border p-3 text-sm font-medium transition ${v === "weekly" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}>{l}</button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="glass rounded-2xl p-5 space-y-3">
            <Row label="Vérification en 2 étapes" description="Recommandé pour protéger vos gains" value onChange={() => toast.info("Mock")} />
            <Row label="Notifications de connexion" description="Alerte à chaque nouvelle connexion" value onChange={() => toast.info("Mock")} />
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Zone dangereuse</div>
            <div className="mt-3 flex flex-col gap-2">
              <Button variant="outline" className="justify-start gap-2 text-rose-500 hover:text-rose-600" onClick={() => toast.info("Fonction non disponible en démo")}><Zap className="h-4 w-4" />Suspendre mon compte</Button>
              <Button variant="outline" asChild className="justify-start gap-2"><Link to="/login"><LogOut className="h-4 w-4" />Se déconnecter</Link></Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ icon: Icon, label, value, onChange }: { icon: typeof User; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5"><Icon className="h-3 w-3" />{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
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