import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Zap, LogOut, Trash2 } from "lucide-react";
import { SecurityPanel } from "@/components/common/security-panel";
import { driverOnlineActions } from "@/data/store";
import { supportTicketActions } from "@/data/support";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/driver/settings/security")({
  head: () => ({ meta: [{ title: "Sécurité · Paramètres livreur" }] }),
  component: SecuritySettings,
});

function SecuritySettings() {
  const navigate = useNavigate();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const suspendAccount = () => {
    driverOnlineActions.set(false);
    setSuspendOpen(false);
    toast.success("Compte suspendu · vous êtes déconnecté");
    navigate({ to: "/login" });
  };

  const requestDeletion = () => {
    const ticket = supportTicketActions.create({
      subject: "Demande de suppression de compte",
      message: "Le livreur Oumar Ba demande la suppression définitive de son compte Diambar Agro.",
      fromName: "Oumar Ba",
      fromRole: "driver",
      category: "account",
    });
    toast.success(`Demande ${ticket.id.toUpperCase()} envoyée · en attente de traitement`);
    setDeleteOpen(false);
  };

  return (
    <div className="space-y-6">
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
          <Button
            variant="outline"
            className="justify-start gap-2 text-rose-500 hover:text-rose-600"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Demander la suppression du compte
          </Button>
          <Button variant="outline" asChild className="justify-start gap-2">
            <Link to="/login">
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </Link>
          </Button>
        </div>
      </div>

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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Demander la suppression du compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action envoie une demande réelle au support Diambar Agro, qui vérifiera qu'il
              n'y a pas de mission ou de solde en cours avant de la traiter. La suppression n'est
              pas immédiate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-500 hover:bg-rose-600" onClick={requestDeletion}>
              Envoyer la demande
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
