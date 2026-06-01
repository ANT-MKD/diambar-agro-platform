import { createFileRoute, Link } from "@tanstack/react-router";
import { User, Building2, CreditCard, Bell, Shield } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

export const Route = createFileRoute("/restaurant/settings")({
  head: () => ({ meta: [{ title: "Paramètres · Restaurant" }] }),
  component: Settings,
});

const TABS = [
  { id: "profile", label: "Profil", icon: User },
  { id: "establishment", label: "Établissement", icon: Building2 },
  { id: "payments", label: "Paiements", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Sécurité", icon: Shield },
] as const;

function Settings() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("profile");
  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" subtitle="Gérez votre compte restaurant" />
      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        <aside className="glass rounded-2xl p-2 h-fit space-y-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
          <Link to="/login" className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-500/10">Se déconnecter</Link>
        </aside>

        <section className="glass rounded-2xl p-6 space-y-4">
          {tab === "profile" && (
            <>
              <h2 className="font-display text-xl font-bold">Profil restaurant</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>Nom</Label><Input defaultValue="Le Baobab" /></div>
                <div><Label>Type de cuisine</Label><Input defaultValue="Sénégalaise" /></div>
                <div><Label>Téléphone</Label><Input defaultValue="+221 77 123 45 67" /></div>
                <div><Label>Email</Label><Input defaultValue="contact@lebaobab.sn" /></div>
              </div>
            </>
          )}
          {tab === "establishment" && (
            <>
              <h2 className="font-display text-xl font-bold">Établissement</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><Label>Adresse</Label><Input defaultValue="Place de l'Indépendance, Dakar Plateau" /></div>
                <div><Label>Ville</Label><Input defaultValue="Dakar" /></div>
                <div><Label>Capacité</Label><Input defaultValue="80 couverts" /></div>
              </div>
            </>
          )}
          {tab === "payments" && (
            <>
              <h2 className="font-display text-xl font-bold">Méthodes de paiement</h2>
              {["Wave", "Orange Money", "Free Money", "Carte bancaire"].map((m) => (
                <div key={m} className="flex items-center justify-between p-3 rounded-xl border border-border"><span className="font-medium text-sm">{m}</span><Switch defaultChecked={m !== "Carte bancaire"} /></div>
              ))}
            </>
          )}
          {tab === "notifications" && (
            <>
              <h2 className="font-display text-xl font-bold">Préférences notifications</h2>
              {["Mises à jour de commandes", "Promotions & nouveautés", "Stock fournisseurs", "Messages"].map((m) => (
                <div key={m} className="flex items-center justify-between p-3 rounded-xl border border-border"><span className="text-sm">{m}</span><Switch defaultChecked /></div>
              ))}
            </>
          )}
          {tab === "security" && (
            <>
              <h2 className="font-display text-xl font-bold">Sécurité</h2>
              <div className="space-y-3">
                <div><Label>Mot de passe actuel</Label><Input type="password" /></div>
                <div><Label>Nouveau mot de passe</Label><Input type="password" /></div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-border"><span className="text-sm font-medium">Authentification à 2 facteurs</span><Switch /></div>
              </div>
            </>
          )}
          <div className="pt-3"><Button>Enregistrer</Button></div>
        </section>
      </div>
    </div>
  );
}