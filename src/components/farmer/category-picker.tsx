import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/data/catalog";
import { categoryNameProblem, sameCategory, similarCategories } from "@/lib/category-name";

const OTHER = "__autre__";

/** Choix de la catégorie d'un produit, ou proposition d'une nouvelle :
 * une catégorie existante écrite autrement est reprise, les catégories
 * proches sont suggérées avant d'en créer une. */
export function CategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const categories = useCategories();
  const known = sameCategory(value, categories);
  const [proposing, setProposing] = useState(!!value && !known);
  const [draft, setDraft] = useState(!known ? value : "");

  const twin = draft ? sameCategory(draft, categories) : null;
  const close = draft && !twin ? similarCategories(draft, categories) : [];
  const problem = draft && !twin ? categoryNameProblem(draft) : null;

  const pick = (name: string) => {
    setProposing(false);
    setDraft("");
    onChange(name);
  };

  return (
    <div className="space-y-2" data-testid="category-picker">
      <Select
        value={proposing ? OTHER : (known?.name ?? "")}
        onValueChange={(v) => {
          if (v === OTHER) {
            setProposing(true);
            onChange(draft);
          } else pick(v);
        }}
      >
        <SelectTrigger aria-label="Catégorie">
          <SelectValue placeholder="Choisir une catégorie" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.name}>
              {c.name}
            </SelectItem>
          ))}
          <SelectItem value={OTHER}>Autre : proposer une catégorie…</SelectItem>
        </SelectContent>
      </Select>
      {proposing && (
        <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
          <Input
            autoFocus
            value={draft}
            maxLength={40}
            onChange={(e) => {
              setDraft(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="Ex. Champignons, Produits laitiers…"
            aria-label="Nouvelle catégorie"
          />
          {twin ? (
            <p className="text-xs text-muted-foreground">
              Cette catégorie existe déjà : « {twin.name} » sera utilisée.
            </p>
          ) : close.length > 0 ? (
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" aria-hidden /> Vouliez-vous dire :
              </p>
              <div className="flex flex-wrap gap-1.5">
                {close.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick(c.name)}
                    className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {problem ? (
            <p className="text-xs text-destructive">{problem}</p>
          ) : (
            !twin && (
              <p className="text-xs text-muted-foreground">
                Elle sera créée à l'enregistrement du produit et vérifiée par l'équipe Diambar.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
