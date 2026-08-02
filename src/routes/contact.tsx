import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { PublicShell, PageHero } from "@/components/landing/public-shell";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Nous contacter — Diambar Agro" },
      { name: "description", content: "Une question sur la plateforme, un partenariat ou le support ? Écrivez-nous, réponse sous 24h ouvrées." },
      { property: "og:title", content: "Nous contacter — Diambar Agro" },
      { property: "og:description", content: "Support, partenariats et presse : contactez l'équipe Diambar Agro à Dakar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const channels = [
  { icon: Mail, label: "Email", value: "contact@diambar-agro.sn" },
  { icon: Phone, label: "Téléphone", value: "+221 77 000 00 00" },
  { icon: MessageCircle, label: "WhatsApp", value: "+221 78 111 11 11" },
  { icon: MapPin, label: "Bureau", value: "Sacré-Cœur 3, Dakar, Sénégal" },
];

function ContactPage() {
  const [sending, setSending] = useState(false);
  return (
    <PublicShell>
      <PageHero eyebrow="Contact" title="Parlons de votre besoin" subtitle="Support, partenariat ou presse — nous répondons sous 24h ouvrées." />
      <section className="pb-24">
        <div className="mx-auto max-w-6xl px-4 grid lg:grid-cols-[1fr_1.4fr] gap-6">
          <div className="space-y-3">
            {channels.map((c) => (
              <div key={c.label} className="glass rounded-2xl p-5 flex items-center gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500"><c.icon className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                  <p className="text-sm font-medium">{c.value}</p>
                </div>
              </div>
            ))}
          </div>
          <form
            className="glass rounded-3xl p-7 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSending(true);
              setTimeout(() => {
                setSending(false);
                (e.target as HTMLFormElement).reset();
                toast.success("Message envoyé — nous revenons vers vous sous 24h.");
              }, 700);
            }}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="font-medium">Nom complet</span>
                <input required name="name" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-emerald-500" placeholder="Awa Diop" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Email</span>
                <input required type="email" name="email" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-emerald-500" placeholder="awa@restaurant.sn" />
              </label>
            </div>
            <label className="block text-sm">
              <span className="font-medium">Vous êtes</span>
              <select name="role" className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-emerald-500">
                <option>Agriculteur / coopérative</option>
                <option>Restaurant / hôtel</option>
                <option>Livreur</option>
                <option>Partenaire / presse</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Message</span>
              <textarea required name="message" rows={6} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-emerald-500" placeholder="Décrivez votre besoin…" />
            </label>
            <button disabled={sending} className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-60">
              {sending ? "Envoi…" : "Envoyer le message"}
            </button>
          </form>
        </div>
      </section>
    </PublicShell>
  );
}