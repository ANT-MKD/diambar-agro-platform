import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Repeat,
  Calendar,
  Wallet,
  ListOrdered,
  Pause,
  Play,
  MoreVertical,
  Copy,
  Ban,
  AlertTriangle,
  Check,
  X,
  SkipForward,
  Plus,
  Minus,
  Trash2,
  Truck,
  Zap,
  Pencil,
  CalendarClock,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  useRecurringOrder,
  useRestaurantOrders,
  useProducts,
  recurringOrderActions,
} from "@/data/store";
import {
  farmers,
  type PriceRuleAction,
  type StockRuleAction,
  type BudgetRuleAction,
  type HolidayRuleAction,
} from "@/data/mocks";
import { frequencyLabel, computeNextOccurrence, itemsSubtotal } from "@/lib/recurring-engine";
import { formatFCFA, relativeTime } from "@/lib/format";
import { OrderStatusBadge } from "@/components/farmer/status-badge";
import { deliveryFeeFor } from "@/data/store";

export const Route = createFileRoute("/restaurant/recurring/$recurringOrderId")({
  head: () => ({ meta: [{ title: "Commande récurrente · Restaurant" }] }),
  component: RecurringDetail,
});

const PAUSE_REASONS = [
  "Fermeture temporaire du restaurant",
  "Stock suffisant",
  "Changement de fournisseur",
  "Autre",
];

function RecurringDetail() {
  const { recurringOrderId } = Route.useParams();
  const navigate = useNavigate();
  const ro = useRecurringOrder(recurringOrderId);
  const products = useProducts();
  const restaurantOrders = useRestaurantOrders();

  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState(PAUSE_REASONS[0]);
  const [pauseUntil, setPauseUntil] = useState("");

  const [addProductId, setAddProductId] = useState("");
  const [editingItems, setEditingItems] = useState(false);
  const [draftItems, setDraftItems] = useState<{ productId: string; qty: number }[]>([]);

  const [calendarCursor, setCalendarCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideItems, setOverrideItems] = useState<{ productId: string; qty: number }[]>([]);

  const priceOf = (id: string) => products.find((p) => p.id === id)?.pricePerKg ?? 0;

  const farmer = ro ? farmers.find((f) => f.id === ro.farmerId) : null;
  const generatedOrders = useMemo(
    () => (ro ? restaurantOrders.filter((o) => ro.generatedOrderIds.includes(o.id)) : []),
    [ro, restaurantOrders],
  );
  const lastOrder = generatedOrders[0] ?? null;

  const projectedOccurrences = useMemo(() => {
    if (!ro || ro.status !== "active" || !ro.nextRunAt) return [];
    const out: Date[] = [];
    let cursor = new Date(ro.nextRunAt);
    for (let i = 0; i < 6; i++) {
      out.push(cursor);
      const next = computeNextOccurrence(ro, cursor);
      if (!next) break;
      cursor = next;
    }
    return out;
  }, [ro]);

  if (!ro)
    return (
      <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
        Commande récurrente introuvable
      </div>
    );

  const total = itemsSubtotal(ro.items, priceOf);
  const deliveryFee = deliveryFeeFor(ro.deliveryAddress);
  const estimatedTotal = total + deliveryFee;

  const STATUS_TONE: Record<typeof ro.status, string> = {
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    ended: "bg-muted text-muted-foreground",
    problem: "bg-rose-500/10 text-rose-500",
  };
  const STATUS_LABEL: Record<typeof ro.status, string> = {
    active: "Active",
    paused: "En pause",
    ended: "Terminée",
    problem: "Avec problème",
  };

  const availableToAdd = products.filter(
    (p) =>
      p.farmerId === ro.farmerId &&
      !ro.items.some((i) => i.productId === p.id) &&
      p.status !== "out",
  );

  const startEditing = () => {
    setDraftItems(ro.items.map((i) => ({ productId: i.productId, qty: i.qty })));
    setEditingItems(true);
  };
  const saveItems = () => {
    recurringOrderActions.update(ro.id, {
      items: draftItems.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        referencePrice: priceOf(i.productId),
      })),
    });
    toast.success("Produits mis à jour");
    setEditingItems(false);
  };

  const nextOccDay = ro.nextRunAt?.slice(0, 10);
  const existingOverride = ro.exceptions.find(
    (e) => e.type === "override" && e.occurrenceDate === nextOccDay,
  );
  const openOverride = () => {
    setOverrideItems(
      (existingOverride?.items ?? ro.items).map((i) => ({ productId: i.productId, qty: i.qty })),
    );
    setOverrideOpen(true);
  };
  const saveOverride = () => {
    recurringOrderActions.overrideNextOccurrence(
      ro.id,
      overrideItems.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        referencePrice: priceOf(i.productId),
      })),
    );
    toast.success("Cette occurrence a été modifiée exceptionnellement");
    setOverrideOpen(false);
  };

  const monthLabel = calendarCursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // lundi=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const markedDays = new Map<string, "generated" | "planned">();
  generatedOrders.forEach((o) => {
    const d = new Date(o.createdAt);
    if (d.getFullYear() === year && d.getMonth() === month)
      markedDays.set(d.toISOString().slice(0, 10), "generated");
  });
  projectedOccurrences.forEach((d) => {
    if (d.getFullYear() === year && d.getMonth() === month)
      markedDays.set(d.toISOString().slice(0, 10), "planned");
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title={ro.name}
        subtitle={farmer?.farm}
        actions={
          <>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/restaurant/recurring">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Link>
            </Button>
            {ro.status === "active" && (
              <Button variant="outline" className="gap-2" onClick={() => setPauseOpen(true)}>
                <Pause className="h-4 w-4" />
                Mettre en pause
              </Button>
            )}
            {ro.status === "paused" && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  recurringOrderActions.resume(ro.id);
                  toast.success("Récurrence réactivée");
                }}
              >
                <Play className="h-4 w-4" />
                Réactiver
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    recurringOrderActions.create({
                      name: `${ro.name} (copie)`,
                      farmerId: ro.farmerId,
                      items: ro.items,
                      frequency: ro.frequency,
                      intervalDays: ro.intervalDays,
                      daysOfWeek: ro.daysOfWeek,
                      createTime: ro.createTime,
                      deliverySlot: ro.deliverySlot,
                      firstRunAt: new Date().toISOString(),
                      end: ro.end,
                      rules: ro.rules,
                      deliveryAddress: ro.deliveryAddress,
                      deliveryMode: ro.deliveryMode,
                      instructions: ro.instructions,
                      paymentMethod: ro.paymentMethod,
                    });
                    toast.success("Commande récurrente dupliquée");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  Dupliquer
                </DropdownMenuItem>
                <ConfirmDialog
                  trigger={
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive"
                    >
                      <Ban className="h-3.5 w-3.5 mr-2" />
                      Annuler
                    </DropdownMenuItem>
                  }
                  title="Annuler cette commande récurrente ?"
                  description="Les commandes déjà générées ne sont pas supprimées et restent dans votre historique."
                  destructive
                  confirmLabel="Annuler la récurrence"
                  onConfirm={() => {
                    recurringOrderActions.cancel(ro.id, "full");
                    toast.success("Commande récurrente annulée");
                  }}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="flex items-center gap-3 text-sm">
        <span
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_TONE[ro.status]}`}
        >
          {STATUS_LABEL[ro.status]}
        </span>
        <span className="text-muted-foreground">
          Dernière exécution :{" "}
          <b className="text-foreground">
            {lastOrder ? relativeTime(lastOrder.createdAt) : "Aucune"}
          </b>
        </span>
        <span className="text-muted-foreground">
          Prochaine exécution :{" "}
          <b className="text-foreground">
            {ro.nextRunAt
              ? new Date(ro.nextRunAt).toLocaleString("fr-FR", {
                  dateStyle: "long",
                  timeStyle: "short",
                })
              : "—"}
          </b>
        </span>
      </div>

      {ro.status === "problem" && ro.pendingAction && (
        <div className="glass rounded-2xl p-4 border border-destructive/40 bg-destructive/5 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm">Action requise</div>
              <div className="text-sm text-muted-foreground mt-0.5">{ro.pendingAction.detail}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                recurringOrderActions.resolvePendingAction(ro.id, "confirm");
                toast.success("Alerte confirmée, commande traitée");
              }}
              className="gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Accepter
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                recurringOrderActions.resolvePendingAction(ro.id, "cancel_occurrence");
                toast.success("Occurrence annulée");
              }}
              className="gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Annuler cette occurrence
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <Calendar className="h-3.5 w-3.5" /> Prochaine commande
          </div>
          <div className="font-bold font-display">
            {ro.nextRunAt
              ? new Date(ro.nextRunAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })
              : "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {ro.nextRunAt
              ? new Date(ro.nextRunAt).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <Repeat className="h-3.5 w-3.5" /> Fréquence
          </div>
          <div className="font-bold font-display text-sm">{frequencyLabel(ro)}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <Wallet className="h-3.5 w-3.5" /> Budget prévu
          </div>
          <div className="font-bold font-display">{formatFCFA(estimatedTotal)}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <ListOrdered className="h-3.5 w-3.5" /> Commandes générées
          </div>
          <div className="font-bold font-display">{ro.generatedOrderIds.length}</div>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">Vue générale</TabsTrigger>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="orders">Commandes générées</TabsTrigger>
          <TabsTrigger value="rules">Règles</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-4 space-y-2">
              <h4 className="font-display font-bold text-sm mb-1">Résumé</h4>
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fréquence</span>
                  <span>{frequencyLabel(ro)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Première commande</span>
                  <span>
                    {new Date(ro.firstRunAt).toLocaleDateString("fr-FR", { dateStyle: "long" })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fin de la récurrence</span>
                  <span>
                    {ro.end.type === "never"
                      ? "Jamais"
                      : ro.end.type === "on_date"
                        ? new Date(ro.end.date).toLocaleDateString("fr-FR")
                        : `Après ${ro.end.count} commandes`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Livraison</span>
                  <span className="inline-flex items-center gap-1">
                    {ro.deliveryMode === "express" ? (
                      <Zap className="h-3 w-3" />
                    ) : (
                      <Truck className="h-3 w-3" />
                    )}
                    {ro.deliverySlot}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paiement</span>
                  <span>{ro.paymentMethod}</span>
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl p-4 space-y-2">
              <h4 className="font-display font-bold text-sm mb-1">
                Suivi des prochaines commandes
              </h4>
              {projectedOccurrences.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucune prochaine commande planifiée.
                </p>
              )}
              <div className="space-y-2">
                {projectedOccurrences.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span>{d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                      Prévue
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4 pt-4">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-display font-bold text-sm">Produits configurés</h4>
              {!editingItems ? (
                <Button size="sm" variant="outline" onClick={startEditing} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Modifier les quantités
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingItems(false)}>
                    Annuler
                  </Button>
                  <Button size="sm" onClick={saveItems}>
                    Enregistrer
                  </Button>
                </div>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Prix actuel</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {editingItems && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(editingItems ? draftItems : ro.items).map((it) => {
                  const p = products.find((x) => x.id === it.productId);
                  return (
                    <TableRow key={it.productId}>
                      <TableCell className="font-medium">{p?.name}</TableCell>
                      <TableCell>
                        {editingItems ? (
                          <div className="inline-flex items-center gap-1 rounded-lg border border-border">
                            <button
                              onClick={() =>
                                setDraftItems((prev) =>
                                  prev.map((d) =>
                                    d.productId === it.productId
                                      ? { ...d, qty: Math.max(1, d.qty - 1) }
                                      : d,
                                  ),
                                )
                              }
                              className="h-7 w-7 grid place-items-center hover:bg-accent"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center text-sm">{it.qty}</span>
                            <button
                              onClick={() =>
                                setDraftItems((prev) =>
                                  prev.map((d) =>
                                    d.productId === it.productId ? { ...d, qty: d.qty + 1 } : d,
                                  ),
                                )
                              }
                              className="h-7 w-7 grid place-items-center hover:bg-accent"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          `${it.qty} ${p?.unit}`
                        )}
                      </TableCell>
                      <TableCell>{formatFCFA(p?.pricePerKg ?? 0)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatFCFA((p?.pricePerKg ?? 0) * it.qty)}
                      </TableCell>
                      {editingItems && (
                        <TableCell>
                          <button
                            onClick={() =>
                              setDraftItems((prev) =>
                                prev.filter((d) => d.productId !== it.productId),
                              )
                            }
                            className="text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {editingItems && availableToAdd.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <select
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm flex-1"
                >
                  <option value="">Ajouter un produit du fournisseur…</option>
                  {availableToAdd.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!addProductId}
                  onClick={() => {
                    setDraftItems((prev) => [...prev, { productId: addProductId, qty: 1 }]);
                    setAddProductId("");
                  }}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="planning" className="space-y-4 pt-4">
          <div className="grid lg:grid-cols-[1fr_280px] gap-4">
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-display font-bold text-sm capitalize">{monthLabel}</h4>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCalendarCursor(new Date(year, month - 1, 1))}
                    className="h-7 w-7 rounded-lg border border-border grid place-items-center"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setCalendarCursor(new Date())}
                    className="px-2 h-7 rounded-lg border border-border text-xs"
                  >
                    Aujourd'hui
                  </button>
                  <button
                    onClick={() => setCalendarCursor(new Date(year, month + 1, 1))}
                    className="h-7 w-7 rounded-lg border border-border grid place-items-center"
                  >
                    ›
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground mb-1">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`e${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const iso = new Date(year, month, day).toISOString().slice(0, 10);
                  const mark = markedDays.get(iso);
                  const isToday = new Date().toISOString().slice(0, 10) === iso;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(iso)}
                      className={`aspect-square rounded-lg flex items-center justify-center text-xs relative ${
                        isToday
                          ? "bg-primary text-primary-foreground font-bold"
                          : mark === "generated"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold"
                            : mark === "planned"
                              ? "bg-blue-500/15 text-blue-500 font-semibold"
                              : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-border flex gap-4 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Commande générée
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Commande prévue
                </span>
              </div>
            </div>
            <div className="glass rounded-2xl p-4">
              <h4 className="font-display font-bold text-sm mb-2">
                {selectedDay
                  ? new Date(selectedDay).toLocaleDateString("fr-FR", { dateStyle: "long" })
                  : "Sélectionnez une date"}
              </h4>
              {selectedDay &&
                markedDays.get(selectedDay) === "generated" &&
                (() => {
                  const order = generatedOrders.find(
                    (o) => o.createdAt.slice(0, 10) === selectedDay,
                  );
                  return order ? (
                    <div className="space-y-2 text-sm">
                      <OrderStatusBadge status={order.status} />
                      <div className="text-xs text-muted-foreground">{formatFCFA(order.total)}</div>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/restaurant/orders/$orderId" params={{ orderId: order.id }}>
                          Voir le détail →
                        </Link>
                      </Button>
                    </div>
                  ) : null;
                })()}
              {selectedDay && markedDays.get(selectedDay) === "planned" && (
                <div className="space-y-1 text-sm">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                    Commande prévue
                  </span>
                  <div className="text-xs text-muted-foreground">{formatFCFA(estimatedTotal)}</div>
                  <div className="text-xs text-muted-foreground">Livraison {ro.deliverySlot}</div>
                </div>
              )}
              {selectedDay && !markedDays.get(selectedDay) && (
                <p className="text-xs text-muted-foreground">Aucune commande ce jour-là.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="pt-4">
          <div className="glass rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commande</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Aucune commande générée pour l'instant.
                    </TableCell>
                  </TableRow>
                )}
                {generatedOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        to="/restaurant/orders/$orderId"
                        params={{ orderId: o.id }}
                        className="font-medium hover:text-primary"
                      >
                        {o.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {relativeTime(o.createdAt)}
                    </TableCell>
                    <TableCell>{formatFCFA(o.total)}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-3 pt-4">
          <RulesPanel ro={ro} />
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <div className="glass rounded-2xl p-4 space-y-3">
            {[...ro.history].reverse().map((h) => (
              <div
                key={h.id}
                className="flex gap-3 text-sm pb-3 border-b border-border last:border-0 last:pb-0"
              >
                <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(h.at).toLocaleString("fr-FR", {
                      dateStyle: "long",
                      timeStyle: "short",
                    })}
                  </div>
                  <div>{h.message}</div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions ponctuelles sur la prochaine occurrence */}
      {ro.status === "active" && ro.nextRunAt && (
        <div className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {existingOverride
              ? "Cette prochaine commande a été modifiée exceptionnellement."
              : `Une exception pour la prochaine commande du ${new Date(ro.nextRunAt).toLocaleDateString("fr-FR", { dateStyle: "long" })} ?`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openOverride}>
              <CalendarClock className="h-3.5 w-3.5" />
              {existingOverride ? "Modifier à nouveau" : "Modifier uniquement cette commande"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                recurringOrderActions.skipNextOccurrence(ro.id, "Fermeture ponctuelle");
                toast.success("Prochaine commande ignorée");
              }}
            >
              <SkipForward className="h-3.5 w-3.5" />
              Sauter la prochaine commande
            </Button>
          </div>
        </div>
      )}

      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mettre la commande en pause</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pourquoi ?</Label>
              <RadioGroup value={pauseReason} onValueChange={setPauseReason}>
                {PAUSE_REASONS.map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <RadioGroupItem value={r} id={r} />
                    <Label htmlFor={r} className="font-normal">
                      {r}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-1.5">
              <Label>Reprendre le (optionnel)</Label>
              <Input
                type="date"
                value={pauseUntil}
                onChange={(e) => setPauseUntil(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Laissez vide pour reprendre manuellement.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                recurringOrderActions.pause(
                  ro.id,
                  pauseReason,
                  pauseUntil ? new Date(pauseUntil).toISOString() : undefined,
                );
                toast.success("Récurrence mise en pause");
                setPauseOpen(false);
              }}
            >
              Mettre en pause
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier uniquement cette commande</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Ces quantités ne s'appliquent qu'à la prochaine commande
            {ro.nextRunAt
              ? ` du ${new Date(ro.nextRunAt).toLocaleDateString("fr-FR", { dateStyle: "long" })}`
              : ""}
            . Les commandes suivantes garderont les quantités habituelles.
          </p>
          <div className="space-y-2">
            {overrideItems.map((it) => {
              const p = products.find((x) => x.id === it.productId);
              return (
                <div key={it.productId} className="flex items-center justify-between gap-3 text-sm">
                  <span>{p?.name}</span>
                  <div className="inline-flex items-center gap-1 rounded-lg border border-border">
                    <button
                      onClick={() =>
                        setOverrideItems((prev) =>
                          prev.map((d) =>
                            d.productId === it.productId
                              ? { ...d, qty: Math.max(1, d.qty - 1) }
                              : d,
                          ),
                        )
                      }
                      className="h-8 w-8 grid place-items-center hover:bg-accent"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-10 text-center">{it.qty}</span>
                    <button
                      onClick={() =>
                        setOverrideItems((prev) =>
                          prev.map((d) =>
                            d.productId === it.productId ? { ...d, qty: d.qty + 1 } : d,
                          ),
                        )
                      }
                      className="h-8 w-8 grid place-items-center hover:bg-accent"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveOverride}>Enregistrer pour cette commande</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RulesPanel({ ro }: { ro: NonNullable<ReturnType<typeof useRecurringOrder>> }) {
  const [rules, setRules] = useState(ro.rules);
  const [editing, setEditing] = useState(false);
  const dirty = JSON.stringify(rules) !== JSON.stringify(ro.rules);

  const save = () => {
    recurringOrderActions.update(ro.id, { rules });
    toast.success("Règles mises à jour");
    setEditing(false);
  };

  return (
    <div className="glass rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-display font-bold text-sm">Automatisations</h4>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRules(ro.rules);
                setEditing(false);
              }}
            >
              Annuler
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty}>
              Enregistrer
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-xs font-semibold text-muted-foreground">Variation de prix</div>
        {editing ? (
          <div className="flex items-center gap-2 text-sm">
            <Input
              type="number"
              value={rules.priceIncreaseThresholdPct}
              onChange={(e) =>
                setRules((r) => ({ ...r, priceIncreaseThresholdPct: Number(e.target.value) }))
              }
              className="w-20"
            />
            <span>% →</span>
            <select
              value={rules.onPriceIncrease}
              onChange={(e) =>
                setRules((r) => ({ ...r, onPriceIncrease: e.target.value as PriceRuleAction }))
              }
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
            >
              <option value="auto_continue">Continuer automatiquement</option>
              <option value="ask_confirmation">Demander confirmation</option>
              <option value="suspend">Suspendre la commande</option>
            </select>
          </div>
        ) : (
          <div className="text-sm">
            Plus de {rules.priceIncreaseThresholdPct}% :{" "}
            <b>
              {rules.onPriceIncrease === "auto_continue"
                ? "Continue automatiquement"
                : rules.onPriceIncrease === "suspend"
                  ? "Suspend la commande"
                  : "Confirmation requise"}
            </b>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-xs font-semibold text-muted-foreground">Produit indisponible</div>
        {editing ? (
          <select
            value={rules.onOutOfStock}
            onChange={(e) =>
              setRules((r) => ({ ...r, onOutOfStock: e.target.value as StockRuleAction }))
            }
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="cancel_item">Annuler uniquement ce produit</option>
            <option value="replace_equivalent">Remplacer par un équivalent</option>
            <option value="cancel_all">Annuler toute la commande</option>
            <option value="ask_confirmation">Demander confirmation</option>
          </select>
        ) : (
          <div className="text-sm">
            <b>
              {rules.onOutOfStock === "ask_confirmation"
                ? "Confirmation requise"
                : rules.onOutOfStock === "cancel_all"
                  ? "Annule toute la commande"
                  : rules.onOutOfStock === "replace_equivalent"
                    ? "Remplace par un équivalent"
                    : "Annule uniquement le produit"}
            </b>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-xs font-semibold text-muted-foreground">Budget</div>
        {editing ? (
          <div className="flex items-center gap-2 text-sm">
            <span>Maximum :</span>
            <Input
              type="number"
              value={rules.maxBudget}
              onChange={(e) => setRules((r) => ({ ...r, maxBudget: Number(e.target.value) }))}
              className="w-32"
            />
            <select
              value={rules.onBudgetExceeded}
              onChange={(e) =>
                setRules((r) => ({ ...r, onBudgetExceeded: e.target.value as BudgetRuleAction }))
              }
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
            >
              <option value="ask_confirmation">Demander confirmation</option>
              <option value="cancel">Annuler</option>
              <option value="reduce_quantities">Réduire les quantités</option>
            </select>
          </div>
        ) : (
          <div className="text-sm">
            Maximum : <b>{formatFCFA(rules.maxBudget)}</b>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-xs font-semibold text-muted-foreground">Jour non ouvré</div>
        {editing ? (
          <select
            value={rules.onNonBusinessDay}
            onChange={(e) =>
              setRules((r) => ({ ...r, onNonBusinessDay: e.target.value as HolidayRuleAction }))
            }
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="day_before">Commander le jour précédent</option>
            <option value="day_after">Commander le jour suivant</option>
            <option value="ask_confirmation">Demander confirmation</option>
          </select>
        ) : (
          <div className="text-sm">
            <b>
              {rules.onNonBusinessDay === "day_before"
                ? "Commande reportée à la veille"
                : rules.onNonBusinessDay === "day_after"
                  ? "Commande reportée au lendemain"
                  : "Confirmation requise"}
            </b>
          </div>
        )}
      </div>
    </div>
  );
}
