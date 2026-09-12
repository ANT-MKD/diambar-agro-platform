# Diambar Agro Platform

DIAMBAR AGRO — PROMPT MAÎTRE ULTRA DÉTAILLÉ POUR LOVABLE (tu vas aussi analyser et te baser sur le document envoye)

> Slogan : "Du Champ à Votre Cuisine"
> Plateforme africaine de logistique alimentaire — Sénégal
> À coller dans Lovable phase par phase dans l'ordre indiqué

---

INSTRUCTIONS AVANT DE COMMENCER

Comment utiliser ce document :

- Chaque PHASE est un prompt séparé à envoyer à Lovable
- Envoie une phase à la fois, attends le résultat, vérifie, puis passe à la suivante
- Ne jamais coller tout le document en une seule fois
- Si Lovable génère quelque chose d'incorrect, précise dans un message de suivi sans changer de phase
- On va creer la structures des routes pour le backend qu'on vas integrer ulterirurement mais pour l'instant on vas travailler avec des donnee mockee

---

PROMPT DE CADRAGE GLOBAL

> À envoyer EN PREMIER, avant toute phase. C'est le "cerveau" de l'app.

```
Tu es un designer produit senior et développeur React expert, spécialisé dans les plateformes SaaS africaines premium. Tu vas créer DIAMBAR AGRO, une plateforme web de logistique alimentaire au Sénégal qui connecte agriculteurs, restaurants et livreurs.

IDENTITÉ VISUELLE ABSOLUE — à respecter sur TOUTES les pages sans exception :

Stack technique : React + TypeScript + Tailwind CSS + Shadcn UI + React Router + Supabase
Typographie : Sora (titres) + Inter (corps) — importer depuis Google Fonts
Palette principale :
  - Vert émeraude profond : #059669 (primary)
  - Vert clair accent : #10b981 (hover/accents)
  - Noir charbon : #0a0a0a (background dark)
  - Gris foncé : #111827 (cards dark)
  - Gris moyen : #374151 (borders)
  - Blanc cassé : #fafaf9 (texte principal sur dark)
  - Orange doux : #f59e0b (alertes, badges premium)
  - Rouge erreur : #ef4444
- on vas ameliorer le design vers un design premuim (ajout d'effet de glarmorphism si necessaire)
Style UI :
  - Thème sombre et clair (avec toggle switch mode effet de glarmorphism)
  - Glassmorphism subtil : backdrop-blur-md + bg-white/5 + border border-white/10
  - Cards avec : rounded-2xl, border border-white/10, bg-white/5, shadow-xl
  - Boutons primaires : bg-emerald-600 hover:bg-emerald-500, rounded-xl, font-semibold
  - Transitions : transition-all duration-300 ease-in-out
  - Espacements généreux : padding minimum p-6 sur les sections
  - Sidebar fixe sur desktop (w-64), bottom navigation sur mobile
  - Animations : fadeIn, slideUp sur les cartes au chargement

Contexte métier :
  - Plateforme pour le marché sénégalais (Dakar, Thiès)
  - 4 rôles utilisateurs : Agriculteur, Restaurant, Livreur, Administrateur
  - Produits : fruits, légumes, viande, volaille, céréales, tubercules
  - Paiements : Wave, Orange Money, Free Money, espèces
  - Devise : FCFA (XOF)
  - Commission plateforme : 5% à 15% par commande
  - Livraison : 1 000 à 5 000 FCFA

Données de démonstration à utiliser partout :
  - Agriculteurs : Mamadou Diallo (Thiès), Fatou Sow (Dakar-Pikine), Ibrahima Ndoye (Mbour)
  - Restaurants : Le Baobab (Dakar Plateau), Chez Aminata (Thiès), Restaurant Téranga (Dakar)
  - Produits : Tomates (850 FCFA/kg), Oignons (450 FCFA/kg), Poulet fermier (3 200 FCFA/kg), Mangues (600 FCFA/kg), Manioc (350 FCFA/kg), Bissap (1 200 FCFA/kg)
  - Livreurs : Oumar Ba (moto), Cheikh Fall (véhicule utilitaire)

Ne génère PAS encore de pages. Confirme que tu as bien compris le brief et attends la Phase 1 et phase 2.
```

---

PHASE 1 — LANDING PAGE MARKETING

```
PHASE 1 : Crée la Landing Page publique de DIAMBAR AGRO.

C'est la vitrine de la plateforme, ultra-premium, convaincante pour les investisseurs et les premiers utilisateurs.

---

### SECTION 1 — HERO FULLSCREEN

Fond : gradient sombre animé du noir charbon (#0a0a0a) vers un vert très sombre (#022c22), avec des particules lumineuses vertes subtiles qui flottent (CSS animation)

Contenu :
- Badge en haut : pill glassmorphism avec texte "Plateforme N°1 d'approvisionnement agricole au Sénégal 🇸🇳"
- Titre H1 massif (text-6xl md:text-8xl, font-family Sora, font-black) :
  "Du Champ
  à Votre Cuisine"
  (le mot "Cuisine" en dégradé vert emeraude à vert clair)
- Sous-titre (text-xl, text-white/70, max-w-2xl) :
  "Une plateforme intelligente qui connecte agriculteurs, restaurants et livreurs dans un écosystème moderne de logistique alimentaire au Sénégal."
- 2 boutons CTA côte à côte :
  → "Commencer maintenant" (primary, bg-emerald-600, grand, avec flèche animée →)
  → "Devenir partenaire" (outline, border-emerald-500, text-emerald-400)
- Statistiques en ligne sous les boutons (4 stats) :
  → 20+ Agriculteurs partenaires
  → 30+ Restaurants clients
  → 10 Livraisons/jour
  → 4.9★ Note moyenne
- À droite du texte : mockup d'un écran de dashboard (carte de commande animée qui arrive, avec le nom "Mamadou Diallo - Tomates 50kg - 42 500 FCFA - En livraison...")

---

### SECTION 2 — BARRE DE LOGOS PARTENAIRES

Fond légèrement plus clair que le hero
Titre centré : "Ils nous font confiance"
Logos fictifs stylisés (texte en gras + icône simple) :
- Le Baobab Restaurant
- Hôtel Téranga
- Marché Central Thiès
- Coopérative Agricole Sénégal
- Wave (paiement)
Animation : défilement horizontal infini (scroll loop CSS)

---

### SECTION 3 — COMMENT ÇA MARCHE (3 étapes)

Titre section : "Simple. Rapide. Direct."
Sous-titre : "3 étapes pour révolutionner votre approvisionnement"

3 grandes cartes glassmorphism en grille (md:grid-cols-3) avec numéro, icône (vraie icone ou images unspalsh ou autres, titre et description :

Étape 1 — L'Agriculteur publie
- Icône : plante/graine
- Titre : "Les producteurs publient leurs stocks"
- Description : "Mamadou Diallo ajoute ses 200kg de tomates fraîches à 850 FCFA/kg. Photos, quantité disponible, délai de récolte — tout est visible en temps réel."
- Petite illustration : card produit de Mamadou Diallo avec photo tomate (Unsplash), prix, badge "Disponible"

Étape 2 — Le Restaurant commande
- Icône : restaurant/fourchette
- Titre : "Les restaurants commandent directement"
- Description : "Le Baobab Restaurant parcourt le catalogue, compare les prix, ajoute au panier et valide sa commande. Sans intermédiaire, sans appel téléphonique."
- Illustration : panier avec 3 produits, total 87 400 FCFA

Étape 3 — Le Livreur assure
- Icône : camion/moto
- Titre : "Les livreurs assurent la livraison"
- Description : "Oumar Ba reçoit la mission sur son téléphone, récupère chez Mamadou et livre au Baobab. Suivi GPS en temps réel pour le restaurant."
- Illustration : carte GPS simplifiée avec point A et point B reliés

Animation : chaque carte apparaît avec une animation slideUp au scroll (Intersection Observer)

---

### SECTION 4 — FONCTIONNALITÉS (grille premium)

Titre : "Tout ce dont vous avez besoin"
Grille responsive (2 cols mobile, 3 cols tablet, 4 cols desktop)

10 cartes fonctionnalités avec effet glassmorphism + hover (scale-105) :

1. Livraison temps réel — icône camion — "Suivez chaque commande de l'exploitation à votre cuisine"
2. Suivi GPS — icône carte — "Tracking en temps réel de vos livreurs sur la carte"
3. Chat instantané — icône message — "Communiquez directement avec agriculteurs et livreurs"
4. Mobile Money — icône téléphone-paiement — "Wave, Orange Money, Free Money intégrés"
5. Analytics avancés — icône graphique — "Chiffre d'affaires journalier, mensuel, annuel exportable Excel"
6. Gestion de stock — icône boîte — "Alertes automatiques de rupture, codes SKU, codes-barres"
7. Commandes intelligentes — icône panier — "Panier, historique, commandes récurrentes"
8. Dashboard SaaS — icône écran — "Interface dédiée pour chaque rôle"
9. Notifications live — icône cloche — "Alertes push instantanées pour chaque événement"
10. Vérification producteurs — icône bouclier — "Tous les agriculteurs sont vérifiés et notés"

---

### SECTION 5 — L'ÉCOSYSTÈME (4 profils)

Titre : "Une plateforme, quatre acteurs"
4 grandes cartes côte à côte (scroll horizontal sur mobile)

Carte 1 — Agriculteur
- Couleur accent : vert émeraude
- Icône : 👨🏾‍🌾
- Titre : "Agriculteurs"
- Sous-titre : "Vendez plus, sans intermédiaire"
- Liste des avantages :
  → Publiez vos produits en 2 minutes
  → Recevez des commandes régulières
  → Gérez votre stock en temps réel
  → Encaissez via Wave ou Orange Money
  → Notez vos clients
- Stat mise en avant : "Revenus moyens +40%"
- Bouton : "Rejoindre en tant qu'agriculteur →"

Carte 2 — Restaurant
- Couleur accent : orange #f59e0b
- Icône : 🍽️
- Titre : "Restaurants"
- Sous-titre : "Approvisionnez-vous mieux, moins cher"
- Liste :
  → Parcourez le catalogue complet
  → Comparez les prix en temps réel
  → Commandez en quelques clics
  → Suivez vos livraisons en GPS
  → Historique de toutes vos commandes
- Stat : "Économies moyennes -25% sur l'approvisionnement"
- Bouton : "Rejoindre en tant que restaurant →"

Carte 3 — Livreur
- Couleur accent : bleu #3b82f6
- Icône : 🚚
- Titre : "Livreurs"
- Sous-titre : "Des missions, des revenus, de la liberté"
- Liste :
  → Acceptez ou refusez les missions
  → Navigation GPS intégrée
  → Wallet et historique de revenus
  → Statut online/offline
  → Paiement rapide sur Wave
- Stat : "Jusqu'à 85 000 FCFA/mois"
- Bouton : "Devenir livreur →"

Carte 4 — Administrateur
- Couleur accent : violet #8b5cf6
- Icône : 🧑🏾‍💻
- Titre : "Administrateurs"
- Sous-titre : "Contrôlez tout l'écosystème"
- Liste :
  → Validez les comptes utilisateurs
  → Surveillez toutes les livraisons
  → Gérez les commissions
  → Rapports financiers complets
  → Support et gestion des litiges
- Stat : "Vision 360° de la plateforme"
- Bouton : "Accéder au panneau admin →"

---

### SECTION 6 — SIMULATION DE LIVRAISON

Titre : "Suivez votre livraison en temps réel"
Composant interactif :
- Carte de style Mapbox/Google Maps (utilise une image statique stylisée dark avec des routes en vert)
- Point A (vert) : "Ferme Mamadou Diallo — Thiès"
- Point B (orange) : "Le Baobab Restaurant — Dakar Plateau"
- Icône moto animée qui se déplace sur le trajet (CSS animation path)
- Panel à droite :
  → Photo livreur (Unsplash homme africain casque moto)
  → Nom : Oumar Ba
  → Note : ★★★★★ (4.9)
  → ETA : "Arrivée dans 23 minutes"
  → Barre de progression : Récupéré → En route → Livré (étape 2 active)
  → Produits : "Tomates 50kg + Oignons 30kg"
  → Commande : #CMD-2847

---

### SECTION 7 — TÉMOIGNAGES

Titre : "Ce qu'ils disent de nous"
Carousel de 4 cartes témoignages (auto-scroll 4s + navigation manuelle) :

Témoignage 1 :
- Photo : homme africain (Unsplash)
- Nom : Mamadou Diallo
- Rôle : Agriculteur, Thiès
- Note : ★★★★★
- Texte : "Avant Diambar Agro, je vendais au marché et perdais souvent mes produits. Maintenant j'ai des commandes régulières chaque semaine. Mon revenu a augmenté de 35% en 3 mois."

Témoignage 2 :
- Photo : femme africaine (Unsplash)
- Nom : Aminata Ndiaye
- Rôle : Propriétaire, Restaurant Chez Aminata — Thiès
- Note : ★★★★★
- Texte : "Je commandais avant via des intermédiaires qui me prenaient une marge énorme. Avec la plateforme, je paie directement le producteur. Mes coûts ont baissé de 20%."

Témoignage 3 :
- Photo : jeune homme (Unsplash)
- Nom : Oumar Ba
- Rôle : Livreur partenaire, Dakar
- Note : ★★★★★
- Texte : "L'app est simple, les missions arrivent rapidement. Je gère mon planning librement et je suis payé le jour même via Wave. C'est le meilleur job que j'ai eu."

Témoignage 4 :
- Photo : homme costume (Unsplash)
- Nom : Ibrahima Sarr
- Rôle : Directeur, Hôtel Téranga
- Note : ★★★★★
- Texte : "Nous approvisionnons maintenant notre restaurant d'hôtel directement chez les producteurs locaux. Produits plus frais, traçabilité totale, livraison ponctuelle."

---

### SECTION 8 — FAQ ACCORDÉON

Titre : "Questions fréquentes"

10 questions avec réponses (accordéon Shadcn) :
Q1: Comment m'inscrire sur Diambar Agro ?
R: Cliquez sur "Commencer maintenant", choisissez votre rôle (Agriculteur, Restaurant ou Livreur) et suivez le processus d'onboarding guidé en 5 étapes. L'inscription est gratuite.

Q2: Quels sont les frais de la plateforme ?
R: La plateforme prélève une commission de 5% à 15% sur chaque commande selon le volume. Les frais de livraison varient de 1 000 à 5 000 FCFA selon la distance.

Q3: Comment fonctionnent les paiements ?
R: Nous acceptons Wave, Orange Money, Free Money et les espèces. Les paiements sont sécurisés et les agriculteurs reçoivent leur argent sous 24h après livraison confirmée.

Q4: Comment les agriculteurs sont-ils vérifiés ?
R: Chaque agriculteur soumet une pièce d'identité, une preuve d'exploitation et passe par un appel de vérification avec notre équipe. Le processus prend 24 à 48h.

Q5: Puis-je suivre ma livraison en temps réel ?
R: Oui, dès qu'un livreur prend en charge votre commande, vous pouvez suivre sa position GPS en temps réel depuis votre dashboard restaurant.

Q6: Que se passe-t-il si les produits ne correspondent pas à la commande ?
R: Vous pouvez signaler un problème dans les 2h après livraison. Notre équipe intervient sous 4h et un remboursement ou remplacement est organisé.

Q7: Est-ce que Diambar Agro couvre toute la région ?
R: Actuellement nous couvrons Dakar et Thiès. Nous allons étendre à Mbour, Saint-Louis et Ziguinchor d'ici fin 2025.

Q8: Peut-on passer des commandes récurrentes ?
R: Oui. La fonctionnalité "Commande récurrente" permet aux restaurants de programmer des livraisons hebdomadaires automatiques.

Q9: Comment devenir livreur partenaire ?
R: Inscrivez-vous avec le rôle "Livreur", soumettez votre permis de conduire et votre carte d'identité. Vous pouvez commencer à recevoir des missions sous 48h.

Q10: Y a-t-il un abonnement premium ?
R: Oui. L'abonnement Premium Restaurant (15 000 FCFA/mois) offre la mise en avant dans les résultats, les commandes récurrentes automatiques et un accès prioritaire au support.

---

### SECTION 9 — CTA FINAL

Fond : gradient vert émeraude profond
Titre : "Prêt à transformer votre business ?"
Sous-titre : "Rejoignez 50+ acteurs qui révolutionnent la chaîne alimentaire au Sénégal"
2 boutons : "Créer mon compte" (blanc) + "Nous contacter" (outline blanc)
Petit texte : "Inscription gratuite · Aucune carte requise · Support en Wolof et Français"

---

### FOOTER

Fond : #0a0a0a
Logo DIAMBAR AGRO + slogan "Du Champ à Votre Cuisine"

4 colonnes :
Col 1 - À propos : description courte + réseaux sociaux (Facebook, Instagram, WhatsApp, LinkedIn)
Col 2 - Plateforme : Agriculteurs, Restaurants, Livreurs, Tarifs, API
Col 3 - Support : Centre d'aide, Nous contacter, Signaler un problème, Conditions d'utilisation, Politique de confidentialité
Col 4 - Contact : Email: contact@diambar-agro.sn | Tel: +221 77 000 00 00 | Adresse: Dakar, Sénégal

Bas du footer : Copyright 2025 Diambar Agro · Fait avec ❤️ au Sénégal
```

---

PHASE 2 — AUTHENTIFICATION COMPLÈTE

```
PHASE 2 : Crée le système d'authentification complet de DIAMBAR AGRO.

Respecte strictement l'identité visuelle définie dans le brief initial (dark theme, vert émeraude, glassmorphism).

---

### PAGE 1 — CONNEXION (/login)

Layout : split screen (2 colonnes sur desktop, 1 colonne sur mobile)

Colonne gauche (fond sombre avec illustration) :
- Fond : gradient noir vers vert très sombre + grain texture subtil
- Grand logo DIAMBAR AGRO centré
- Slogan : "Du Champ à Votre Cuisine"
- Illustration animée : 3 cartes flottantes superposées (card agriculteur avec produit, card commande, card livraison GPS)
- En bas : 3 stats animées (compteur qui monte) : "50+ Agriculteurs", "120+ Commandes/semaine", "4.9★ Satisfaction"

Colonne droite (formulaire) :
- Fond : bg-gray-900/50 backdrop-blur
- Titre : "Bon retour 👋"
- Sous-titre : "Connectez-vous à votre espace"
- Formulaire :
  → Input email (avec icône mail)
  → Input password (avec icône cadenas + bouton œil pour voir/masquer)
  → Checkbox "Se souvenir de moi"
  → Lien "Mot de passe oublié ?" (aligné à droite)
  → Bouton principal "Se connecter" (full width, bg-emerald-600)
  → Séparateur "ou continuer avec"
  → Bouton "Continuer avec Google" (avec logo Google)
  → Bouton "Continuer avec numéro de téléphone"
- En bas : "Pas encore de compte ? Créer un compte →"

États à gérer :
- Loading spinner sur le bouton pendant la requête
- Message d'erreur en rouge si email/password incorrect
- Redirect vers le bon dashboard selon le rôle après connexion

---

### PAGE 2 — INSCRIPTION (/register)

Étape 1 — Choix du rôle (pleine page)
- Titre : "Bienvenue sur Diambar Agro"
- Sous-titre : "Quel est votre profil ?"
- 4 grandes cartes sélectionnables (avec état sélectionné = bordure verte brillante + scale-105) :
  → Agriculteur : icône 🌾, "Je vends mes produits agricoles", couleur verte
  → Restaurant : icône 🍽️, "Je m'approvisionne directement", couleur orange
  → Livreur : icône 🚚, "Je livre les commandes", couleur bleue
  → Admin : icône 🔧, "Je gère la plateforme" (visible seulement avec code d'accès)
- Bouton "Continuer →" (désactivé jusqu'à sélection)
- Progress bar en haut : Étape 1/4

Étape 2 — Informations personnelles
- Champs :
  → Prénom + Nom (2 colonnes)
  → Email
  → Numéro de téléphone (avec sélecteur pays +221 Sénégal par défaut)
  → Mot de passe (avec indicateur de force : Faible / Moyen / Fort)
  → Confirmer le mot de passe
  → Ville (select : Dakar, Thiès, Mbour, Saint-Louis, Ziguinchor, Autre)
- Progress bar : Étape 2/4

Étape 3 — Informations spécifiques au rôle

Si Agriculteur :
  → Nom de l'exploitation
  → Localisation précise (quartier/village)
  → Superficie (en hectares)
  → Types de produits cultivés (checkboxes multiples : Légumes, Fruits, Céréales, Viande/Volaille, Tubercules, Épices)
  → Photo de la ferme (upload)
  → Numéro CNI

Si Restaurant :
  → Nom du restaurant
  → Type de cuisine (select : Sénégalaise, Internationale, Fast-food, Hôtel, Autre)
  → Adresse complète
  → Numéro de téléphone professionnel
  → NINEA (numéro fiscal, optionnel)
  → Logo du restaurant (upload)

Si Livreur :
  → Type de véhicule (Moto, Vélo, Voiture, Camionnette)
  → Numéro de permis de conduire
  → Numéro de téléphone
  → Zone de livraison (checkboxes : Dakar-Plateau, Dakar-Banlieue, Thiès, Mbour)
  → Photo CNI (upload)
  → Photo du véhicule (upload)

Progress bar : Étape 3/4

Étape 4 — Vérification OTP
- Titre : "Vérifiez votre numéro"
- Texte : "Nous avons envoyé un code à 6 chiffres au +221 77 XXX XXXX"
- 6 inputs séparés pour le code OTP (auto-focus sur le suivant)
- Timer : "Renvoyer le code dans 59s" (countdown)
- Bouton "Vérifier et créer mon compte"
- Lien "Modifier mon numéro"
Progress bar : Étape 4/4

---

### PAGE 3 — MOT DE PASSE OUBLIÉ (/forgot-password)

- Étape 1 : Entrer son email → bouton "Envoyer le lien"
- Étape 2 : Confirmation "Email envoyé à votre adresse" avec illustration enveloppe animée
- Étape 3 : Formulaire nouveau mot de passe (via lien email) avec 2 inputs + validation force

---

### PAGE 4 — ONBOARDING POST-INSCRIPTION

Après vérification OTP, écran de bienvenue personnalisé selon le rôle :

Pour Agriculteur :
- "Bienvenue Mamadou ! Votre compte est créé ✓"
- 3 étapes suggérées avec progress :
  → Complétez votre profil (photo de profil, bio, certifications)
  → Ajoutez votre premier produit
  → Configurez vos préférences de paiement (Wave/Orange Money)
- Bouton "Commencer →" → redirige vers dashboard agriculteur

Pour Restaurant :
- "Bienvenue Le Baobab ! ✓"
- 3 étapes :
  → Complétez le profil restaurant (horaires, photos)
  → Explorez le catalogue de produits
  → Passez votre première commande
- Bouton "Explorer le catalogue →"

Pour Livreur :
- "Bienvenue Oumar ! Votre dossier est en cours de vérification ✓"
- Message : "Notre équipe vérifiera vos documents sous 24-48h"
- "En attendant, configurez votre wallet Wave"
- Bouton "Configurer mon wallet →"
```

---

PHASE 3 — DASHBOARD AGRICULTEUR

```
PHASE 3 : Crée le Dashboard complet de l'Agriculteur de DIAMBAR AGRO.

Layout général :
- Sidebar fixe à gauche (w-64) avec logo, navigation, et info utilisateur en bas
- Zone de contenu principale à droite (flex-1, overflow-auto)
- Header fixe en haut de la zone contenu : breadcrumb + notifications + profil
- Totalement responsive : sidebar se cache sur mobile, remplacée par bottom navigation

---

### NAVIGATION SIDEBAR AGRICULTEUR

Logo DIAMBAR AGRO en haut
Séparateur
Menu items (avec icône + label) :
1. Tableau de bord — icône LayoutDashboard
2. Mes Produits — icône Package
3. Gestion du Stock — icône Warehouse
4. Commandes reçues — icône ShoppingBag (badge rouge avec nombre)
5. Mes Revenus — icône TrendingUp
6. Analytics — icône BarChart3
7. Messages — icône MessageSquare (badge vert)
8. Notifications — icône Bell
9. Paramètres — icône Settings
---
En bas sidebar : avatar + "Mamadou Diallo" + "Agriculteur · Thiès" + icône logout

---

### PAGE 1 — TABLEAU DE BORD (/farmer/dashboard)

Header :
- "Bonjour, Mamadou 👋" + date du jour
- Bouton rapide "+ Ajouter un produit"

Ligne 1 — 4 KPI Cards (glassmorphism) :
- Revenus du mois : 847 500 FCFA ↑ +12% vs mois dernier (icône TrendingUp vert)
- Commandes reçues : 23 ↑ +5 cette semaine
- Produits actifs : 8 / 12 publiés
- Note moyenne : ★ 4.8 / 5 (156 avis)

Ligne 2 — Graphique Revenus + Commandes urgentes

Graphique (occupe 2/3 de la largeur) :
- Titre : "Évolution de vos revenus"
- Tabs : Semaine | Mois | Année
- Line chart avec 2 courbes : Revenus (vert) + Commandes (orange)
- Données mois en cours avec 30 points

Commandes urgentes (1/3 de la largeur) :
- Titre : "À traiter maintenant"
- Liste de 3 commandes en attente avec :
  → Nom restaurant, produit demandé, quantité, délai
  → Bouton "Confirmer" vert + "Refuser" rouge
- Lien "Voir toutes les commandes →"

Ligne 3 — Produits populaires + Activité récente

Produits populaires (3 cards horizontales) :
- Photo + Nom + Prix/kg + Stock restant + Nombre de commandes
- Badge "Rupture prévue dans 3 jours" en orange si stock < 20%

Activité récente (timeline) :
- Liste des 8 derniers événements : nouvelle commande, stock mis à jour, paiement reçu, note reçue, etc.
- Chaque événement avec icône colorée, description, heure

---

### PAGE 2 — MES PRODUITS (/farmer/products)

Header :
- Titre "Mes Produits" + compteur "(12 produits)"
- Bouton "+ Ajouter un produit" (primary)
- Bouton "Importer via Excel" (secondary)

Filtres et recherche :
- Search bar : "Rechercher un produit..."
- Tabs : Tous | Actifs | En rupture | En attente de validation
- Filtre catégorie : Légumes | Fruits | Viande | Céréales | Tubercules | Épices
- Tri : Nom A-Z | Prix croissant | Stock décroissant | Récemment ajouté

Grille de produits (3 colonnes desktop, 2 tablet, 1 mobile) :
Chaque card produit contient :
- Photo du produit (ratio 4:3, rounded-xl)
- Badge statut (vert "Actif" / orange "Stock faible" / rouge "Rupture" / gris "Inactif")
- Nom du produit (font-semibold)
- Catégorie (badge petit)
- Prix unitaire (large, vert) : "850 FCFA/kg"
- Stock disponible : "47 kg restants"
- Barre de stock visuelle (couleur selon niveau)
- Code SKU : "SKU-TOM-001"
- Commandes ce mois : "12 commandes"
- 3 boutons d'action : Modifier (crayon) | Désactiver (pause) | Supprimer (poubelle)

---

### SOUS-PAGE — AJOUTER / MODIFIER UN PRODUIT (/farmer/products/new ou /edit/:id)

Formulaire en 2 colonnes :

Colonne gauche — Informations produit :
- Nom du produit (input text) *
- Catégorie (select) : Légumes, Fruits, Viande/Volaille, Céréales, Tubercules, Épices *
- Description longue (textarea, max 500 caractères)
- Code SKU (auto-généré ou manuel)
- Code-barres (input + bouton scan)
- Unité de mesure (select) : kg, litre, unité, botte, sac
- Prix de vente (input number, FCFA) *
- Prix minimum acceptable (pour négociation)
- Quantité disponible *
- Quantité minimale de commande
- Délai de disponibilité (date picker) : "Disponible à partir du..."
- Lieu de collecte (input adresse)

Colonne droite — Médias et paramètres :
- Upload photos (jusqu'à 5 photos, drag & drop, preview immédiat)
- Photo principale (sélectionnable parmi les uploads)
- Statut : Actif / Inactif (toggle)
- Visible dans le catalogue public (toggle)
- Accepte les commandes récurrentes (toggle)
- Certification bio (toggle) si applicable
- Notes internes (non visibles par les clients)

Boutons bas de page : "Annuler" | "Enregistrer en brouillon" | "Publier le produit"

---

### PAGE 3 — GESTION DU STOCK (/farmer/stock)

Header avec titre + bouton "+ Nouvelle entrée de stock"

3 KPI cartes en haut :
- Valeur totale du stock : 2 340 000 FCFA
- Produits en alerte rupture : 3
- Mouvements ce mois : 47

Tableau principal (shadcn Table) :
Colonnes : Photo | Produit | SKU | Stock actuel | Stock min. | Valeur stock | Statut | Dernière MAJ | Actions

Chaque ligne colorée selon statut :
- Fond rouge léger si stock < minimum (rupture imminente)
- Fond orange si stock entre minimum et 30% du max

Boutons par ligne :
- "+" Entrée de stock (modale avec quantité + date + référence fournisseur + note)
- "-" Sortie de stock (modale avec quantité + raison : vendu, périmé, perdu)
- Ajustement d'inventaire

Panel latéral — Historique des mouvements :
Timeline des 20 derniers mouvements de stock avec date, type, quantité, opérateur

Sous-onglet Inventaire :
- Bouton "Lancer un inventaire complet"
- Tableau de saisie des quantités réelles vs théoriques
- Génération automatique des écarts
- Bouton "Valider l'inventaire" + export Excel

---

### PAGE 4 — COMMANDES REÇUES (/farmer/orders)

Header + Stats rapides :
- En attente : 5 (badge rouge)
- Confirmées : 12
- En livraison : 3
- Livrées ce mois : 48

Tabs : Toutes | En attente | Confirmées | En livraison | Livrées | Annulées

Liste des commandes (chaque item = card expandable) :
Informations visibles sans expansion :
- #CMD-2847 | Restaurant Le Baobab | 42 500 FCFA | "il y a 2h" | Badge statut

Au clic (expansion) :
- Détail des produits commandés (ligne par ligne)
- Adresse de livraison
- Note du restaurant
- Livreur assigné (ou "Non assigné")
- Historique de statuts (timeline)
- Boutons d'action selon statut :
  → Si "En attente" : "Confirmer la commande" | "Refuser avec raison"
  → Si "Confirmée" : "Marquer comme prêt pour enlèvement"
  → Si "Livrée" : "Signaler un problème"

---

### PAGE 5 — MES REVENUS (/farmer/revenue)

Header : période sélectionnable (ce mois / ce trimestre / cette année)
Bouton "Exporter en Excel"

4 KPI cartes :
- Revenus bruts : 847 500 FCFA
- Commissions plateforme : -84 750 FCFA (10%)
- Revenus nets : 762 750 FCFA
- En attente de paiement : 127 500 FCFA

Graphique en barres (mensuel, 12 mois)

Tableau transactions :
Colonnes : Date | Commande | Restaurant | Montant brut | Commission | Net reçu | Statut paiement | Mode paiement

Wallet section :
- Solde Wave : 45 000 FCFA
- Solde Orange Money : 12 500 FCFA
- Bouton "Retirer vers mon compte"
- Historique des retraits

---

### PAGE 6 — ANALYTICS (/farmer/analytics)

Section 1 — Performance produits :
- Graphique radar : performance par catégorie de produit
- Top 5 produits les plus commandés (barres horizontales)
- Graphique camembert : répartition du CA par produit

Section 2 — Clients :
- Top 5 restaurants clients (avec CA total, nombre de commandes)
- Fidélité : % de commandes récurrentes vs nouvelles

Section 3 — Géographie :
- Carte Sénégal avec points des restaurants clients

Section 4 — Prévisions :
- "Vos prochaines ruptures de stock estimées"
- "Produits à tendance haussière"

---

### PAGE 7 — MESSAGES (/farmer/messages)

Layout type WhatsApp/Messenger :
- Colonne gauche : liste des conversations (Restaurant, Admin, Support)
  → Search "Rechercher une conversation"
  → Chaque item : photo + nom + dernier message + heure + badge non lu
- Zone centrale : conversation sélectionnée
  → Header : photo + nom + statut en ligne + bouton appel
  → Zone messages : bulles (envoyé = vert droite, reçu = gris gauche)
  → Timestamps sur les messages
  → Indicateur "En train d'écrire..."
  → Zone de saisie : input + emoji + pièce jointe + bouton envoyer
- Colonne droite (optionnel desktop) : infos du contact + commandes liées

---

### PAGE 8 — PARAMÈTRES (/farmer/settings)

Tabs :
1. Mon profil — photo, nom, bio, contacts, localisation, certifications
2. Mon exploitation — nom, superficie, types de culture, photos
3. Paiements — Wave (numéro), Orange Money, Free Money, compte bancaire
4. Notifications — toggles par type : nouvelle commande, paiement reçu, message, alerte stock
5. Sécurité — changer mot de passe, sessions actives, 2FA
6. Abonnement — plan actuel (Gratuit), avantages premium, bouton "Passer au premium"
```

---

PHASE 4 — DASHBOARD RESTAURANT (MARKETPLACE)

```
PHASE 4 : Crée le Dashboard complet du Restaurant de DIAMBAR AGRO.
Expérience de type Uber Eats / Deliveroo — navigation fluide, catalogue immersif.

---

### NAVIGATION SIDEBAR RESTAURANT

1. Accueil / Catalogue — icône Home
2. Mes Commandes — icône ShoppingCart (badge)
3. Suivi Livraisons — icône MapPin
4. Favoris — icône Heart
5. Mes Fournisseurs — icône Users
6. Historique — icône Clock
7. Factures — icône FileText
8. Messages — icône MessageSquare
9. Paramètres — icône Settings
---
En bas : avatar + nom restaurant + plan (Gratuit/Premium)

---

### PAGE 1 — CATALOGUE / ACCUEIL (/restaurant/catalogue)

BARRE DE RECHERCHE HERO (inspirée Deliveroo) :
- Fond dégradé vert sombre
- Texte : "Bonjour Le Baobab, que cherchez-vous aujourd'hui ?"
- Grande search bar : "Tomates, poulet, oignons..."
- Filtres rapides en pills : Légumes | Fruits | Viandes | Céréales | Bio | Disponible maintenant
- Info livraison : "Livraison disponible · Dakar et Thiès"

SECTION — Catégories (scroll horizontal) :
Icônes circulaires avec label sous chaque :
🥦 Légumes | 🍎 Fruits | 🍗 Volaille | 🥩 Viandes | 🌾 Céréales | 🍠 Tubercules | 🌿 Épices | ⭐ Bio

SECTION — Promos du moment (bannière) :
- Card large avec fond vert + "Livraison gratuite ce week-end pour toute commande > 50 000 FCFA"

SECTION — Producteurs en vedette :
Cards agriculteurs (scroll horizontal, 4 visible) :
Chaque card : photo agriculteur (Unsplash), nom, lieu, note, badge "Certifié", nombre de produits, bouton "Voir les produits"

SECTION — Produits populaires :
Grille 4 colonnes (desktop) — Cards produits style Uber Eats :
- Photo produit (rectangle, ratio 4:3)
- Badge agriculteur (coin haut gauche)
- Cœur favori (coin haut droit)
- Nom produit
- Prix : "850 FCFA / kg"
- Quantité min : "Min. 5 kg"
- Disponibilité : badge vert "En stock" ou orange "Dès mardi"
- Note agriculteur : ★ 4.8
- Bouton "+ Ajouter" (round, vert) → incrémente le panier

SECTION — Nouveaux producteurs :
Cards agriculteurs récemment inscrits

---

### SOUS-PAGE — PAGE PRODUIT (/restaurant/products/:id)

Header : breadcrumb Catalogue > Légumes > Tomates

Layout 2 colonnes :

Gauche — Galerie photos :
- Grande photo principale + thumbnails
- Badge "Certifié Agriculture Raisonnée" si applicable

Droite — Détails :
- Nom du produit (H1 large)
- Note : ★★★★★ 4.9 (89 avis) — lien vers les avis
- Prix : "850 FCFA / kg" (grand, vert)
- Disponibilité : "En stock — 200 kg disponibles"
- Lieu de collecte : "Ferme Diallo — Thiès, 45 km de Dakar"
- Délai de livraison estimé : "Demain entre 8h et 12h"
- Sélecteur quantité (input number avec +/-)
- Bouton "+ Ajouter au panier" (primary, large)
- Bouton "Acheter maintenant" (secondary)

Accordéon informations :
- Description complète du produit
- Informations sur l'agriculteur (photo, bio, certifications, note globale, autres produits)
- Conditions de vente (quantité min, délai, annulation)
- Avis clients (liste des 10 derniers avis avec note, date, texte)

Section "D'autres produits de Mamadou Diallo" (scroll horizontal)
Section "Vous aimerez aussi" (recommandations)

---

### COMPOSANT — PANIER (drawer latéral)

S'ouvre depuis le bouton panier du header (badge avec nombre d'articles)

Header drawer : "Mon panier (4 articles)"

Liste des produits dans le panier :
Chaque ligne :
- Photo miniature
- Nom + agriculteur
- Prix unitaire
- Sélecteur quantité (- / nombre / +)
- Bouton supprimer (icône poubelle)
- Sous-total ligne

Séparateur

Résumé commande :
- Sous-total : 234 500 FCFA
- Frais de livraison : 2 500 FCFA
- Commission service : 23 450 FCFA (10%)
- ─────────────
- Total : 260 450 FCFA
- Champ code promo
- Bouton "Passer la commande →" (primary, full width)
- Mode paiement : "Wave, Orange Money, Espèces"

---

### PAGE 2 — CONFIRMATION ET PAIEMENT (/restaurant/checkout)

Étape 1 — Récapitulatif commande :
- Liste produits avec quantités
- Adresse de livraison (pré-remplie + modifier)
- Date et créneau de livraison souhaité (date picker + select créneau)
- Note pour l'agriculteur (textarea)
- Mode livraison : Livraison à domicile | Retrait sur place

Étape 2 — Paiement :
- Choix du mode :
  → Wave (icône Wave) : entrer numéro ou QR code
  → Orange Money : entrer numéro
  → Free Money : entrer numéro
  → Paiement à la livraison (espèces)
- Récapitulatif final
- Bouton "Confirmer et payer"

Étape 3 — Confirmation :
- Animation succès (check animé vert)
- "Commande #CMD-2851 confirmée !"
- Récapitulatif
- "Votre livreur sera assigné dans les prochaines minutes"
- Bouton "Suivre ma commande" → redirige vers tracking

---

### PAGE 3 — SUIVI DES LIVRAISONS (/restaurant/tracking)

Liste des commandes en cours (à gauche, scrollable)
Chaque commande : numéro, produits, statut, ETA

Carte GPS interactive (à droite, grande) :
- Position livreur animée (point vert pulsant)
- Position du restaurant (point orange)
- Trajet estimé en ligne verte
- Infobulle livreur : photo, nom, note, téléphone

Panel livraison active :
- Nom livreur + photo + note + téléphone (bouton appel)
- ETA : "Arrivée dans 18 minutes"
- Timeline statuts :
  ✓ Commande confirmée (10h30)
  ✓ Livreur assigné — Oumar Ba (10h45)
  ✓ Récupéré chez l'agriculteur (11h15)
  → En route vers votre restaurant (en cours)
  ○ Livré
- Produits : liste + quantités
- Bouton "Contacter le livreur" (chat ou appel)
- Bouton "Signaler un problème"

---

### PAGE 4 — MES COMMANDES (/restaurant/orders)

Tabs : En cours | En attente | Livrées | Annulées

Chaque commande (card expandable) :
- En-tête : numéro, date, montant, statut coloré, agriculteur
- Contenu déplié : produits détaillés, livreur, timeline, facture PDF, notation

Historique filtrable : par date, par agriculteur, par statut

---

### PAGE 5 — MES FOURNISSEURS (/restaurant/suppliers)

Grille des agriculteurs avec qui le restaurant a déjà commandé :
- Photo, nom, lieu, note, CA total avec eux
- Bouton "Voir les produits" | "Contacter" | "Commander à nouveau"

Section "Agriculteurs recommandés" (basé sur la localisation et les habitudes)

---

### PAGE 6 — FACTURES (/restaurant/invoices)

Tableau factures :
Colonnes : N° facture | Date | Commande | Montant | Statut (payé/en attente) | Actions (télécharger PDF)

Bouton "Exporter toutes les factures (Excel)"
Synthèse mensuelle des dépenses avec graphique
```

---

PHASE 5 — DASHBOARD LIVREUR

```
PHASE 5 : Crée le Dashboard complet du Livreur de DIAMBAR AGRO.
Interface mobile-first, inspirée Uber Eats Driver. Grandes cartes, carte GPS centrale, actions rapides.

---

### NAVIGATION LIVREUR (bottom navigation mobile + sidebar desktop)

1. Accueil — icône Home
2. Missions — icône Package
3. Carte — icône Map
4. Revenus — icône Wallet
5. Profil — icône User

---

### PAGE 1 — ACCUEIL LIVREUR (/driver/home)

HEADER STATUS :
- Nom du livreur : "Oumar Ba"
- Toggle géant ONLINE / OFFLINE (vert vif / gris) — bouton rond avec label
- Statut actuel en grand : "DISPONIBLE" ou "HORS LIGNE"
- Aujourd'hui : X missions | X FCFA gagnés

CARTE GPS FULLSCREEN (occupe 60% de la page) :
- Carte dark style (Mapbox ou simulation)
- Position livreur (point bleu pulsant)
- Missions disponibles à proximité (points verts sur la carte)
- Zone de couverture active (overlay transparent)

SECTION MISSION EN COURS (si mission active) :
Grande card bleue en bas :
- Photo + nom agriculteur
- Adresse de collecte
- Photo + nom restaurant
- Adresse de livraison
- Distance : 12 km
- Estimation : 25 min
- Montant : 3 500 FCFA
- Boutons : "Naviguer →" (ouvre GPS) | "Contacter"
- Barre de progression : Accepté → En route collecte → Collecté → En livraison → Livré
- Bouton statut selon étape : "J'arrive à la collecte" | "Produits récupérés" | "Livraison effectuée"

SECTION NOUVELLE MISSION DISPONIBLE (notification popup) :
Grande carte modale avec countdown 30 secondes :
- Qui ? Restaurant Le Baobab
- Quoi ? Tomates 50kg + Oignons 30kg
- D'où ? Ferme Diallo — Thiès
- Vers ? Le Baobab — Dakar Plateau
- Distance : 8 km
- Rémunération : 4 000 FCFA
- Bouton "Accepter" (vert) | "Refuser" (rouge)

---

### PAGE 2 — MISSIONS (/driver/missions)

Tabs : Active | Disponibles | Historique

Active : affiche la mission en cours avec tous les détails + navigation

Disponibles : liste des missions non assignées dans sa zone

Historique :
- Toutes les missions terminées
- Filtre par période
- Total : 87 missions | 215 000 FCFA gagnés (ce mois)
- Chaque ligne : date, trajet, montant, note reçue, statut

---

### PAGE 3 — REVENUS (/driver/revenue)

KPI cards :
- Aujourd'hui : 8 500 FCFA
- Cette semaine : 47 000 FCFA
- Ce mois : 185 000 FCFA
- Taux d'acceptation : 94%

Graphique revenus (7 jours, barres)

Wallet :
- Solde Wave : 45 000 FCFA
- Solde Orange Money : 12 500 FCFA
- Bouton "Retirer" → modale avec montant + confirmation

Tableau des missions payées :
Date | Trajet | Distance | Durée | Montant | Mode paiement

---

### PAGE 4 — PROFIL LIVREUR (/driver/profile)

- Photo de profil + modification
- Informations : nom, téléphone, zone de livraison, type véhicule
- Stats : note moyenne (★4.9), missions totales (234), taux satisfaction (98%)
- Documents : CNI (statut vérifié ✓), Permis (vérifié ✓), Photo véhicule
- Paiements : Wave, Orange Money configurés
- Paramètres notifications
- Disponibilités (jours/heures de travail habituels)
```

---

PHASE 6 — DASHBOARD ADMINISTRATEUR

```
PHASE 6 : Crée le Dashboard complet de l'Administrateur de DIAMBAR AGRO.
Interface enterprise SaaS ultra-premium, contrôle total de la plateforme.

---

### NAVIGATION SIDEBAR ADMIN

1. Vue d'ensemble — icône LayoutDashboard
2. Utilisateurs — icône Users (sous-menu : Agriculteurs, Restaurants, Livreurs)
3. Commandes — icône ShoppingBag
4. Livraisons — icône Truck
5. Produits — icône Package
6. Finances — icône DollarSign
7. Analytics — icône BarChart2
8. Support — icône HeadphonesIcon
9. Paramètres — icône Settings
---
Bas : "Admin — Diambar Agro" + badge "Super Admin"

---

### PAGE 1 — VUE D'ENSEMBLE (/admin/dashboard)

Header : "Bonjour Admin 👋 — Voici l'état de la plateforme en temps réel"
Bouton : "Générer le rapport du jour"

Ligne 1 — 6 KPI cartes :
- Utilisateurs actifs : 127 (↑ +8 cette semaine)
- Agriculteurs : 23 (5 en attente de validation)
- Restaurants : 38 (3 nouveaux)
- Livreurs : 12 (8 online maintenant)
- Commandes aujourd'hui : 47
- CA plateforme aujourd'hui : 1 240 000 FCFA

Ligne 2 — Graphiques principaux :
- Graphique area chart : CA plateforme (30 jours) — ligne verte remplie
- Camembert : répartition commissions par source
- Carte live : positions des livreurs actifs (points bleus clignotants)

Ligne 3 — Alertes et actions urgentes :
- "5 comptes agriculteurs en attente de validation"
- "2 litiges non résolus"
- "3 produits signalés"
- Chaque alerte avec bouton "Traiter →"

Ligne 4 — Activité en temps réel (live feed) :
Timeline automatiquement mise à jour des événements :
→ 14:32 Nouvelle commande #CMD-2851 — Le Baobab — 87 400 FCFA
→ 14:28 Livreur Oumar Ba a confirmé livraison #CMD-2847
→ 14:15 Nouveau compte agriculteur : Fatou Sow — Dakar Pikine (en attente de validation)
...

---

### PAGE 2 — GESTION UTILISATEURS

#### Sous-page Agriculteurs (/admin/users/farmers)

Tabs : Tous | Actifs | En attente | Suspendus

Tableau avec colonnes :
Photo | Nom | Lieu | Produits | Commandes totales | CA généré | Note | Statut | Date inscription | Actions

Actions par ligne :
- Voir le profil complet (drawer latéral)
- Valider/Rejeter (si en attente)
- Suspendre/Réactiver
- Voir les commandes liées

Drawer "Profil agriculteur" :
- Toutes les infos du profil
- Documents soumis avec statut vérification (CNI, photo ferme)
- Historique des commandes
- Avis reçus
- Boutons : Valider ✓ | Rejeter avec message | Suspendre | Contacter

#### Sous-page Restaurants (/admin/users/restaurants)
(Même structure, adapté au rôle restaurant)

#### Sous-page Livreurs (/admin/users/drivers)
(Même structure + missions en cours, zone de couverture)

---

### PAGE 3 — GESTION DES COMMANDES (/admin/orders)

Vue tabulaire complète de toutes les commandes plateforme

Filtres : période | statut | agriculteur | restaurant | livreur | montant min/max

Tableau colonnes :
#Commande | Date | Restaurant | Agriculteur | Livreur | Produits | Montant | Commission | Statut | Actions

Vue Kanban alternative (drag & drop entre colonnes) :
Colonnes : En attente | Confirmée | En préparation | En livraison | Livrée | Annulée | Litige

---

### PAGE 4 — SUIVI DES LIVRAISONS EN TEMPS RÉEL (/admin/deliveries)

Carte pleine largeur (70% de l'écran) :
- Tous les livreurs actifs positionnés sur la carte (points colorés selon statut)
- Toutes les commandes en cours avec trajet dessiné
- Click sur un livreur → popup avec infos + commande active

Liste des livraisons actives (30% de l'écran, défilante) :
Chaque item : livreur, commande, ETA, statut, retard éventuel (badge rouge)

---

### PAGE 5 — FINANCES (/admin/finances)

Sous-onglet Aperçu :
- CA total plateforme
- Total commissions perçues
- Remboursements effectués
- Bénéfice net

Sous-onglet Transactions :
Tableau de toutes les transactions (commandes + commissions + remboursements)

Sous-onglet Commissions :
- Taux par agriculteur (modifiable)
- Total commissions ce mois : 124 350 FCFA
- Bouton "Générer le rapport" + export Excel

---

### PAGE 6 — ANALYTICS PLATEFORME (/admin/analytics)

Section Croissance :
- Graphique utilisateurs inscrits par semaine (12 semaines)
- Taux de rétention utilisateurs
- Taux de conversion inscription → première commande

Section Performance :
- Délai moyen de livraison : 47 min
- Taux de livraison réussie : 97.3%
- Note moyenne plateforme : ★4.8
- Produits les plus commandés (top 10)

Section Géographie :
- Carte chaleur (heatmap) des commandes par quartier

Section Prévisions :
- Projection CA prochain mois
- Zones géographiques à fort potentiel

---

### PAGE 7 — SUPPORT (/admin/support)

Tickets ouverts (liste + filtres par urgence)
Chaque ticket : utilisateur, sujet, date, statut, assigné à
Boutons : Répondre | Fermer | Escalader

Système de réponse intégré (textarea + templates de réponse)

Chat direct admin ↔ n'importe quel utilisateur

---

### PAGE 8 — PARAMÈTRES PLATEFORME (/admin/settings)

Onglets :
1. Général : nom plateforme, logo, contact, zones couvertes
2. Commissions : taux par catégorie d'utilisateur, règles de calcul
3. Livraison : tarifs par zone, délais standards
4. Paiements : configuration Wave/Orange Money, clés API
5. Notifications : modèles d'emails et SMS
6. Sécurité : gestion des accès, logs, 2FA obligatoire admin
7. Abonnements : plans tarifaires, fonctionnalités par plan
```

---

PHASE 7 — SYSTÈME DE CHAT TEMPS RÉEL

```
PHASE 7 : Intègre le système de messagerie temps réel dans DIAMBAR AGRO.
Utilisable par tous les rôles, intégré dans leur dashboard respectif.

Composant ChatWindow réutilisable avec props : conversationId, recipientName, recipientAvatar, recipientRole

Fonctionnalités :
- Messages en temps réel (Supabase Realtime)
- Indicateur "En train d'écrire..." (typing indicator)
- Présence en ligne (point vert / gris)
- Partage d'images (upload + preview)
- Partage de commandes (card de commande cliquable dans le chat)
- Notifications badge non-lus
- Recherche dans les messages

Conversations possibles :
- Restaurant ↔ Agriculteur (pour précisions sur une commande)
- Restaurant ↔ Livreur (pour la livraison en cours)
- Admin ↔ tout utilisateur (support)
- Broadcast Admin → tous les agriculteurs / tous les restaurants

Interface :
- Colonne gauche : liste conversations avec avatar, nom, dernier message, heure, badge non-lus
- Zone centrale : messages (bulles vertes envoyé, grises reçu, timestamps, statut lu)
- Input zone : emoji picker + upload + input text + bouton envoyer
- Sur mobile : full screen, bouton retour
```

---

PHASE 8 — NOTIFICATIONS ET SYSTÈME D'ALERTES

```
PHASE 8 : Crée le système de notifications complet de DIAMBAR AGRO.

Composant NotificationCenter (drawer depuis le header, icône cloche + badge) :

Types de notifications (chacune avec icône colorée) :
- Nouvelle commande reçue (vert) — agriculteur
- Commande confirmée (vert) — restaurant
- Livreur assigné (bleu) — restaurant
- Livraison en cours (bleu) — restaurant
- Livraison effectuée (vert) ✓ — restaurant + agriculteur
- Paiement reçu (vert) 💰 — agriculteur + livreur
- Nouveau message (violet) — tous
- Alerte stock faible (orange) ⚠️ — agriculteur
- Compte validé (vert) ✓ — nouvel utilisateur
- Nouvelle mission disponible (bleu) — livreur
- Avis reçu (jaune) ★ — agriculteur

Chaque notification :
- Icône + couleur selon type
- Titre court
- Description
- Heure (relative : "il y a 5 min")
- Lien vers la page concernée (click → naviguer)
- Bouton "Marquer comme lu"

Actions globales : "Tout marquer comme lu" | "Tout supprimer"

Page Paramètres notifications (dans Settings de chaque dashboard) :
Toggle ON/OFF pour chaque type, par canal : In-app | Email | SMS
```

---

PHASE 9 — RESPONSIVE MOBILE & POLISSAGE FINAL

```
PHASE 9 : Optimise DIAMBAR AGRO pour mobile et effectue le polissage final.

RESPONSIVE MOBILE (priorité absolue) :

Navigation mobile :
- Sidebar cachée sur mobile (< 768px)
- Bottom navigation bar fixe (5 icônes max selon le rôle)
- Hamburger menu pour accéder aux pages secondaires
- Swipe gesture pour ouvrir/fermer la sidebar

Adaptations pages clés sur mobile :
- Catalogue restaurant : scroll vertical, 1 colonne, cartes full-width
- Dashboard agriculteur : KPI en 2 colonnes, graphiques simplifiés
- Livreur dashboard : carte GPS full height, actions en overlay bottom sheet
- Chat : full screen, keyboard-aware

POLISSAGE FINAL :

1. Loading states :
- Skeleton loaders sur toutes les listes et cartes (animation pulse)
- Spinner sur les boutons d'action pendant les requêtes
- Empty states illustrés (pas de commandes, pas de produits)

2. Error states :
- Page 404 stylisée avec logo + lien retour
- Erreur de connexion réseau (toast + bouton réessayer)
- Formulaire validation avec messages d'erreur inline

3. Animations :
- Page transitions : fadeIn 200ms
- Cards : slideUp au scroll (Intersection Observer)
- Modales : scale + fade
- Toast notifications (Sonner ou shadcn toast) : slide in depuis le bas à droite

4. Micro-interactions :
- Bouton panier : animation bounce au clic
- Toggle online livreur : animation couleur fluide
- Ajout produit au panier : animation +1 sur le badge
- Success actions : confetti léger (commande passée, compte validé)

5. Accessibilité :
- Contraste suffisant sur tous les textes
- Focus visible sur les éléments interactifs
- Labels sur tous les inputs
- ARIA labels sur les icônes seules

6. Performance :
- Images : lazy loading partout
- Listes longues : virtualization (react-window si nécessaire)
- Code splitting par route

DERNIÈRES VÉRIFICATIONS :
- Tester tous les flows complets : inscription → onboarding → première action
- Vérifier la cohérence visuelle entre toutes les pages
- S'assurer que toutes les données de démo sont présentes
- Vérifier que le routing fonctionne (React Router)
- Confirmer que Supabase Auth est bien connecté
```

---

RÉCAPITULATIF DES PHASES

| Phase               | Contenu                                                                      | Priorité               |
| ------------------- | ---------------------------------------------------------------------------- | ---------------------- |
| 0 — Cadrage         | Brief global, identité visuelle, données démo                                | Obligatoire en premier |
| 1 — Landing         | Page marketing publique complète                                             | Haute                  |
| 2 — Auth            | Login, Register (4 étapes), OTP, Onboarding                                  | Haute                  |
| 3 — Agriculteur     | Dashboard complet : produits, stock, commandes, revenus, analytics, messages | Haute                  |
| 4 — Restaurant      | Catalogue type Uber Eats, panier, checkout, tracking, factures               | Haute                  |
| 5 — Livreur         | Interface mobile-first, missions, GPS, revenus, wallet                       | Moyenne                |
| 6 — Admin           | Vue d'ensemble, gestion utilisateurs, finances, analytics, support           | Moyenne                |
| 7 — Chat            | Messagerie temps réel Supabase pour tous les rôles                           | Moyenne                |
| 8 — Notifications   | Centre de notifications, paramètres par canal                                | Basse                  |
| 9 — Mobile & Polish | Responsive, loading states, animations, micro-interactions                   | Basse                  |

---

Document généré pour DIAMBAR AGRO — "Du Champ à Votre Cuisine"
Plateforme de logistique alimentaire — Sénégal 🇸🇳. les structures des codes doivent etre CLEAN,SCALABLE et MAINTENABLE

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/224c7763-4414-4c64-a35e-633d395507ea).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
