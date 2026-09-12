import { useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DisputeAttachment } from "@/data/disputes";

type Props = {
  value: DisputeAttachment[];
  onChange: (files: DisputeAttachment[]) => void;
  by: string;
  kind?: DisputeAttachment["kind"];
  label?: string;
  accept?: string;
  max?: number;
};

/** Upload réel (state + aperçu + persistance dataURL) — remplace les <input type=file> décoratifs. */
export function FileDrop({
  value,
  onChange,
  by,
  kind = "other",
  label = "Pièces jointes",
  accept = "image/*,application/pdf",
  max = 5,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    const next: DisputeAttachment[] = [];
    for (const f of Array.from(files).slice(0, max - value.length)) {
      const dataUrl =
        f.size < 1_500_000
          ? await new Promise<string>((res) => {
              const r = new FileReader();
              r.onload = () => res(String(r.result));
              r.readAsDataURL(f);
            })
          : undefined;
      next.push({
        id: `at_${Date.now()}_${next.length}`,
        name: f.name,
        size: f.size,
        mime: f.type || "application/octet-stream",
        kind,
        dataUrl,
        at: new Date().toISOString(),
        by,
      });
    }
    onChange([...value, ...next]);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">
        {label}{" "}
        <span className="text-xs text-muted-foreground">
          ({value.length}/{max})
        </span>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition ${over ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground text-center">
          Glissez vos fichiers ou cliquez · JPG, PNG, PDF · max 5 Mo
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => {
            handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {value.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {value.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-xl border border-border p-2">
              {f.dataUrl && f.mime.startsWith("image/") ? (
                <img src={f.dataUrl} alt={f.name} className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                  {f.mime.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{f.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {(f.size / 1024).toFixed(0)} Ko
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((x) => x.id !== f.id));
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
