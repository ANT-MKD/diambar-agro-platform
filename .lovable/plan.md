## Objectif

Terminer la **Phase 3 Agriculteur** (Stock, Orders Kanban, Revenue, Analytics, Messages, Settings éclatées), démarrer la **Phase 4 Restaurant** (dashboard + marketplace + cart + checkout + orders), et ajouter des **comptes de démo** sur la page login pour se connecter en 1 clic à chaque rôle.

**Contraintes respectées** : aucun changement au design system (tokens, glass, palette emerald, Sora/Inter), aucun modal CRUD (toutes pages dédiées), code clean/scalable.

---

## 1. Auth démo — connexion 1 clic par rôle

`**src/data/demo-accounts.ts**` (nouveau) — comptes mockés :

```
agriculteur@diambar.sn / demo1234 → /farmer/dashboard
restaurant@diambar.sn  / demo1234 → /restaurant/dashboard
livreur@diambar.sn     / demo1234 → /driver/dashboard
admin@diambar.sn       / demo1234 → /admin/dashboard
```

`**src/routes/login.tsx**` — ajouter sous le formulaire une carte "Comptes de démo" : 4 boutons (Agriculteur 🌾 / Restaurant 🍽️ / Livreur 🚚 / Admin 🛡️). Au clic : remplit email+password + redirige vers le dashboard du rôle. Stocke `{role, email}` dans `localStorage` (clé `diambar.session`) pour usage futur.

---

## 2. Phase 3 — Agriculteur (suite)

dans ajouter produit quand j'appuie dessus il n'affiche rien regle ca aussi

### Stock (4 routes)

- `**farmer.stock.tsx**` : refonte — KPI bento (4), table avec ligne cliquable ouvrant `SidePanel` détail, toolbar (filtres statut/catégorie, recherche, export CSV). Suppression du `AdjustDialog` modal.
- `**farmer.stock.movement.new.tsx**` : formulaire mouvement (type: récolte/perte/casse/transfert, produit, quantité, motif, photo optionnelle). Query params `?productId&type` pré-remplissent.
- `**farmer.stock.$productId.history.tsx**` : timeline des mouvements du produit + KPI (entrées, sorties, solde).
- `**farmer.stock.inventory.tsx**` : page inventaire (table réel vs théorique, écarts auto, validation, export).

### Orders (4 routes)

- `**farmer.orders.tsx**` : refonte avec **toggle Kanban / Liste**. Kanban 4 colonnes (Nouvelle → Confirmée → Préparation → Livrée) avec drag & drop Framer Motion (`Reorder.Group`). Liste = table actuelle.
- `**farmer.orders.$orderId.tsx**` : détail commande (timeline, articles, client, livraison, actions accept/refuse/report).
- `**farmer.orders.$orderId.refuse.tsx**` : formulaire de refus (motif obligatoire, notification client).
- `**farmer.orders.$orderId.report.tsx**` : signalement problème (catégorie, description, photos).

Composant partagé : `**src/components/farmer/order-kanban.tsx**` + `**src/components/farmer/order-card.tsx**`.

### Revenue (3 routes)

- `**farmer.revenue.tsx**` : ajouter widget **Wallet** (solde dispo, en attente, total retiré) + bouton "Retirer". Garder KPI + chart + table.
- `**farmer.revenue.$txId.tsx**` : détail transaction (facture, commission breakdown, lien commande).
- `**farmer.revenue.withdraw.tsx**` : wizard 3 étapes (montant → méthode Wave/Orange Money/Virement → confirmation).
- `**farmer.revenue.withdrawals.tsx**` : historique des retraits.

### Analytics (enrichissement)

- `**farmer.analytics.tsx**` : ajouter `SenegalMap` (pins commandes par région), radar par catégorie, prédictions ruptures, top 5 clients fidèles.

### Messages

- `**farmer.messages.tsx**` : split list/conversation déjà présent — refacto en route imbriquée.
- `**farmer.messages.$conversationId.tsx**` : vue dédiée conversation (deep-linkable, mobile-first).

### Settings éclatées (6 sous-routes)

- `**farmer.settings.tsx**` : devient layout avec tabs verticaux + `<Outlet />`.
- `**farmer.settings.profile.tsx**` — profil
- `**farmer.settings.farm.tsx**` — exploitation, certifications, zones
- `**farmer.settings.payments.tsx**` — Wave/OM/banque
- `**farmer.settings.notifications.tsx**` — préférences canaux
- `**farmer.settings.security.tsx**` — mot de passe, 2FA, sessions
- `**farmer.settings.subscription.tsx**` — plan/facturation

---

## 3. Phase 4 — Restaurant (démarrage)

Layout `**src/routes/restaurant.tsx**` (sidebar miroir agriculteur, badge "🍽️ Restaurant").

**Routes initiales** :

- `**restaurant.dashboard.tsx**` : bento KPI (commandes mois, panier moyen, fournisseurs actifs, économies), sparklines, alertes stock fournisseurs préférés, raccourcis.
- `**restaurant.marketplace.tsx**` : grille produits multi-fermes, filtres (catégorie, région, bio, prix, dispo), recherche, tri.
- `**restaurant.marketplace.$productId.tsx**` : fiche produit + fiche ferme + bouton "Ajouter au panier".
- `**restaurant.cart.tsx**` : panier groupé par ferme, ajustement quantités, sous-totaux, livraison estimée.
- `**restaurant.checkout.tsx**` : wizard 3 étapes (adresse/créneau → paiement Wave/OM/à la livraison → confirmation).
- `**restaurant.orders.tsx**` : liste + toggle Kanban (En cours / Livrée / Annulée).
- `**restaurant.orders.$orderId.tsx**` : détail + tracking SVG (étapes).

**Data** : étendre `src/data/mocks.ts` avec `cartItems`, `restaurantOrders`, `suppliers` favoris. Store `cartStore` dans `src/data/store.ts` (add/remove/clear/quantity).

---

## 4. Détails techniques

- **Store** : étendre `productActions` (déjà OK), ajouter `stockMovementActions`, `withdrawalActions`, `cartActions`.
- **Composants partagés nouveaux** :
  - `src/components/farmer/order-kanban.tsx`
  - `src/components/farmer/order-card.tsx`
  - `src/components/farmer/wallet-widget.tsx`
  - `src/components/restaurant/product-card.tsx`
  - `src/components/restaurant/cart-item.tsx`
  - `src/components/restaurant/order-tracker.tsx`
- **Routing** : TanStack file-based, conventions dot-separated déjà en place. `routeTree.gen.ts` régénéré automatiquement.
- **Aucun changement** à `styles.css`, landing, auth UI (sauf ajout démo accounts dans login).

---

## 5. Récapitulatif fichiers

**Nouveaux (~22)** : 4 stock + 4 orders + 3 revenue + 6 settings + 2 messages + 7 restaurant + 6 composants + 1 demo-accounts.
**Édités (~6)** : `login.tsx`, `farmer.orders.tsx`, `farmer.revenue.tsx`, `farmer.analytics.tsx`, `farmer.settings.tsx`, `data/mocks.ts`, `data/store.ts`.

Confirme et je lance l'implémentation en un seul batch.