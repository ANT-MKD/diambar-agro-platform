import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Star, MapPin, ShieldCheck, Truck, Minus, Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useProduct } from "@/data/store";
import { farmers } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cartActions } from "@/data/store";

export const Route = createFileRoute("/restaurant/marketplace/$productId")({
  head: () => ({ meta: [{ title: "Produit · Marketplace" }] }),
  component: ProductDetail,
});

function ProductDetail() {
  const { productId } = Route.useParams();
  const product = useProduct(productId);
  const [qty, setQty] = useState(1);
  if (!product) return <div className="glass rounded-2xl p-12 text-center text-muted-foreground">Produit introuvable</div>;
  const farmer = farmers.find((f) => f.id === product.farmerId);
  const out = product.stock === 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <Button asChild variant="outline" size="sm" className="gap-2"><Link to="/restaurant/marketplace"><ArrowLeft className="h-4 w-4" />Marketplace</Link></Button>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl overflow-hidden aspect-square">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        </div>
        <div className="space-y-5">
          <div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">{product.category}</span>
            <h1 className="font-display text-3xl font-bold mt-1">{product.name}</h1>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold text-primary">{formatFCFA(product.pricePerKg)}</span>
              <span className="text-sm text-muted-foreground">/ {product.unit}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${out ? "bg-rose-500/10 text-rose-500" : product.status === "low" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>
              {out ? "Rupture" : product.status === "low" ? `Stock bas (${product.stock}${product.unit})` : `${product.stock}${product.unit} disponibles`}
            </span>
            <span className="text-muted-foreground">SKU {product.sku}</span>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Produit local du Sénégal, récolté à maturité par {farmer?.farm}. Livraison sous 24h pour Dakar et 48h pour le reste du pays. Qualité contrôlée à chaque étape.
          </p>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: ShieldCheck, label: "Vérifié" },
              { icon: Truck, label: "Livraison 24h" },
              { icon: Star, label: `${farmer?.rating}/5` },
            ].map((b, i) => (
              <div key={i} className="glass rounded-xl p-3 text-center"><b.icon className="h-5 w-5 mx-auto text-primary" /><div className="text-[11px] mt-1 text-muted-foreground">{b.label}</div></div>
            ))}
          </div>

          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <img src={farmer?.avatar} alt="" className="h-12 w-12 rounded-xl object-cover" />
            <div className="flex-1">
              <div className="font-semibold text-sm">{farmer?.farm}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{farmer?.city} · {farmer?.products} produits</div>
            </div>
            <Button variant="outline" size="sm" asChild><Link to="/restaurant/suppliers">Voir profil</Link></Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-xl border border-border h-12">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-12 w-12 grid place-items-center hover:bg-accent"><Minus className="h-4 w-4" /></button>
              <span className="w-12 text-center font-bold">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="h-12 w-12 grid place-items-center hover:bg-accent"><Plus className="h-4 w-4" /></button>
            </div>
            <Button disabled={out} onClick={() => { cartActions.add(product.id, qty); toast.success(`${qty} ${product.unit} ajouté(s) au panier`); }} className="flex-1 h-12 gap-2 text-base">
              <ShoppingCart className="h-5 w-5" /> Ajouter · {formatFCFA(product.pricePerKg * qty)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}