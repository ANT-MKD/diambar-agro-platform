import { KeyRound, Camera } from "lucide-react";
import type { MissionProofPhoto } from "@/data/mocks";

/** Code à 4 chiffres à donner au livreur (enlèvement ou livraison). */
export function HandoverCode({ code, title, hint }: { code: string; title: string; hint: string }) {
  return (
    <div className="glass rounded-2xl p-4 border border-primary/30 bg-primary/5 flex items-center gap-4">
      <KeyRound className="h-6 w-6 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div
        className="font-mono text-3xl font-bold tracking-[0.3em] text-primary"
        aria-label={`Code ${code.split("").join(" ")}`}
      >
        {code}
      </div>
    </div>
  );
}

/** Photos prises par le livreur à la livraison, visibles par toutes les parties. */
export function ProofPhotos({ photos }: { photos?: MissionProofPhoto[] }) {
  if (!photos || photos.length === 0) return null;
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Camera className="h-4 w-4 text-primary" />
        Preuve de livraison
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) =>
          p.dataUrl ? (
            <a key={p.id} href={p.dataUrl} target="_blank" rel="noreferrer">
              <img
                src={p.dataUrl}
                alt={p.name}
                className="aspect-square w-full rounded-lg object-cover border border-border"
              />
            </a>
          ) : (
            <div
              key={p.id}
              className="aspect-square rounded-lg border border-border grid place-items-center text-[10px] text-muted-foreground p-2 text-center break-all"
            >
              {p.name}
            </div>
          ),
        )}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Prise le{" "}
        {new Date(photos[0].at).toLocaleString("fr-FR", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </div>
    </div>
  );
}
