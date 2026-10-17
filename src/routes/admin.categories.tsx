import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, GitMerge, Pencil, Tags } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/data/catalog";
import { useMarketMode } from "@/data/market-mode";
import { market, type Result } from "@/data/market-remote";
import { relativeTime } from "@/lib/format";
import type { MarketCategory } from "@/lib/market/types";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({ meta: [{ title: "Catégories de produits — Admin Diambar" }] }),
  component: CategoriesPage,
});

// Catégories de produits : celles que les producteurs proposent en créant un
// produit, à garder, renommer ou fusionner avec une autre ; et la liste
// officielle (l'ordre d'affichage se règle dans l'assistant de démarrage).

const notify = (res: Result, success: string) => {
  if (res.ok) toast.success(success);
  else toast.error(res.message);
  return res.ok;
};

function CategoriesPage() {
  const { remote } = useMarketMode();
  const categories = useCategories();
  const proposed = categories.filter((c) => c.status === "proposed");
  const official = categories.filter((c) => c.status === "approved");

  if (!remote) {
    return (
      <div className="space-y-6">
        <PageHeader title="Catégories de produits" />
        <EmptyState
          icon={Tags}
          title="Disponible avec la base de données"
          description="Les catégories proposées par les producteurs se gèrent ici une fois l'application reliée à sa base."
        />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Catégories de produits"
        subtitle="Les producteurs peuvent proposer une catégorie en créant un produit : gardez-la, renommez-la ou fusionnez-la avec une autre."
      />

      <section className="glass space-y-3 rounded-2xl p-5" data-testid="proposed-categories">
        <h2 className="font-semibold">À vérifier ({proposed.length})</h2>
        {proposed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune catégorie proposée en attente.</p>
        ) : (
          <ul className="divide-y divide-border">
            {proposed.map((c) => (
              <CategoryRow key={c.id} category={c} others={categories} />
            ))}
          </ul>
        )}
      </section>

      <section className="glass space-y-3 rounded-2xl p-5" data-testid="official-categories">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Catégories officielles ({official.length})</h2>
          <Link to="/admin/setup" className="text-xs text-primary underline">
            Changer l'ordre d'affichage (assistant, étape Catalogue)
          </Link>
        </div>
        <ul className="divide-y divide-border">
          {official.map((c) => (
            <CategoryRow key={c.id} category={c} others={categories} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function CategoryRow({
  category: c,
  others,
}: {
  category: MarketCategory;
  others: MarketCategory[];
}) {
  const [mode, setMode] = useState<"idle" | "rename" | "merge">("idle");
  const [name, setName] = useState(c.name);
  const [into, setInto] = useState("");
  const [busy, setBusy] = useState(false);
  const targets = others.filter((o) => o.id !== c.id);
  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    const done = await fn();
    setBusy(false);
    if (done) setMode("idle");
  };
  const target = targets.find((t) => t.id === into);

  return (
    <li className="space-y-2 py-3" data-testid="category-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">{c.name}</div>
          <div className="text-xs text-muted-foreground">
            {c.productCount} produit{c.productCount > 1 ? "s" : ""}
            {c.status === "proposed" &&
              ` · proposée par ${c.proposedBy ?? "un producteur"}${c.proposedAt ? `, ${relativeTime(c.proposedAt)}` : ""}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.status === "proposed" && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  notify(await market.approveCategory(c.id), `« ${c.name} » gardée`),
                )
              }
            >
              <Check className="mr-1 h-4 w-4" /> Garder
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setMode("rename")}>
            <Pencil className="mr-1 h-4 w-4" /> Renommer
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMode("merge")}>
            <GitMerge className="mr-1 h-4 w-4" /> Fusionner
          </Button>
        </div>
      </div>
      {mode === "rename" && (
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            aria-label={`Nouveau nom pour ${c.name}`}
          />
          <Button
            size="sm"
            disabled={busy || !name.trim()}
            onClick={() =>
              void run(async () =>
                notify(await market.renameCategory(c.id, name), "Catégorie renommée"),
              )
            }
          >
            Enregistrer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
            Annuler
          </Button>
        </div>
      )}
      {mode === "merge" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Déplacer ses produits dans</span>
            <Select value={into} onValueChange={setInto}>
              <SelectTrigger className="w-56" aria-label={`Fusionner ${c.name} dans`}>
                <SelectValue placeholder="Choisir une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={busy || !into}
              onClick={() =>
                void run(async () => {
                  const res = await market.mergeCategory(c.id, into);
                  return notify(
                    res,
                    `« ${c.name} » fusionnée dans « ${target?.name ?? ""} »${res.ok && res.moved ? ` : ${res.moved} produit(s) déplacé(s)` : ""}`,
                  );
                })
              }
            >
              Fusionner
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
              Annuler
            </Button>
          </div>
          {target && (
            <p className="text-xs text-muted-foreground">
              « {c.name} » disparaîtra ; ses {c.productCount} produit(s) passeront dans «{" "}
              {target.name} » et leurs producteurs seront prévenus.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
