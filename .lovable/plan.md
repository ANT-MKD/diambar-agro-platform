## Analyse des deux prompts

Oui, **combiner les deux est la bonne décision**. Ils sont complémentaires, pas contradictoires :

- **Prompt 1** = exhaustivité fonctionnelle (tous les champs, tous les écrans, toute la logique métier : SKU, code-barres, inventaire, wallet Wave/OM, retraits, certifications bio…).
- **Prompt 2** = direction UX/structure 2026 (bento grid, sparklines, Kanban drag&drop, panels coulissants, vue Kanban↔Liste, live feed).

Stratégie retenue : **garder la richesse fonctionnelle du prompt 1**, **adopter les patterns UX du prompt 2** (bento, Kanban, sparklines, panel latéral), **sans toucher au design system actuel** (tokens sémantiques, glass, fonts Sora/Inter, palette emerald — déjà en place). Pas de refonte visuelle, uniquement ajout de structure et de pages.

Règle transverse : **plus aucun modal pour le CRUD**. Tout passe par des routes dédiées (`/new`, `/$id`, `/$id/edit`, `/$id/history`, etc.).

---

## Ce qu'on ajoute aux CRUDs (synthèse pré-plan)

**Produits** : page détail produit (vue publique interne), page édition séparée de création, page d'import Excel avec mapping colonnes + preview, page brouillons, gestion multi-photos (jusqu'à 5) avec photo principale, code-barres, SKU auto/manuel, prix min négociable, quantité min commande, date de disponibilité, lieu de collecte, certif bio, notes internes, toggle catalogue public, commandes récurrentes.

**Stock** : page mouvement (entrée/sortie/ajustement) dédiée au lieu de modal, page historique par produit (timeline complète + filtres), page inventaire complet (saisie réel vs théorique, écarts auto, export Excel, validation), alertes seuils configurables.

**Commandes** : **vue Kanban drag&drop** (4 colonnes statut) + **vue Liste** togglable, page détail commande complète (timeline statuts, livreur, adresse, note resto, produits ligne par ligne, actions contextuelles selon statut), page "refus" avec raison obligatoire, page "signaler un problème".

**Revenus** : page transaction détail, page retrait (Wave/OM/Free/bancaire) avec leurs vraies icone ou genere, page historique des retraits, sélecteur période personnalisée, export Excel paramétrable.

**Analytics** : ajouts vs existant — carte Sénégal SVG ou autre avec pins restaurants, radar par catégorie, prévisions ruptures, top clients fidélité (% récurrent vs nouveau).

**Messages** : page conversation dédiée par `/$id`, panel infos contact + commandes liées à droite, indicateur "en train d'écrire", search conversations.

**Notifications** : déjà OK, ajouter page paramètres notifications par canal (email/SMS/push/in-app).

**Paramètres** : ne pas modifier (soit ameliorer )

---

## Plan d'implémentation

### Bloc A — Refactor structurel agriculteur (sans toucher au design)

1. **Sidebar** : ajouter sections labels ("NAVIGATION" / "COMPTE"), badge rôle "🌾 Agriculteur" sous le logo, garder largeur/couleurs/glass actuelles.
2. **Header** : ajouter breadcrumb dynamique (depuis `useRouterState`), search global (`Ctrl+K` visuel), dropdown profil sur l'avatar.
3. **Bottom nav mobile** : 5 icônes (Dashboard, Produits, Commandes, Messages, Plus) — visible `lg:hidden`.

### Bloc B — Dashboard amélioré

4. Convertir la grille KPI en **bento 4 colonnes** avec :
  - **Sparklines Recharts** dans chaque KPI (revenus = area, commandes = bar, produits = progress circle SVG, note = stars row).
  - Tabs 7J/30J/12M sur le chart revenus (déjà partiel).
  - "Activité récente" avec **dot pulsant Live** + auto-push d'un event toutes les 30s (setInterval simulé).

### Bloc C — CRUD Produits (pages dédiées, suppression du modal)

5. `/farmer/products` : liste + toolbar (search, tabs, filtres catégorie/tri, toggle grille/liste). Suppression du `ProductFormDialog`.
6. `/farmer/products/new` : formulaire 2 colonnes complet (tous les champs prompt 1) + **preview card live** à droite + upload multi-photos drag&drop.
7. `/farmer/products/$id` : page détail (photos carousel, stats, commandes liées).
8. `/farmer/products/$id/edit` : même form que `/new` préremplie.
9. `/farmer/products/import` : upload Excel, mapping colonnes, preview, validation.

### Bloc D — CRUD Stock (pages dédiées)

10. `/farmer/stock` : table + 3 KPI + clic ligne ouvre **panel latéral coulissant** (Framer Motion) avec historique.
11. `/farmer/stock/movement/new?productId=&type=in|out|adjust` : page dédiée (remplace les modals).
12. `/farmer/stock/$productId/history` : timeline complète + filtres date/type.
13. `/farmer/stock/inventory` : saisie réel vs théorique, écarts auto, export, validation.

### Bloc E — CRUD Commandes (Kanban + pages)

14. `/farmer/orders` : **vue Kanban** par défaut (4 colonnes draggables, totaux FCFA en header) + **toggle vue Liste**. Drag&drop via Framer Motion `Reorder` / `drag`.
15. `/farmer/orders/$id` : page détail (timeline statuts, produits, livreur, adresse, note, actions contextuelles).
16. `/farmer/orders/$id/refuse` : page refus avec raison obligatoire.
17. `/farmer/orders/$id/report` : signaler un problème.

### Bloc F — CRUD Revenus

18. `/farmer/revenue` : KPI + chart + table transactions + section wallet.
19. `/farmer/revenue/$txId` : détail transaction.
20. `/farmer/revenue/withdraw` : wizard retrait (choix méthode → montant → confirmation).
21. `/farmer/revenue/withdrawals` : historique retraits.

### Bloc G — Analytics enrichies

22. Ajouter sur `/farmer/analytics` : **carte Sénégal SVG ou autres** avec pins restaurants (régions principales), radar par catégorie, prévisions ruptures (liste), top clients avec fidélité.

### Bloc H — Messages

23. `/farmer/messages` : layout 3 colonnes (liste / chat / panel infos).
24. `/farmer/messages/$id` : route dédiée par conversation, "en train d'écrire" simulé.

### Bloc I — Paramètres éclatés en sous-routes

25. `/farmer/settings` redirige vers `/farmer/settings/profile`.
26. Sous-routes : `profile`, `farm`, `payments`, `notifications`, `security`, `subscription`. Tabs verticaux à gauche (déjà cohérent avec design actuel).

### Bloc J — Données mock étendues

27. Étendre `src/data/mocks.ts` : `stockMovements`, `transactions` détaillées, `withdrawals`, `wallets`, `topRestaurantsClients`, `geoPins`, plus de produits/commandes pour peupler les Kanban et tables.

---

## Phase 4 — Espace Restaurant (créée dans la foulée)

Même philosophie : pages dédiées pour tous les CRUDs, design system identique, sidebar avec badge rôle "🍽️ Restaurant".

**Routes prévues** :

- `/restaurant/dashboard` — bento KPI (commandes du jour, dépenses mois, fournisseurs actifs, économies vs marché), top fournisseurs, livraisons en cours.
- `/restaurant/marketplace` — catalogue produits (grille, filtres catégorie/prix/distance/bio, search, tri).
- `/restaurant/marketplace/$productId` — fiche produit + agriculteur + bouton "Ajouter au panier".
- `/restaurant/cart` — panier multi-fournisseurs (groupé par agriculteur), récap, frais livraison, total.
- `/restaurant/checkout` — wizard 3 étapes (adresse → mode paiement Wave/OM/Carte/Cash → confirmation).
- `/restaurant/orders` — liste + tabs statuts + filtres.
- `/restaurant/orders/$id` — détail commande + **tracking livraison live** (carte SVG avec position livreur animée).
- `/restaurant/orders/$id/review` — laisser un avis (note + commentaire par produit).
- `/restaurant/recurring` — commandes récurrentes (CRUD : créer/éditer/pauser).
- `/restaurant/recurring/new` & `/$id/edit` — formulaire (produits, fréquence, jour, adresse).
- `/restaurant/favorites` — agriculteurs et produits favoris.
- `/restaurant/farmers/$id` — page agriculteur (profil, produits, avis, bouton suivre).
- `/restaurant/expenses` — analytics dépenses (chart par catégorie, par fournisseur, comparatif).
- `/restaurant/expenses/export` — export Excel/PDF.
- `/restaurant/messages` & `/$id` — même structure que farmer.
- `/restaurant/notifications` — centre notifications.
- `/restaurant/settings/{profile,restaurant,addresses,payments,notifications,security}` — sous-routes.

**Composants partagés à factoriser** (utilisés par farmer + restaurant) :

- `RoleSidebar` paramétrable (items + badge rôle).
- `BentoKpi` avec slot sparkline.
- `KanbanBoard` générique.
- `LiveActivityFeed`.
- `SidePanel` (Framer Motion slide).
- `PageHeader` (déjà existant — étendre avec breadcrumb).

---

## Détails techniques

- **Routing** : fichiers plats `farmer.products.new.tsx`, `farmer.products.$id.tsx`, `farmer.orders.$id.tsx`, etc. (convention TanStack déjà en place).
- **State CRUD** : `useState` local + mocks (pas de backend, pas de Cloud à ce stade).
- **Drag&drop Kanban** : Framer Motion `drag` + `onDragEnd` mettant à jour le statut local.
- **Sparklines** : Recharts `<LineChart>`/`<BarChart>` sans axes, height 60, données mock.
- **Carte Sénégal** : SVG inline simplifié (contour pays + 6 pins régions principales).
- **Live feed** : `useEffect` + `setInterval` 30s, ajout d'un event mock en tête de liste avec animation `motion.div` `initial={opacity:0,y:-10}`.
- **Aucune modification** de : `styles.css`, palette, fonts, glass utilities, landing page, auth pages.
- **Suppression** : `ProductFormDialog`, `StockAdjustDialog`, `OrderDetailDialog` (remplacés par routes).

Volume estimé : ~25 nouvelles routes farmer, ~18 routes restaurant, ~6 composants partagés. Livrable en plusieurs itérations si tu préfères découper (ex : Bloc A+B+C d'abord, puis le reste).

Veux-tu que je découpe l'exécution en sous-livraisons, ou je lance tout Phase 3 puis Phase 4 ? phase 3 puis phase 4 (on vas faire quelque chose)