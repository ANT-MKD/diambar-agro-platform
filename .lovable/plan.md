# Plan — Professionnalisation SaaS complète

Objectif : appliquer les 10 piliers SaaS pro et les décisions d'audit sur chaque page Agriculteur et Restaurant, sans casser l'existant. Découpage en 5 phases livrables, exécutées dans l'ordre.

---

## Phase 1 — Fondations invisibles (primitives partagées)

Créer les briques réutilisées partout **avant** de toucher aux pages.

**Composants UX**

- `src/components/common/data-state.tsx` — `<DataState loading empty error>` (skeleton / illustration + CTA / retry / loaded).
- `src/components/common/confirm-dialog.tsx` — wrapper AlertDialog (destructif rouge, titre + description + action).
- `src/components/common/status-badge.tsx` — normalisation stricte (pending/confirmed/preparing/shipped/delivered/cancelled + variantes stock/paiement).
- `src/components/common/empty-state.tsx` — illustration SVG + titre + description + CTA + lien doc.
- `src/components/common/page-error.tsx` — écran d'erreur avec retry.
- `src/components/common/unsaved-guard.tsx` — hook + dialog "modifications non enregistrées".

**Hooks & utils**

- `src/hooks/use-url-filters.ts` — wrapper `useSearch` + `useNavigate` (typé) pour filtres/tri/pagination/tabs.
- `src/hooks/use-optimistic-toast.ts` — pattern optimistic + undo 5s + rollback.
- `src/hooks/use-autosave-draft.ts` — persistance localStorage pour formulaires longs.
- `src/lib/motion.ts` — durations 150/250/400 + easing `[0.4, 0, 0.2, 1]`.
- `src/lib/toast.ts` — helpers `toast.success/error/undo` unifiés.

**Store notifications**

- Migrer `restaurantNotifications` + `notifications` (farmer) vers `src/data/store.ts` avec actions `markRead`, `markAllRead`, `add`.
- Badge non-lu réel dans les 2 sidebars.

**Design system audit**

- Sweep grep : plus aucun `text-white`, `bg-black`, `#hex` en dur dans `src/components/**` et `src/routes/**`. Remplacer par tokens sémantiques.
- Icônes : uniquement Lucide, `h-4 w-4` ou `h-5 w-5`.

---

## Phase 2 — Command Palette + Notifications pro

**Command Palette (⌘K)**

- `src/components/common/command-palette.tsx` monté dans `__root.tsx`.
- Raccourci ⌘K / Ctrl+K global.
- Recherche cross-entités : produits, commandes, fournisseurs, factures, conversations.
- Groupes : Navigation · Actions rapides · Recherche.
- Actions : "Nouveau produit", "Nouveau retrait", "Voir facture…", etc.

**Notifications centre pro**

- `farmer.notifications` et `restaurant.notifications` refactor :
  - Badge non-lu réel branché au store.
  - Groupement par jour (Aujourd'hui / Hier / Cette semaine / Plus ancien).
  - Filtres onglets (Toutes / Commandes / Stock / Paiements / Messages).
  - Clic → deep-link vers l'entité + `markRead(id)`.
  - Préférences par canal (in-app, email, SMS, WhatsApp) branchées au store local.

---

## Phase 3 — Tables & formulaires industrialisés

**DataTable pro**

- `src/components/common/data-table.tsx` (TanStack Table v8) :
  - Header sticky, tri par colonne, sélection multiple, bulk actions.
  - Density switcher (compact/normal/comfortable).
  - Column visibility toggle.
  - Filtres URL via `useUrlFilters`.
  - Export CSV/XLSX/PDF réel (XLSX via `xlsx` skill si dispo, sinon CSV natif + PDF via `invoice-pdf.ts`).
  - Virtualisation `@tanstack/react-virtual` au-delà de 100 lignes.
- Appliquée à : `farmer.products`, `farmer.orders` (vue table), `farmer.revenue.withdrawals`, `restaurant.orders`, `restaurant.suppliers`, `restaurant.invoices`.

**Formulaires unifiés**

- Migration progressive vers `react-hook-form` + `zod` + shadcn `<Form>`.
- Erreurs inline sous chaque champ.
- Autosave draft sur : `farmer.products.new/edit`, `restaurant.recurring`, `restaurant.suppliers.new/edit`.
- Guard "unsaved changes" sur toutes les routes de formulaire.

**Drawer pattern**

- `src/components/common/entity-drawer.tsx` (shadcn Sheet côté droit).
- Utilisé sur `farmer.products` et `farmer.orders` : clic ligne → preview drawer, bouton "Voir en plein écran" → route dédiée.

---

## Phase 4 — Décisions d'audit Agriculteur

| Page          | Changement                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Dashboard     | Period selector (7j/30j/90j) + delta % vs période précédente sur chaque KPI                                 |
| Produits      | DataTable pro + drawer + filtres URL (catégorie, statut) + bulk publish/unpublish/delete                    |
| Stock         | Fusion avec produit dans drawer (onglets : Détails / Stock / Historique / Mouvements)                       |
| Commandes     | Kanban + timer SLA (countdown) + drag & drop entre colonnes (`@dnd-kit`)                                    |
| Revenus       | Reçu PDF par transaction (réutilise `invoice-pdf.ts`) + relevé mensuel PDF                                  |
| Analytics     | Tooltip prédiction ("basé sur X commandes, confiance Y%") + bouton "Exporter rapport PDF"                   |
| Messages      | **Vraie route `$conversationId**` avec UI chat (bulles, input, historique store)                            |
| Notifications | Voir Phase 2                                                                                                |
| Settings      | Éclater en 6 sous-routes : `settings.profile`, `.farm`, `.payments`, `.notifications`, `.security`, `.team` |

**Onboarding**

- `farmer.dashboard` : checklist "Complétez votre profil (3/7)" persistée localStorage, dismissible.

---

## Phase 5 — Décisions d'audit Restaurant

| Page           | Changement                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Dashboard      | Widget "Récurrentes à valider aujourd'hui" en tête + widgets configurables (ordre localStorage) |
| Marketplace    | Comparateur 2-3 produits (route `/restaurant/compare?ids=`) + wishlist (store) + filtres URL    |
| Produit détail | Section avis mockés (étoiles + commentaires) + carrousel "Produits similaires"                  |
| Panier         | Persist localStorage + banner "Reprendre votre panier" sur marketplace                          |
| Checkout       | Sidebar récap sticky + validation Zod stricte par étape                                         |
| Commandes      | Chat direct livreur intégré dans `restaurant.orders.$orderId` (mock temps réel)                 |
| Récurrentes    | Calendrier visuel mensuel + pause/reprise + "skip prochaine livraison"                          |
| Fournisseurs   | Scoring qualité auto (calcul basé sur historique commandes + ponctualité)                       |
| Factures       | Relance auto impayées (badge + CTA) + filtre période fiscale (T1/T2/T3/T4/Année)                |
| Messages       | Vraie route `$conversationId` (idem farmer)                                                     |
| Settings       | Éclater en sous-routes + gestion équipe/rôles (`settings.team` avec invite mock)                |

**Onboarding**

- `restaurant.dashboard` : checklist "Configurez votre restaurant (2/6)".

---

## Section technique

**Dépendances à installer**

- `@tanstack/react-table` — tables pro
- `@tanstack/react-virtual` — virtualisation
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag & drop Kanban
- `date-fns` (si absent) — période selectors
- `cmdk` (déjà via shadcn command) — Command Palette

**Fichiers créés (~40)**

- 8 primitives `src/components/common/*`
- 5 hooks `src/hooks/*`
- 6 sous-routes settings farmer
- 6 sous-routes settings restaurant
- 2 routes `messages.$conversationId` (farmer + restaurant)
- 1 route `restaurant.compare`
- 1 composant SLA timer + 1 composant Kanban drag
- ~10 refactors de routes existantes

**Fichiers modifiés (~25)**

- `src/routes/__root.tsx` (Command Palette + toaster undo)
- `src/data/store.ts` (notifications actions, wishlist, cart persist, drafts, team members, scoring)
- `src/data/mocks.ts` (avis produits, équipe, plus de notifications)
- Toutes les pages listées dans les tableaux audit

**Compatibilité**

- Aucun breaking change sur les mocks existants — extensions uniquement.
- Migration progressive : Phase 1 seule est déjà utilisable (primitives dispo pour tout le monde).

---

## Ordre d'exécution recommandé

1. **Phase 1** (fondations) — 1 tour, invisible mais critique.
2. **Phase 2** (⌘K + notifs) — 1 tour, effet "waouh" immédiat.
3. **Phase 3** (tables + forms + drawer) — 1-2 tours, gros refactor mais standardisé.
4. **Phase 4** (audit Agriculteur) — 1-2 tours.
5. **Phase 5** (audit Restaurant) — 1-2 tours.

Après validation, je démarre par la Phase 1 et la phase 2 (au complet). Confirme "go" pour lancer, ou dis-moi si tu veux réorganiser l'ordre / retirer un item.
