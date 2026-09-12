import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, CreditCard, Warehouse, Star, MessageSquare } from "lucide-react";
import { relativeTime } from "@/lib/format";

type Event = {
  id: string;
  type: "order" | "payment" | "stock" | "review" | "message";
  title: string;
  body: string;
  at: string;
};

const ICONS = {
  order: ShoppingBag,
  payment: CreditCard,
  stock: Warehouse,
  review: Star,
  message: MessageSquare,
};
const TONES = {
  order: "bg-blue-500/10 text-blue-500",
  payment: "bg-emerald-500/10 text-emerald-500",
  stock: "bg-amber-500/10 text-amber-500",
  review: "bg-yellow-500/10 text-yellow-500",
  message: "bg-rose-500/10 text-rose-500",
};

const initial: Event[] = [
  {
    id: "e1",
    type: "order",
    title: "Nouvelle commande",
    body: "Le Baobab · 56 000 FCFA",
    at: new Date(Date.now() - 2 * 60000).toISOString(),
  },
  {
    id: "e2",
    type: "payment",
    title: "Paiement reçu",
    body: "Wave · +50 400 FCFA",
    at: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    id: "e3",
    type: "stock",
    title: "Stock mis à jour",
    body: "Tomates +50 kg",
    at: new Date(Date.now() - 60 * 60000).toISOString(),
  },
  {
    id: "e4",
    type: "review",
    title: "Avis reçu ★ 5",
    body: "Restaurant Téranga",
    at: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
  {
    id: "e5",
    type: "message",
    title: "Nouveau message",
    body: "Chez Aminata",
    at: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
];

const samples: Omit<Event, "id" | "at">[] = [
  { type: "order", title: "Nouvelle commande", body: "Chez Aminata · 38 200 FCFA" },
  { type: "payment", title: "Paiement reçu", body: "Orange Money · +22 400 FCFA" },
  { type: "stock", title: "Stock faible", body: "Oignons : 18 kg restants" },
  { type: "review", title: "Avis reçu ★ 4", body: "Le Baobab" },
];

export function LiveFeed() {
  const [events, setEvents] = useState<Event[]>(initial);

  useEffect(() => {
    const t = setInterval(() => {
      const s = samples[Math.floor(Math.random() * samples.length)];
      setEvents((arr) =>
        [{ ...s, id: `e${Date.now()}`, at: new Date().toISOString() }, ...arr].slice(0, 10),
      );
    }, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Activité récente</h3>
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live
        </div>
      </div>
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {events.slice(0, 8).map((e) => {
            const Icon = ICONS[e.type];
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3"
              >
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONES[e.type]}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{e.body}</div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 mt-1">
                  {relativeTime(e.at)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
