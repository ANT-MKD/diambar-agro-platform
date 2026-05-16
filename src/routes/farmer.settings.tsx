import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PasswordStrength } from "@/components/auth/password-strength";
import { cities } from "@/data/mocks";

export const Route = createFileRoute("/farmer/settings")({
  head: () => ({ meta: [{ title: "Paramètres · Diambar Agro" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" subtitle="Gérez votre compte et votre exploitation" />
      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="farm">Exploitation</TabsTrigger>
          <TabsTrigger value="payment">Paiement</TabsTrigger>
          <TabsTrigger value="security">Sécurité</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="farm"><FarmTab /></TabsContent>
        <TabsContent value="payment"><PaymentTab /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
        <TabsContent value="notifications"><NotifTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ title, description, children, onSave }: { title: string; description?: string; children: React.ReactNode; onSave?: () => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave?.(); toast.success("Modifications enregistrées"); }} className="glass rounded-2xl p-6 space-y-5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
      <div className="flex justify-end"><Button type="submit">Enregistrer</Button></div>
    </form>
  );
}

function ProfileTab() {
  const [form, setForm] = useState({ firstName: "Mamadou", lastName: "Diallo", email: "mamadou@diallo-farm.sn", phone: "77 123 45 67", lang: "fr", bio: "Producteur de tomates et oignons depuis 2015 à Thiès." });
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });
  return (
    <Card title="Informations personnelles" description="Visibles par les restaurants partenaires.">
      <div className="flex items-center gap-4">
        <img src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200" alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/30" />
        <div>
          <Button type="button" variant="outline" size="sm">Changer la photo</Button>
          <p className="text-xs text-muted-foreground mt-2">JPG ou PNG, max 2 Mo</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <FieldRow label="Prénom"><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></FieldRow>
        <FieldRow label="Nom"><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></FieldRow>
      </div>
      <FieldRow label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></FieldRow>
      <FieldRow label="Téléphone">
        <div className="flex gap-2">
          <span className="inline-flex items-center rounded-md border border-input bg-muted px-3 text-sm">🇸🇳 +221</span>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </FieldRow>
      <FieldRow label="Langue préférée">
        <Select value={form.lang} onValueChange={(v) => set("lang", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fr">Français</SelectItem>
            <SelectItem value="wo">Wolof</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Bio"><Textarea rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} /></FieldRow>
    </Card>
  );
}

function FarmTab() {
  const [form, setForm] = useState({ name: "Ferme Diallo", city: "Thiès", address: "Route de Khombole, km 3", size: "5.5", types: ["Légumes", "Tubercules"] });
  const toggle = (t: string) => setForm({ ...form, types: form.types.includes(t) ? form.types.filter((x) => x !== t) : [...form.types, t] });
  return (
    <Card title="Exploitation" description="Détails de votre exploitation agricole.">
      <FieldRow label="Nom de l'exploitation"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FieldRow>
      <div className="grid sm:grid-cols-2 gap-4">
        <FieldRow label="Ville">
          <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Superficie (ha)"><Input type="number" step="0.1" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></FieldRow>
      </div>
      <FieldRow label="Adresse précise"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></FieldRow>
      <FieldRow label="Types de produits">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {["Légumes", "Fruits", "Volaille", "Viande", "Céréales", "Tubercules", "Épices"].map((t) => (
            <label key={t} className={`rounded-xl border px-3 py-2.5 flex items-center gap-2 text-sm cursor-pointer ${form.types.includes(t) ? "border-primary bg-primary/5" : "border-border"}`}>
              <input type="checkbox" checked={form.types.includes(t)} onChange={() => toggle(t)} className="rounded" />{t}
            </label>
          ))}
        </div>
      </FieldRow>
    </Card>
  );
}

function PaymentTab() {
  const [form, setForm] = useState({ wave: "77 123 45 67", orange: "78 200 33 44", free: "", primary: "wave" });
  return (
    <Card title="Méthodes de paiement" description="Comptes mobile money pour recevoir vos paiements.">
      <FieldRow label="Wave"><Input value={form.wave} onChange={(e) => setForm({ ...form, wave: e.target.value })} placeholder="Numéro Wave" /></FieldRow>
      <FieldRow label="Orange Money"><Input value={form.orange} onChange={(e) => setForm({ ...form, orange: e.target.value })} placeholder="Numéro Orange Money" /></FieldRow>
      <FieldRow label="Free Money"><Input value={form.free} onChange={(e) => setForm({ ...form, free: e.target.value })} placeholder="Numéro Free Money" /></FieldRow>
      <FieldRow label="Méthode par défaut">
        <Select value={form.primary} onValueChange={(v) => setForm({ ...form, primary: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="wave">Wave</SelectItem>
            <SelectItem value="orange">Orange Money</SelectItem>
            <SelectItem value="free">Free Money</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
    </Card>
  );
}

function SecurityTab() {
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [twoFa, setTwoFa] = useState(false);
  const save = () => {
    if (pwd.next !== pwd.confirm) { toast.error("Les mots de passe ne correspondent pas"); return; }
  };
  return (
    <Card title="Sécurité" description="Protégez votre compte." onSave={save}>
      <FieldRow label="Mot de passe actuel"><Input type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} /></FieldRow>
      <FieldRow label="Nouveau mot de passe">
        <Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
        <PasswordStrength value={pwd.next} />
      </FieldRow>
      <FieldRow label="Confirmer"><Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></FieldRow>
      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <div>
          <div className="text-sm font-medium">Authentification à 2 facteurs</div>
          <div className="text-xs text-muted-foreground">Recevez un code SMS à chaque connexion</div>
        </div>
        <Switch checked={twoFa} onCheckedChange={setTwoFa} />
      </div>
    </Card>
  );
}

function NotifTab() {
  const [s, setS] = useState({ orders: true, payments: true, messages: true, marketing: false });
  return (
    <Card title="Notifications" description="Choisissez ce dont vous voulez être averti.">
      {Object.entries({ orders: "Nouvelles commandes", payments: "Paiements reçus", messages: "Nouveaux messages", marketing: "Offres et nouveautés" }).map(([k, label]) => (
        <div key={k} className="flex items-center justify-between rounded-xl border border-border p-3">
          <div className="text-sm font-medium">{label}</div>
          <Switch checked={s[k as keyof typeof s]} onCheckedChange={(v) => setS({ ...s, [k]: v })} />
        </div>
      ))}
    </Card>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
