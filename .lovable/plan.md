# DIAMBAR AGRO — Plan Phase 0 + 1 + 2+3

## Brief confirmé (Phase 0 — Cadrage)

**Produit** : Plateforme SaaS de logistique alimentaire au Sénégal connectant Agriculteurs, Restaurants, Livreurs et Admins. Slogan : *"Du Champ à Votre Cuisine"*.

**Identité visuelle (verrouillée pour TOUTES les phases)** :

- Theme : dark-first avec toggle light, glassmorphism subtil premium
- Palette : emerald `#059669` (primary), `#10b981` (accent), `#0a0a0a` (bg dark), `#111827` (cards), `#374151` (borders), `#fafaf9` (texte), `#f59e0b` (premium/alertes), `#ef4444` (erreurs)
- Typographie : **Sora** (titres), **Inter** (corps) — Google Fonts
- Style cards : `rounded-2xl`, `border-white/10`, `bg-white/5`, `backdrop-blur-md`, `shadow-xl`
- Boutons primaires : `bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold`
- Transitions : `transition-all duration-300 ease-in-out`
- Animations : fadeIn / slideUp au scroll

**Stack effective** (adapté Lovable) : TanStack Start + React + TS strict + Tailwind v4 + shadcn + Lucide + Recharts (quand nécessaire) + framer-motion. **Pas de Supabase pour l'instant** — toutes les données mockées en attendant l'intégration backend ultérieure. Les routes seront structurées pour accueillir le backend plus tard.

**Données mock centralisées** : agriculteurs (Mamadou Diallo/Thiès, Fatou Sow/Pikine, Ibrahima Ndoye/Mbour), restaurants (Le Baobab, Chez Aminata, Téranga), produits (tomates 850, oignons 450, poulet 3200, mangues 600, manioc 350, bissap 1200), livreurs (Oumar Ba, Cheikh Fall).

---

## Architecture des routes (préparée pour les 9 phases)

```
src/routes/
  __root.tsx               → shell + ThemeProvider + Toaster + <Outlet/>
  index.tsx                → Landing (Phase 1)
  login.tsx                → Connexion (Phase 2)
  register.tsx             → Inscription multi-étapes (Phase 2)
  forgot-password.tsx      → Reset (Phase 2)
  reset-password.tsx       → Nouveau mot de passe (Phase 2)
  onboarding.tsx           → Bienvenue post-inscription (Phase 2)
  farmer/...               → (Phase 3, stubs créés)
  restaurant/...           → (Phase 4, stubs créés)
  driver/...               → (Phase 5, stubs créés)
  admin/...                → (Phase 6, stubs créés)
```

Pour Phases 1+2, je crée uniquement les routes listées ci-dessus (Landing + Auth + Onboarding). Les dashboards par rôle viendront aux phases suivantes.

---

## Étapes d'implémentation (ce plan couvre Phases 1 & 2)

### 1. Fondations design system

- Mettre à jour `src/styles.css` : tokens emerald/charbon en oklch, surfaces glass, fonts Sora + Inter via `<link>` dans `__root.tsx` head
- Ajouter `ThemeProvider` (dark/light) + toggle glassmorphism réutilisable dans `src/components/theme/`
- `src/components/ui/glass-card.tsx` (wrapper réutilisable)
- `src/lib/format.ts` : `formatFCFA`, helpers
- `src/data/mocks.ts` : agriculteurs, restaurants, produits, livreurs, témoignages, FAQ — source unique de vérité pour toutes les phases

### 2. Phase 1 — Landing (`src/routes/index.tsx`)

Composants découpés dans `src/components/landing/` :

- `Navbar` (logo, liens, theme toggle, CTA Se connecter)
- `Hero` (gradient animé + particules, badge, H1 "Du Champ à Votre Cuisine" avec dégradé sur "Cuisine", 2 CTA, 4 stats, mockup card commande animée)
- `LogosBar` (scroll horizontal infini)
- `HowItWorks` (3 cartes glass, slideUp au scroll)
- `Features` (grille 10 fonctionnalités, hover scale)
- `Ecosystem` (4 profils : Agriculteur vert / Restaurant orange / Livreur bleu / Admin violet)
- `LiveTracking` (carte stylisée + moto animée + panel livreur Oumar Ba)
- `Testimonials` (carousel 4, autoplay 4s)
- `Faq` (accordéon shadcn, 10 Q/R)
- `FinalCta` (gradient emerald)
- `Footer` (4 colonnes + copyright)

Chaque section reçoit `head()` SEO-friendly sur la route index.

### 3. Phase 2 — Authentification

Composants partagés `src/components/auth/` :

- `AuthSplitLayout` (split 2 colonnes desktop, fond gradient + stats animées à gauche)
- `RoleCard`, `OtpInput`, `PasswordStrength`, `Stepper`

Routes :

- `login.tsx` — split screen, formulaire email/password, toggle mot de passe, "Se souvenir", lien forgot, boutons Google + Téléphone, états loading/erreur (mock)
- `register.tsx` — wrapper avec `useState` step 1→4 et progress bar
  - Étape 1 : sélection rôle (4 cartes)
  - Étape 2 : infos perso (nom, email, tel +221, password + force, confirm, ville)
  - Étape 3 : champs spécifiques au rôle choisi (agri / resto / livreur)
  - Étape 4 : OTP 6 digits + countdown 59s + renvoyer
- `forgot-password.tsx` — 2 étapes (email → confirmation animée)
- `reset-password.tsx` — nouveau mot de passe + force
- `onboarding.tsx` — écran personnalisé selon rôle (lit `?role=` query) avec 3 steps suggérés et CTA vers dashboard correspondant (route stub pour l'instant)

Validation : `zod` + `react-hook-form` (déjà disponibles dans le template shadcn).

### 4. Polish

- Toaster sonner global
- Animations framer-motion (fadeIn / slideUp / stagger)
- Responsive mobile (hamburger nav, stack vertical des sections)
- Vérification build automatique

## Détails techniques

- **Pas de backend** activé : auth simulée (toast "Connexion simulée — backend à brancher en Phase ultérieure"), pas d'appel Supabase. Structure des handlers prête à recevoir `supabase.auth.signIn(...)`.
- **Mock data** typée TypeScript dans `src/data/` pour réutilisation dans toutes les phases.
- **Routes dashboards** non créées dans cette phase — les CTA d'onboarding pointent vers `/farmer/dashboard` etc. qui rendront 404 jusqu'à Phase 3+ (acceptable, prévu).
- **Code clean / scalable** : un fichier = une responsabilité, composants `<200 lignes`, props typées, pas de logique métier inline dans les routes.

## Ce qui n'est PAS dans ce plan

Phases 3 à 9 (dashboards par rôle, chat, notifications, polissage final mobile) — chaque phase fera l'objet d'un message séparé comme demandé.

On vas ajouter la phase 3 et pour la page des CRUDS on va leur dediee des pages