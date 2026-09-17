import { useState } from "react";
import { Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileDrop } from "./file-drop";
import {
  PARTY_LABEL,
  disputeActions,
  type Dispute,
  type DisputeAttachment,
  type DisputeParty,
} from "@/data/disputes";
import { relativeTime } from "@/lib/format";

const TONE: Record<DisputeParty, string> = {
  restaurant: "bg-amber-500/10 border-amber-500/30",
  farmer: "bg-emerald-500/10 border-emerald-500/30",
  driver: "bg-blue-500/10 border-blue-500/30",
  platform: "bg-violet-500/10 border-violet-500/30",
};

export function DisputeThread({
  dispute,
  role,
  name,
  canPostInternal = false,
  readOnly = false,
}: {
  dispute: Dispute;
  role: DisputeParty;
  name: string;
  canPostInternal?: boolean;
  readOnly?: boolean;
}) {
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<DisputeAttachment[]>([]);

  const visible = dispute.messages.filter((m) => !m.internal || canPostInternal);

  return (
    <div id="fil-contradictoire" className="glass rounded-2xl p-5 scroll-mt-4">
      <h2 className="font-semibold">Fil contradictoire</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Restaurant, producteur, livreur et support échangent dans ce dossier.{" "}
        {canPostInternal && "Les notes internes ne sont visibles que par le support."}
      </p>

      <ol className="mt-4 space-y-3">
        {visible.map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border p-3 ${m.internal ? "border-dashed border-muted-foreground/40 bg-muted/40" : TONE[m.authorRole]}`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold">{m.authorName}</span>
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {PARTY_LABEL[m.authorRole]}
              </span>
              {m.internal && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Note interne
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">{relativeTime(m.at)}</span>
            </div>
            <p className="mt-1.5 text-sm">{m.text}</p>
            {m.attachments && m.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.attachments.map((a) =>
                  a.dataUrl && a.mime.startsWith("image/") ? (
                    <img
                      key={a.id}
                      src={a.dataUrl}
                      alt={a.name}
                      className="h-16 w-16 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <span
                      key={a.id}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
                    >
                      {a.name}
                    </span>
                  ),
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {!readOnly && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) {
              toast.error("Message vide");
              return;
            }
            disputeActions.reply(dispute.id, {
              role,
              name,
              text: text.trim(),
              internal,
              attachments: files,
            });
            setText("");
            setFiles([]);
            setInternal(false);
            toast.success(internal ? "Note interne ajoutée" : "Réponse envoyée aux parties");
          }}
        >
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Répondre au dossier, apporter une preuve, contester…"
          />
          <FileDrop
            value={files}
            onChange={setFiles}
            by={name}
            label="Joindre une preuve"
            max={3}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {canPostInternal ? (
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Note interne (invisible pour les parties)
              </label>
            ) : (
              <span />
            )}
            <Button type="submit" className="gap-2">
              <Send className="h-4 w-4" />
              Envoyer
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
