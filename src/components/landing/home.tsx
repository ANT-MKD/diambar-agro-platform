import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  Clock,
  FileText,
  KeyRound,
  Leaf,
  Minus,
  Plus,
  ShieldCheck,
  Smartphone,
  Sprout,
  Truck,
} from "lucide-react";
import { AccessCta, Eyebrow, SectionTitle, SoftGlow } from "./ui";

// Page d'accueil du site public : une cible principale (les restaurants),
// des preuves plutôt que des promesses, aucune donnée chiffrée invérifiable.

/* ---------------------------------------------------------------- Accroche */

export function HomeHero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40">
      <SoftGlow />
      <div className="relative mx-auto max-w-5xl px-4 text-center">
        <span className="eyebrow inline-flex rounded-full border border-black/5 bg-white/70 px-4 py-2 text-foreground/80 backdrop-blur">
          Pilote · Dakar · Accès sur demande
        </span>
        <h1 className="display-xl mx-auto mt-7 max-w-4xl text-[3.1rem] sm:text-7xl lg:text-[6.5rem]">
          Vos produits frais, <span className="text-emerald-700">livrés demain matin.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Commandez avant 18&nbsp;h directement aux producteurs sénégalais. Livraison le lendemain,
          preuve de remise et 48&nbsp;h pour vérifier.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
          <AccessCta />
          <Link
            to="/"
            hash="comment"
            className="text-sm font-semibold underline decoration-2 underline-offset-[6px] hover:text-emerald-700"
          >
            Voir comment ça marche
          </Link>
        </div>
        <p className="mx-auto mt-6 max-w-md text-sm text-muted-foreground">
          Gratuit et sans abonnement. Aucun paiement sur cette page : les accès sont ouverts zone
          par zone pendant le pilote.
        </p>
      </div>
      <div className="relative mx-auto mt-14 max-w-5xl px-4">
        <OrderMock />
      </div>
    </section>
  );
}

/** Aperçu fidèle de l'app : une commande suivie de bout en bout. */
function OrderMock() {
  const steps = [
    { label: "Commande passée", time: "Hier · 17:42", state: "done" },
    { label: "Acceptée par Ferme Diallo", time: "Hier · 18:05", state: "done" },
    { label: "En route avec Oumar", time: "08:10", state: "current" },
    { label: "Remise avec votre code", time: "Prévue 08:30", state: "todo" },
  ] as const;
  return (
    <div className="overflow-hidden rounded-[2rem] border border-black/5 bg-white/90 shadow-2xl shadow-emerald-900/10 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
        <div className="text-sm font-semibold">Ma commande · CMD-2847</div>
        <div className="text-sm text-muted-foreground">Le Baobab</div>
      </div>
      <div className="grid md:grid-cols-[0.9fr_1.1fr]">
        <ol className="space-y-1 border-b border-border p-4 sm:p-6 md:border-b-0 md:border-r">
          {steps.map((s) => (
            <li
              key={s.label}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${
                s.state === "current" ? "bg-emerald-100/70" : ""
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${
                  s.state === "done"
                    ? "bg-emerald-700 text-white"
                    : s.state === "current"
                      ? "bg-white text-emerald-700 ring-2 ring-emerald-700"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {s.state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : "•"}
              </span>
              <span className="flex-1 text-left">
                <span className="block text-sm font-semibold">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.time}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="p-5 text-left sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xl font-semibold tracking-tight sm:text-2xl">
              Livraison du jour
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              En route
            </span>
          </div>
          <div className="mt-5 divide-y divide-border text-sm">
            {[
              ["Tomates fraîches", "20 kg", "10 000 FCFA"],
              ["Oignons rouges", "5 kg", "3 000 FCFA"],
              ["Livraison", "Plateau", "1 500 FCFA"],
            ].map(([n, q, p]) => (
              <div key={n} className="flex items-center justify-between gap-3 py-2.5">
                <span>
                  <span className="font-medium">{n}</span>{" "}
                  <span className="text-muted-foreground">· {q}</span>
                </span>
                <span className="tabular-nums">{p}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Sprout className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
            Produit par Moussa · Ferme Diallo, Rufisque
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-neutral-900 p-4 text-white">
              <div className="eyebrow text-emerald-300">Code de remise</div>
              <div className="mt-1 font-mono text-3xl font-bold tracking-[0.3em]">4827</div>
              <div className="mt-1 text-xs text-white/60">À donner au livreur à l'arrivée</div>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <div className="eyebrow text-muted-foreground">Total</div>
              <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">14 500</div>
              <div className="mt-1 text-xs text-muted-foreground">FCFA · payé par Wave</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 01 Résultat */

export function ResultSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <Eyebrow index="01">Le résultat</Eyebrow>
        <SectionTitle>
          Vous commandez le soir.
          <br />
          Vous cuisinez le lendemain.
        </SectionTitle>
        <div className="mt-12 grid overflow-hidden rounded-[2rem] bg-[#12261d] md:grid-cols-[0.9fr_1.1fr]">
          <div className="p-7 text-white sm:p-10">
            <p className="eyebrow text-emerald-300">Preuve · votre livraison</p>
            <h3 className="display-xl mt-4 text-3xl sm:text-4xl">
              Une remise que l'on peut prouver.
            </h3>
            <p className="mt-4 text-white/70">
              Le livreur ne remet la marchandise qu'avec votre code, et prend une photo à l'arrivée.
              Vous gardez 48&nbsp;h pour signaler un produit abîmé ou manquant : la partie concernée
              vous est remboursée.
            </p>
          </div>
          <div className="m-3 rounded-[1.6rem] bg-white p-5 sm:m-4 sm:p-7">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Remise confirmée</div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                <Check className="h-3 w-3" aria-hidden /> Livrée
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
              {[
                { icon: KeyRound, title: "Code 4827", sub: "validé" },
                { icon: Camera, title: "Photo", sub: "jointe" },
                { icon: Clock, title: "08:24", sub: "Oumar" },
              ].map((x) => (
                <div key={x.title} className="rounded-2xl bg-muted/70 px-2 py-4">
                  <x.icon className="mx-auto h-5 w-5 text-emerald-700" aria-hidden />
                  <div className="mt-2 font-semibold">{x.title}</div>
                  <div className="text-muted-foreground">{x.sub}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-emerald-700/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Vous avez jusqu'à demain 08:24 pour signaler un problème.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------- 02 Comment ça marche */

const HOW_STEPS = [
  {
    tab: "Commander",
    title: "Vous commandez avant 18 h",
    text: "Vous choisissez vos produits, le créneau de livraison du lendemain et vous payez par mobile money.",
    see: "Les prix, les frais de livraison et le producteur, avant de valider.",
    sure: "Le stock est réservé pour vous dès la commande.",
  },
  {
    tab: "Préparer",
    title: "Le producteur prépare",
    text: "Le producteur accepte votre commande et la prépare. S'il manque un produit, vous choisissez à l'avance : remplacer ou être remboursé.",
    see: "La confirmation du producteur, en temps réel.",
    sure: "Remboursement automatique de ce qui ne peut pas être fourni.",
  },
  {
    tab: "Livrer",
    title: "Le livreur vous apporte la commande",
    text: "Un livreur vérifié récupère la marchandise avec le code du producteur et vous l'apporte le matin.",
    see: "Le livreur sur la carte et son heure d'arrivée.",
    sure: "La remise se fait seulement avec votre code, photo à l'appui.",
  },
  {
    tab: "Vérifier",
    title: "Vous gardez 48 h pour vérifier",
    text: "Un produit abîmé ou manquant ? Vous le signalez depuis l'app, avec une photo si besoin.",
    see: "Le détail de la commande et votre facture.",
    sure: "La partie concernée vous est remboursée.",
  },
] as const;

export function HowSection() {
  const [active, setActive] = useState(0);
  const step = HOW_STEPS[active];
  return (
    <section id="comment" className="scroll-mt-24 bg-[#12261d] py-20 text-white sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <span className="eyebrow inline-flex rounded-full border border-white/15 px-3 py-1.5 text-white/90">
          <span className="text-emerald-300">02 ·&nbsp;</span>Comment ça marche
        </span>
        <h2 className="display-xl mt-5 text-[2.4rem] sm:text-6xl lg:text-7xl">
          Quatre étapes.
          <br />
          Aucune surprise.
        </h2>
        <div className="mt-12 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]">
          <div
            role="tablist"
            aria-label="Étapes d'une commande"
            className="flex gap-1 overflow-x-auto border-b border-white/10 p-2"
          >
            {HOW_STEPS.map((s, i) => (
              <button
                key={s.tab}
                role="tab"
                aria-selected={active === i}
                onClick={() => setActive(i)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                  active === i ? "bg-white text-neutral-900" : "text-white/75 hover:text-white"
                }`}
              >
                {i + 1} · {s.tab}
              </button>
            ))}
          </div>
          <div className="grid gap-6 p-4 sm:p-8 md:grid-cols-[1fr_1.1fr]">
            <div role="tabpanel" className="rounded-[1.5rem] bg-black/25 p-6">
              <p className="eyebrow text-emerald-300">Étape {active + 1}</p>
              <h3 className="display-xl mt-3 text-3xl">{step.title}</h3>
              <p className="mt-3 text-white/70">{step.text}</p>
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="eyebrow text-emerald-300">Ce que vous voyez</p>
                <p className="mt-1 text-sm text-white/80">{step.see}</p>
              </div>
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="eyebrow text-emerald-300">Ce qui est garanti</p>
                <p className="mt-1 text-sm text-white/80">{step.sure}</p>
              </div>
            </div>
            <ol className="divide-y divide-white/10">
              {HOW_STEPS.map((s, i) => (
                <li key={s.tab}>
                  <button
                    onClick={() => setActive(i)}
                    className="flex w-full items-start gap-4 py-4 text-left"
                  >
                    <span className="eyebrow mt-1 text-emerald-300">0{i + 1}</span>
                    <span className="flex-1">
                      <span className="block font-semibold">{s.title}</span>
                      <span className="mt-0.5 block text-sm text-white/60">{s.text}</span>
                    </span>
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        i < active
                          ? "bg-emerald-400/15 text-emerald-300"
                          : i === active
                            ? "bg-white text-neutral-900"
                            : "border border-white/20 text-white/60"
                      }`}
                    >
                      {i < active ? "Fait" : i === active ? "En cours" : "À venir"}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col justify-between gap-1 border-t border-white/10 px-6 py-4 text-sm sm:flex-row">
            <span className="font-semibold">Commander. Recevoir. Vérifier.</span>
            <span className="text-white/60">
              La même boucle, chaque jour, pour chaque commande.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- 03 Garanties */

const GUARANTEES = [
  {
    value: "18 h",
    label: "Heure limite",
    text: "Commandez jusqu'à 18 h pour être livré le lendemain.",
  },
  { value: "J+1", label: "Livraison", text: "Sur le créneau du matin que vous choisissez." },
  {
    value: "Code",
    label: "Remise sécurisée",
    text: "Rien n'est remis sans votre code, et une photo est prise.",
  },
  {
    value: "48 h",
    label: "Pour vérifier",
    text: "Abîmé ou manquant : la partie concernée est remboursée.",
  },
  { value: "PDF", label: "Facture", text: "Une facture pour chaque commande, dans votre espace." },
  {
    value: "0",
    label: "Abonnement",
    text: "Vous payez les produits et la livraison, rien d'autre.",
  },
] as const;

export function GuaranteesSection() {
  return (
    <section id="garanties" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <Eyebrow index="03">Nos garanties</Eyebrow>
        <SectionTitle>
          Ce que vous pouvez
          <br />
          vérifier vous-même.
        </SectionTitle>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {GUARANTEES.map((g) => (
            <div
              key={g.label}
              className="rounded-[1.6rem] border border-black/5 bg-white p-5 shadow-sm sm:p-7"
            >
              <div className="display-xl text-4xl text-emerald-700 sm:text-5xl">{g.value}</div>
              <div className="mt-3 font-semibold">{g.label}</div>
              <p className="mt-1 text-sm text-muted-foreground">{g.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="eyebrow text-foreground/70">Paiements</span>
          <span>Wave</span>
          <span>Orange Money</span>
          <span>Free Money</span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------ 04 Accompagnement */

export function HumanSection() {
  return (
    <section className="bg-[#ecefe4] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <Eyebrow index="04">L'accompagnement</Eyebrow>
        <SectionTitle>
          Un cadre humain.
          <br />
          Pas une promesse en l'air.
        </SectionTitle>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-[2rem] bg-[#9be7b4] p-7 sm:p-9">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-900 text-sm font-bold text-emerald-300">
              DA
            </div>
            <div className="display-xl mt-6 text-3xl">L'équipe Diambar</div>
            <div className="mt-1 text-sm text-neutral-700">Pilote · Dakar</div>
            <dl className="mt-8 grid grid-cols-2 gap-x-6 text-sm">
              {[
                ["Contact", "WhatsApp et téléphone"],
                ["Langues", "Wolof · Français"],
                ["Démarrage", "Zone par zone"],
                ["Suivi", "Vos premières commandes"],
              ].map(([k, v]) => (
                <div key={k} className="border-t border-neutral-900/15 py-3">
                  <dt className="eyebrow text-neutral-700">{k}</dt>
                  <dd className="mt-1 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex flex-col justify-center rounded-[2rem] bg-[#12261d] p-7 text-white sm:p-9">
            <p className="text-xl font-semibold leading-snug sm:text-2xl">
              Pendant le pilote, nous ouvrons les accès un par un : nous vérifions que votre zone
              est desservie, nous vous appelons et nous suivons vos premières commandes avec vous.
            </p>
            <ol className="mt-8 space-y-3 text-sm text-white/80">
              {[
                "Nous vérifions votre zone et vos besoins.",
                "Nous vous accompagnons à la première commande.",
                "Nous restons joignables si quelque chose ne va pas.",
              ].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="eyebrow mt-0.5 text-emerald-300">0{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------- Producteurs et livreurs */

export function AudiencesSection() {
  const items = [
    {
      icon: Sprout,
      eyebrow: "Vous êtes producteur",
      title: "Vendez votre récolte sans aller au marché.",
      text: "Vous fixez votre prix, vous acceptez les commandes qui vous conviennent et vous êtes payé par mobile money après la livraison.",
      to: "/for-farmers" as const,
      role: "farmer" as const,
    },
    {
      icon: Truck,
      eyebrow: "Vous êtes livreur",
      title: "Des courses près de chez vous, payées au kilomètre.",
      text: "Vous choisissez vos zones et vos horaires. La rémunération de chaque course est affichée avant que vous l'acceptiez.",
      to: "/for-drivers" as const,
      role: "driver" as const,
    },
  ];
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 md:grid-cols-2">
        {items.map((it) => (
          <div
            key={it.role}
            className="flex flex-col rounded-[2rem] border border-black/5 bg-white p-7 shadow-sm sm:p-9"
          >
            <it.icon className="h-7 w-7 text-emerald-700" aria-hidden />
            <p className="eyebrow mt-6 text-foreground/70">{it.eyebrow}</p>
            <h3 className="display-xl mt-3 text-3xl sm:text-4xl">{it.title}</h3>
            <p className="mt-4 text-muted-foreground">{it.text}</p>
            <div className="mt-auto flex flex-wrap items-center gap-5 pt-8">
              <Link
                to="/demande-acces"
                search={{ role: it.role }}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Demander l'accès <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to={it.to}
                className="text-sm font-semibold underline decoration-2 underline-offset-[6px]"
              >
                En savoir plus
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- FAQ */

const HOME_FAQ = [
  {
    q: "Jusqu'à quelle heure puis-je commander ?",
    a: "Jusqu'à 18 h pour être livré le lendemain, sur le créneau du matin de votre choix.",
  },
  {
    q: "Et si des produits sont abîmés ou manquants ?",
    a: "Vous pouvez les refuser à la livraison ou les signaler dans les 48 h depuis l'application. La partie concernée vous est remboursée, sans négociation avec le producteur.",
  },
  {
    q: "Comment se passe le paiement ?",
    a: "Par mobile money : Wave, Orange Money ou Free Money. Les modalités (à la commande ou à la livraison) vous sont présentées à votre inscription.",
  },
  {
    q: "Y a-t-il un abonnement ou des frais cachés ?",
    a: "Aucun abonnement. Vous payez les produits et les frais de livraison, affichés avant de valider votre commande.",
  },
  {
    q: "Livrez-vous dans mon quartier ?",
    a: "Pendant le pilote, nous ouvrons zone par zone en commençant par Dakar. Indiquez votre commune dans la demande d'accès : nous vous dirons si elle est déjà desservie.",
  },
  {
    q: "Pourquoi un accès sur demande ?",
    a: "Pour garantir un service fiable : nous n'ouvrons une zone que lorsque les producteurs et les livreurs sont prêts à la servir correctement.",
  },
  {
    q: "Est-ce que je reçois une facture ?",
    a: "Oui, une facture est disponible pour chaque commande dans votre espace.",
  },
] as const;

export function HomeFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-24 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4">
        <Eyebrow index="05">Questions</Eyebrow>
        <SectionTitle className="!text-5xl sm:!text-6xl">Vos questions.</SectionTitle>
        <div className="mt-10 border-t border-border">
          {HOME_FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="border-b border-border">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left font-semibold"
                >
                  {item.q}
                  {isOpen ? (
                    <Minus className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                </button>
                {isOpen && <p className="-mt-1 pb-5 text-muted-foreground">{item.a}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          D'autres questions ?{" "}
          <Link to="/faq" className="font-semibold text-foreground underline underline-offset-4">
            Toutes les réponses
          </Link>{" "}
          ou{" "}
          <Link
            to="/contact"
            className="font-semibold text-foreground underline underline-offset-4"
          >
            contactez-nous
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Dernier appel */

export function HomeFinalCta() {
  return (
    <section className="px-4 pb-20 sm:pb-28">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-[#d9f5df] via-[#eef6d8] to-[#f8eccf] px-6 py-16 text-center sm:py-24">
        <div className="relative">
          <Leaf className="mx-auto h-7 w-7 text-emerald-700" aria-hidden />
          <h2 className="display-xl mx-auto mt-6 max-w-2xl text-[2.6rem] sm:text-6xl">
            Votre prochaine commande commence ici.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-muted-foreground">
            Deux minutes pour demander l'accès. Aucun paiement à cette étape.
          </p>
          <AccessCta className="mt-8" />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Producteurs vérifiés
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Livreurs vérifiés
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" aria-hidden /> Facture à chaque commande
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" aria-hidden /> Fonctionne sur téléphone
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
