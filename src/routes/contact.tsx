import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { PublicShell, PageHero } from "@/components/landing/public-shell";
import { usePublicInfo } from "@/components/landing/use-public-info";
import { telLink, whatsappLink } from "@/lib/public-info-model";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Nous contacter — Diambar Agro" },
      {
        name: "description",
        content: "Une question sur la plateforme, un partenariat ou le support ? Écrivez-nous.",
      },
      { property: "og:title", content: "Nous contacter — Diambar Agro" },
      {
        property: "og:description",
        content: "Support, partenariats et presse : contactez l'équipe Diambar Agro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const ROLES = ["Agriculteur / coopérative", "Restaurant / hôtel", "Livreur", "Partenaire / presse"];

const field =
  "mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-emerald-500";

function ContactPage() {
  const { company } = usePublicInfo();
  const whatsappNumber = company.whatsapp || company.phone;
  const tel = telLink(company.phone);
  const canWhatsapp = !!whatsappLink(whatsappNumber);
  const channels = [
    company.email && {
      icon: Mail,
      label: "Email",
      value: company.email,
      href: `mailto:${company.email}`,
    },
    tel && { icon: Phone, label: "Téléphone", value: company.phone, href: tel },
    canWhatsapp && {
      icon: MessageCircle,
      label: "WhatsApp",
      value: whatsappNumber,
      href: whatsappLink(whatsappNumber)!,
    },
    company.address && { icon: MapPin, label: "Adresse", value: company.address },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href?: string }[];
  const canWrite = !!company.email || canWhatsapp;

  // Le message part depuis la messagerie du visiteur (email ou WhatsApp),
  // déjà rédigé : rien n'est stocké ni envoyé par le site.
  const send = (form: HTMLFormElement, via: "email" | "whatsapp") => {
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const role = String(data.get("role") ?? "");
    const message = String(data.get("message") ?? "").trim();
    const body = `${message}\n\n— ${name} (${role})`;
    if (via === "email") {
      window.location.href = `mailto:${company.email}?subject=${encodeURIComponent(
        `Contact ${company.name} — ${role}`,
      )}&body=${encodeURIComponent(body)}`;
    } else {
      window.open(whatsappLink(whatsappNumber, body)!, "_blank", "noopener,noreferrer");
    }
    toast.success("Votre message est prêt : il ne reste qu'à l'envoyer.");
  };

  return (
    <PublicShell>
      <PageHero
        eyebrow="Contact"
        title="Parlons de votre besoin"
        subtitle="Support, partenariat ou presse : écrivez-nous, nous vous répondons rapidement."
      />
      <section className="pb-24">
        <div className="mx-auto max-w-6xl px-4 grid lg:grid-cols-[1fr_1.4fr] gap-6">
          <div className="space-y-3" data-testid="contact-channels">
            {channels.length === 0 && (
              <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
                Nos coordonnées seront publiées ici très bientôt.
              </div>
            )}
            {channels.map((c) => (
              <div key={c.label} className="glass rounded-2xl p-5 flex items-center gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <c.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {c.label}
                  </p>
                  {c.href ? (
                    <a
                      href={c.href}
                      className="text-sm font-medium hover:text-emerald-600"
                      {...(c.label === "WhatsApp"
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {c.value}
                    </a>
                  ) : (
                    <p className="text-sm font-medium">{c.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {canWrite && (
            <form
              className="glass rounded-3xl p-7 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const submitter = (e.nativeEvent as SubmitEvent)
                  .submitter as HTMLButtonElement | null;
                send(e.currentTarget, submitter?.value === "whatsapp" ? "whatsapp" : "email");
              }}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block text-sm">
                  <span className="font-medium">Nom complet</span>
                  <input required name="name" className={field} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Vous êtes</span>
                  <select name="role" className={field}>
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <span className="font-medium">Message</span>
                <textarea
                  required
                  name="message"
                  rows={6}
                  className={field}
                  placeholder="Décrivez votre besoin…"
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                {company.email && (
                  <button
                    value="email"
                    className="flex-1 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
                  >
                    Envoyer par email
                  </button>
                )}
                {canWhatsapp && (
                  <button
                    value="whatsapp"
                    className={`flex-1 rounded-xl px-5 py-3 text-sm font-semibold transition ${company.email ? "border border-border hover:bg-accent" : "bg-primary text-primary-foreground hover:opacity-90"}`}
                  >
                    Envoyer sur WhatsApp
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Le message s'ouvre dans votre messagerie, prêt à être envoyé.
              </p>
            </form>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
