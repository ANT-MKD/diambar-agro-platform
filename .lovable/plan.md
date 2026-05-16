# Plan — Corrections thème + Auth visuel + CRUD Agriculteur complet

## 1. Correction du mode clair (landing, login, register, onboarding)

Problème : plusieurs sections sont codées en dur en sombre (`text-white`, gradients fixes, `bg-hero-dark`) et ignorent le thème.

Fichiers à corriger pour devenir thème-aware (light/dark) :
- `src/components/landing/hero.tsx` — remplacer `text-white`, `text-white/70`, etc. par `text-foreground` / `text-muted-foreground` ; utiliser un fond conditionnel (gradient clair en light, `bg-hero-dark` en dark via `dark:bg-hero-dark`).
- `src/components/landing/final-cta.tsx` — wrapper avec gradient emerald qui fonctionne sur les deux thèmes (les textes blancs y restent OK car le fond reste coloré).
- `src/components/landing/live-tracking.tsx` — vérifier badges et cards.
- `src/components/landing/features.tsx`, `how-it-works.tsx`, `testimonials.tsx`, `faq.tsx`, `ecosystem.tsx`, `footer.tsx`, `navbar.tsx`, `logos-bar.tsx` — passer en revue pour tokens sémantiques uniquement.
- `src/components/auth/split-layout.tsx` — le panneau gauche reste un visuel sombre intentionnel (style premium), mais on garde le formulaire à droite parfaitement clair (déjà OK). On confirme via la classe `bg-background`.
- `src/routes/register.tsx` (wizard 4 étapes) — auditer les classes : remplacer toute couleur dure par `bg-card`, `text-foreground`, `border-border`, `bg-muted`.
- `src/routes/onboarding.tsx` — idem.

Règle appliquée partout : **aucune classe `text-white`, `bg-black`, `bg-gray-*`, gradient codé en dur** sauf dans des sections délibérément immersives (hero gauche auth, CTA final).

## 2. Carousel d'images Unsplash sur le panneau gauche du login/register

Dans `src/components/auth/split-layout.tsx` :
- Ajouter un fond image plein écran sur la moitié gauche avec rotation toutes les 5 secondes (fade crossfade).
- 5 images Unsplash thématiques (agriculture sénégalaise, marché, livraison, légumes frais, ferme).
- Garder un overlay sombre (`bg-black/55`) pour préserver la lisibilité des cards glass et du logo.
- Les cards "Commande en cours / Livraison / Stats" restent affichées par-dessus.
- Indicateurs (dots) en bas pour signaler la slide active.
- Implémenté avec un `useEffect` + `setInterval`, transitions via `opacity` et `transition-opacity duration-1000`.

## 3. Pages CRUD Agriculteur — implémentation complète

Remplacer les 8 stubs actuels par des écrans réels avec données mockées (`src/data/mocks.ts`), listes, filtres, modales de formulaire complètes, et états vides/loading.

### 3.1 `/farmer/products` — Mes Produits
- Header : titre + bouton "Ajouter un produit" (ouvre dialog).
- Filtres : recherche, catégorie (select), statut (active/low/out/draft).
- Vue grille cards : image, nom, catégorie badge, prix/kg, stock + barre vs min, statut, menu actions (Éditer / Dupliquer / Supprimer).
- Dialog `ProductFormDialog` : champs nom, catégorie, prix, unité, SKU, stock initial, stock min, image URL, statut. Validation `zod` + `react-hook-form`. Toast succès.
- Confirmation `AlertDialog` avant suppression.

### 3.2 `/farmer/stock` — Gestion du Stock
- Tableau (`Table` shadcn) : produit + image, SKU, stock actuel, min, statut (badge), dernière MAJ.
- Filtre alerte : "Stock faible" / "Rupture" / "Tous".
- Bouton "Ajuster" par ligne → dialog `StockAdjustDialog` (type : ajout / retrait / inventaire ; quantité ; motif ; date).
- KPI en haut : Total références, Stock faible, Ruptures, Valeur stock totale (FCFA).

### 3.3 `/farmer/orders` — Commandes
- Tabs par statut : Toutes / En attente / Confirmées / En préparation / En livraison / Livrées / Annulées (compteurs).
- Liste cards : référence, restaurant (avatar + nom + ville), items résumés, total FCFA, date relative, statut, ETA si applicable.
- Bouton détail → `OrderDetailDialog` (timeline statut, items complets, livreur, actions : Confirmer / Marquer prête / Annuler avec motif).
- Recherche par référence/restaurant.

### 3.4 `/farmer/revenue` — Mes Revenus
- KPI : CA du mois, CA total, Commandes payées, Panier moyen, En attente paiement.
- Graphique `AreaChart` Recharts (revenueChart) avec sélecteur période (7j / 30j / 90j).
- Tableau transactions : date, commande, restaurant, montant brut, commission, net, méthode (Wave/Orange/Free), statut.
- Bouton "Exporter CSV" (mock).

### 3.5 `/farmer/analytics` — Analytics
- Cards KPI : Top produit, Meilleur client, Taux de réachat, Taux d'annulation.
- `BarChart` produits les plus vendus.
- `LineChart` évolution commandes.
- `PieChart` répartition par catégorie.
- Heatmap simple jours × heures (grille CSS) des commandes.

### 3.6 `/farmer/messages` — Messages
- Layout 2 colonnes : liste conversations (avatar restaurant, dernier message, badge non lu) + panneau conversation (bulles, input, attache).
- État vide si aucune conversation sélectionnée.
- Données mockées : 4 conversations avec restaurants.

### 3.7 `/farmer/notifications` — Notifications
- Liste regroupée par date (Aujourd'hui / Cette semaine / Plus ancien).
- Types : commande, paiement, stock, système, message.
- Actions : marquer tout comme lu, filtre type, switch préférences (email/SMS/push) par catégorie.

### 3.8 `/farmer/settings` — Paramètres
- Tabs : Profil, Exploitation, Paiement, Sécurité, Notifications.
- Formulaires complets avec champs Sénégal (nom, téléphone +221, ville, langue Wolof/Français, Wave/Orange Money n°, changement mot de passe avec `PasswordStrength`).

## 4. Composants partagés à créer

- `src/components/farmer/page-header.tsx` — titre + sous-titre + actions.
- `src/components/farmer/kpi-card.tsx` — KPI réutilisable.
- `src/components/farmer/empty-state.tsx`.
- `src/components/farmer/status-badge.tsx` — couleurs par statut commande/stock.
- `src/components/farmer/product-form-dialog.tsx`, `stock-adjust-dialog.tsx`, `order-detail-dialog.tsx`.

## Détails techniques

- Formulaires : `react-hook-form` + `zod` (déjà disponibles) + `@/components/ui/form`, `dialog`, `alert-dialog`, `tabs`, `table`, `select`, `textarea`, `switch`.
- Toasts : `sonner` (déjà câblé).
- Charts : `recharts` (déjà utilisé sur le dashboard).
- Données mockées : utiliser `products`, `orders`, `restaurants`, `revenueChart`, `farmers`, `drivers` de `src/data/mocks.ts`. Étendre légèrement si besoin (transactions, messages, notifications).
- État local React (`useState`) pour CRUD — pas de backend, conforme à la stratégie "mock first".
- Aucun changement de routing : on remplit les fichiers de routes existants `src/routes/farmer.*.tsx`.

## Ordre d'exécution

1. Corriger thème clair (styles + composants landing + auth/register).
2. Ajouter carousel Unsplash dans `split-layout.tsx`.
3. Créer composants partagés farmer (`kpi-card`, `page-header`, `status-badge`, dialogs).
4. Implémenter les 8 pages CRUD (`products`, `stock`, `orders`, `revenue`, `analytics`, `messages`, `notifications`, `settings`).
5. Vérifier build, naviguer chaque page en preview.
