import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, LifeBuoy, Siren, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supportTicketActions } from "@/data/support";
import { EMERGENCY_NUMBERS, sendSos, SUPPORT_HOTLINE } from "@/lib/sos";

export const Route = createFileRoute("/driver/settings/help")({
  head: () => ({ meta: [{ title: "Aide & support · Paramètres livreur" }] }),
  component: HelpSettings,
});

const FAQ = [
  {
    q: "Comment accepter une mission ?",
    a: "Ouvrez l'onglet Missions, choisissez une mission « Disponible » et appuyez sur Accepter. Vous pouvez aussi activer l'acceptation automatique dans Travail & disponibilité pour les missions qui respectent vos critères.",
    to: "/driver/missions",
  },
  {
    q: "Comment fonctionne mon portefeuille ?",
    a: "Chaque mission livrée crédite votre portefeuille. Le virement vers votre moyen de paiement principal se fait selon la fréquence choisie dans Paiements (quotidien, hebdomadaire ou manuel).",
    to: "/driver/wallet",
  },
  {
    q: "Comment déclarer une panne ou un problème avec mon véhicule ?",
    a: "Depuis la page Véhicule, utilisez « Signaler un problème » : choisissez le type, la gravité, décrivez la situation et ajoutez des photos si besoin. Vous recevez une référence de suivi (INC-VH-xxx).",
    to: "/driver/vehicle",
  },
  {
    q: "Comment changer de véhicule ?",
    a: "Depuis la page Véhicule, utilisez « Ajouter / remplacer un véhicule ». Votre demande est examinée par l'équipe Diambar Agro ; votre véhicule actuel reste actif jusqu'à la validation.",
    to: "/driver/vehicle",
  },
  {
    q: "Comment fonctionne un litige ?",
    a: "Depuis Litiges, ouvrez un « Nouveau litige » en sélectionnant la mission concernée. Le dossier est suivi étape par étape jusqu'à la décision du support.",
    to: "/driver/disputes",
  },
  {
    q: "Comment signaler un incident pendant une course ?",
    a: "Depuis Incidents, signalez un client absent, un colis refusé ou un autre problème de livraison. Une indemnité éventuelle apparaît ensuite dans votre portefeuille.",
    to: "/driver/incidents",
  },
];

function HelpSettings() {
  const [q, setQ] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const filtered = useMemo(
    () => FAQ.filter((f) => f.q.toLowerCase().includes(q.toLowerCase())),
    [q],
  );

  const sendUrgent = async () => {
    const id = await sendSos({ fromName: "Oumar Ba" });
    toast.success(`Alerte ${id.toUpperCase()} envoyée — l'équipe vous rappelle immédiatement`, {
      description: `Si vous êtes en danger : police ${EMERGENCY_NUMBERS.police}, pompiers ${EMERGENCY_NUMBERS.pompiers}.`,
    });
    window.location.href = `tel:${SUPPORT_HOTLINE.replace(/\s/g, "")}`;
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold">Centre d'aide</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une question…"
            className="pl-9"
          />
        </div>
        <div className="divide-y divide-border">
          {filtered.map((f) => (
            <details key={f.q} className="group py-3">
              <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium list-none">
                {f.q}
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-open:rotate-90" />
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              <Link
                to={f.to}
                className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
              >
                Ouvrir la page concernée →
              </Link>
            </details>
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune question trouvée.
            </p>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">Contacter le support</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Notre équipe support est disponible pour vous aider.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={sendUrgent}
          >
            <Siren className="h-4 w-4" />
            Situation urgente
          </Button>
          <Button className="gap-2" onClick={() => setSupportOpen(true)}>
            <LifeBuoy className="h-4 w-4" />
            Contacter le support
          </Button>
        </div>
      </div>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Contacter le support</DialogTitle>
            <DialogDescription>
              Votre message crée un ticket réel suivi par l'équipe support Diambar.
            </DialogDescription>
          </DialogHeader>
          <SupportTicketForm
            role="driver"
            fromName="Oumar Ba"
            onCreated={() => setSupportOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
