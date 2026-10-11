import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileDrop } from "@/components/disputes/file-drop";
import type { DisputeAttachment } from "@/data/disputes";
import { DOC_LABEL, docRenewalActions, useDocRenewals, type DocRenewal } from "@/data/store";

/** Envoi d'un document renouvelé (nouvelle échéance + photo) à valider par
 * l'équipe Diambar. */
export function RenewDocButton({ doc }: { doc: DocRenewal["doc"] }) {
  const pending = useDocRenewals().find(
    (r) => r.driverId === "d1" && r.doc === doc && r.status === "pending",
  );
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [photos, setPhotos] = useState<DisputeAttachment[]>([]);
  if (pending) {
    return (
      <div className="mt-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        Renouvellement envoyé · en attente de validation
      </div>
    );
  }
  const submit = () => {
    const result = docRenewalActions.submit({ doc, newExpiry: date, photos });
    if (!result.ok) return toast.error(result.message);
    toast.success("Document envoyé · l'équipe Diambar le vérifie");
    setOpen(false);
    setPhotos([]);
    setDate("");
  };
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="mt-2 w-full h-10 gap-2"
        onClick={() => setOpen(true)}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Renouveler
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renouveler : {DOC_LABEL[doc]}</DialogTitle>
            <DialogDescription>
              Photographiez le nouveau document et indiquez sa date d'expiration. Il sera pris en
              compte dès sa validation par l'équipe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`exp-${doc}`}>
              Nouvelle date d'expiration
            </label>
            <Input
              id={`exp-${doc}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <FileDrop
            value={photos}
            onChange={setPhotos}
            by="Vous"
            kind="photo"
            label="Photo du document"
            accept="image/*,application/pdf"
            max={2}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submit}>Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
