# FiltrePlante - Gestion de Stock

## Vue d'ensemble
Application web mobile-first de gestion de stock pour une équipe de 5 personnes (Marine, Fatou, Michael, Cheikh, Papa).
Michael est l'administrateur, Marine est responsable du stock.

## État Actuel - Application Complète et Fonctionnelle ✅
**Date:** 18 octobre 2025
**Statut:** Production Ready

L'application est entièrement implémentée, testée et opérationnelle:
- ✅ Base de données PostgreSQL configurée et peuplée (305 produits importés)
- ✅ Backend complet avec toutes les routes API
- ✅ Frontend avec toutes les pages fonctionnelles
- ✅ Import CSV automatique au démarrage
- ✅ Système de validation admin opérationnel
- ✅ **Authentification admin par mot de passe (bcrypt)** (NOUVEAU)
- ✅ **Système de liste pour actions groupées** (renommage panier → liste) (NOUVEAU)
- ✅ **Modale de confirmation avant navigation** (NOUVEAU)
- ✅ **Page DÉPOSER unifiée** (fusion RENDRE + DÉPOSER avec 3 onglets) (NOUVEAU)
- ✅ **Création produit depuis PRENDRE et DÉPOSER** (NOUVEAU)
- ✅ Tests end-to-end réussis
- ✅ Design mobile-first avec accessibilité tactile (48px minimum)
- ✅ Bug critique corrigé: filtrage produits en_attente

## Architecture

### Base de données PostgreSQL (Drizzle ORM)
- **users**: 5 utilisateurs (Marine, Fatou, Michael [admin], Cheikh, Papa)
  - Nouveau: passwordHash (bcrypt) pour Marine et Michael (mot de passe: "Fplante@Stock1!")
- **products**: 305 produits importés depuis CSV
  - Champs: catégorie, sous-section, nom, unité, stockActuel, stockMinimum, statut (valide/en_attente)
- **movements**: Mouvements de stock
  - Types: pret, consommation, retour, depot
  - Statut: en_cours, termine
- **alerts**: Alertes et notifications
  - Types: retard_emprunt, nouveau_produit, stock_faible
- **listes**: Listes d'actions en attente (renommé de "paniers")
  - Champs: utilisateurId, dateModification
- **liste_items**: Items dans les listes
  - Champs: listeId, produitId, quantite, type (pret/consommation), empruntId (pour retours)

### Frontend (React + TypeScript)
- Stack: Vite, React, Wouter, TanStack Query, Shadcn UI, Tailwind CSS
- Design: Mobile-first optimisé pour smartphone (48px touch targets)
- Thème: Inter font, indicateurs colorés (Vert/Orange/Rouge)

### Pages principales
1. **Home** (`/`): Sélection utilisateur, stats rapides, liste emprunts en cours, 3 boutons d'action (PRENDRE, DÉPOSER, STOCK), badge liste
2. **Prendre** (`/prendre`): Navigation Catégorie → Sous-section → Produit avec bouton "Ajouter à ma liste" + formulaire création produit
3. **Déposer** (`/deposer`): Page unifiée avec 3 onglets:
   - **Mes emprunts**: Liste emprunts utilisateur actuel avec durée écoulée et retour
   - **Tous les emprunts**: Liste TOUS les emprunts (tous utilisateurs) avec nom emprunteur et retour
   - **Ajouter du stock**: Arborescence Catégorie → Sous-section → Produit (incluant stock=0) + formulaire création produit
4. **Ma liste** (`/panier`): Vue groupée des actions (PRENDRE/RENDRE), retrait d'items, vidage et validation groupée
5. **Stock** (`/stock`): Vue par catégorie avec filtres (OK/Faible/Vide) et accordéons
6. **Admin** (`/admin`): Validation produits en attente (Michael uniquement, protégé par mot de passe)
7. **Redirection**: `/rendre` → redirige automatiquement vers `/deposer`

## Fonctionnalités Implémentées ✅

### Gestion Utilisateurs
- Sélection utilisateur sans mot de passe (localStorage)
- Context React pour utilisateur actuel
- Interface admin conditionnelle (role=admin)
- **Authentification admin par mot de passe**: Marine et Michael doivent entrer "Fplante@Stock1!" pour accéder à /admin
  - Hachage bcrypt côté serveur
  - Modale de saisie avec validation
  - Endpoint POST /api/auth/verify-password

### Gestion Stock
- Calcul stock temps réel (stockActuel - emprunts en cours)
- Indicateurs colorés selon statut stock:
  - Vert: stock > stockMinimum
  - Orange: stock ≤ stockMinimum
  - Rouge: stock = 0
- Filtres intelligents (Tous/OK/Faible/Vide)
- Recherche en temps réel

### Gestion Emprunts
- Types de mouvements:
  - Prêt (à rendre, statut en_cours)
  - Consommation (définitif, stock réduit immédiatement)
- Badges durée emprunt avec codes couleur:
  - Vert: < 7 jours
  - Orange: 7-14 jours
  - Rouge: ≥ 15 jours
- Retour partiel ou total

### Validation Admin
- **Authentification par mot de passe**: Marine et Michael doivent s'authentifier pour accéder à /admin
- Création nouveaux produits (statut en_attente)
- Validation par Michael ou Marine avant utilisation
- Filtrage sécurisé: produits non validés invisibles dans PRENDRE/DÉPOSER
- Validation défensive côté serveur (empêche emprunts de produits non validés)

### Création de Produits ✅ NOUVEAU
- **Composant réutilisable**: CreateProductForm avec dropdowns dynamiques
- **Disponible depuis**: Page PRENDRE et onglet "Ajouter du stock" de DÉPOSER
- **Fonctionnalités**:
  - Dropdown catégories avec chargement des sous-sections dynamique
  - Option "Nouvelle sous-section" pour créer nouvelle sous-section
  - Validation défensive (empêche soumission catégories/sous-sections vides)
  - Création en statut "en_attente" → validation admin requise
- **Endpoint**: GET /api/categories/:categorie/sous-sections

### Page DÉPOSER Unifiée ✅ NOUVEAU
**Fusion RENDRE + DÉPOSER en une seule page avec onglets**
- **Onglet 1 - Mes emprunts**: Workflow RENDRE pour utilisateur actuel uniquement
  - Liste emprunts en cours avec badges durée (vert/orange/rouge)
  - Bouton retour avec quantité
- **Onglet 2 - Tous les emprunts**: Workflow RENDRE pour TOUS les utilisateurs
  - Affiche nom de l'emprunteur (enrichissement côté serveur)
  - Permet à n'importe qui de retourner n'importe quel emprunt
  - Endpoint: GET /api/movements/active (retourne tous emprunts avec user)
- **Onglet 3 - Ajouter du stock**: Workflow DÉPOSER classique
  - Arborescence Catégorie → Sous-section → Produit
  - **Inclut produits avec stock=0** (changement important!)
  - Bouton "Créer nouveau produit"
  - Breadcrumb navigation et boutons retour

### Système de Liste (Actions Groupées) ✅ NOUVEAU
**Renommage complet: panier → liste**
- **Badge compteur** dans navigation principale (icône ShoppingCart)
- **Ajout à la liste** depuis PRENDRE et workflows DÉPOSER (onglets Mes/Tous emprunts)
- **Page Ma liste** (`/panier`) avec affichage groupé:
  - Section "À PRENDRE" avec produits et types (prêt/consommation)
  - Section "À RENDRE" avec emprunts et quantités
- **Actions liste**:
  - Retirer item individuel
  - Vider toute la liste
  - Valider ensemble (crée tous mouvements en une fois)
- **UX optimisée**: reset automatique après ajout pour continuer parcours
- **Modale de confirmation**: Si liste non vide et navigation, propose 3 choix:
  - Continuer sans valider
  - Valider la liste maintenant
  - Vider la liste
- **Invalidation cache**: queries liste, mouvements, produits invalidées après chaque action

### Import de Données
- Import CSV automatique au démarrage (305 produits)
- Parser configuré pour guillemets spéciaux (relax_quotes)
- Gestion des doublons

## API Endpoints Implémentés

### Produits
- `GET /api/products` - Liste produits validés avec stock calculé
- `GET /api/products/pending` - Produits en attente de validation (admin)
- `GET /api/categories` - Liste catégories avec compteurs
- `POST /api/products` - Créer nouveau produit (statut en_attente)
- `POST /api/products/:id/validate` - Valider produit (admin)
- `PUT /api/products/:id` - Modifier produit (admin)
- `DELETE /api/products/:id` - Supprimer produit (admin)
- `POST /api/import-csv` - Importer CSV produits

### Mouvements
- `GET /api/movements/active` - TOUS les emprunts en cours (tous utilisateurs) avec enrichissement user (NOUVEAU)
- `GET /api/movements/active/:userId` - Emprunts en cours utilisateur
- `POST /api/movements/borrow` - Emprunter produit (avec validation statut)
- `POST /api/movements/return` - Retourner produit
- `POST /api/movements/deposit` - Déposer stock (avec validation statut)

### Listes (Actions Groupées)
- `GET /api/liste/:userId` - Récupérer liste utilisateur
- `POST /api/liste/:userId/add-borrow` - Ajouter produit à emprunter à la liste
- `POST /api/liste/:userId/add-return` - Ajouter retour à la liste
- `POST /api/liste/:userId/remove/:itemId` - Retirer item de la liste
- `DELETE /api/liste/:userId` - Vider toute la liste
- `POST /api/liste/:userId/validate` - Valider tous les items (crée mouvements)

### Auth Admin
- `POST /api/auth/verify-password` - Vérifier mot de passe admin (body: {userId, password})

### Catégories
- `GET /api/categories/:categorie/sous-sections` - Récupérer sous-sections d'une catégorie (NOUVEAU)

### Utilisateurs & Alertes
- `GET /api/users` - Liste utilisateurs
- `GET /api/alerts/unread/:userId` - Alertes non lues

## Structure du Projet
```
client/
  src/
    components/
      ui/                      # Shadcn UI components
      user-selector.tsx        # Dropdown sélection utilisateur
      stock-badge.tsx          # Badges stock colorés
      loan-duration-badge.tsx  # Badges durée emprunt
    lib/
      types.ts                 # Types TypeScript
      user-context.tsx         # Context utilisateur actuel
      queryClient.ts           # TanStack Query config
    pages/
      home.tsx                 # Page d'accueil
      prendre.tsx              # Page emprunt
      rendre.tsx               # Page retour
      deposer.tsx              # Page dépôt/création
      stock.tsx                # Page inventaire
      admin.tsx                # Page validation admin
shared/
  schema.ts                    # Schéma Drizzle complet
server/
  storage.ts                   # DatabaseStorage (PostgreSQL)
  routes.ts                    # Routes API Express (15+ endpoints)
  init-data.ts                 # Import CSV + données initiales
  db.ts                        # Connexion base de données
  index.ts                     # Server Express principal
```

## Données de Test
- 5 utilisateurs prédéfinis (team members)
- 305 produits importés depuis CSV
- 3 mouvements de démonstration créés au démarrage

## Corrections Importantes

### Bug Critique Corrigé (18 oct 2025)
**Problème:** Les produits en_attente étaient visibles dans /prendre et /deposer avant validation admin.

**Solution:**
1. Filtrage GET /api/products pour ne retourner que les produits validés
2. Validation défensive dans POST /api/movements/borrow et /api/movements/deposit
3. Tests end-to-end pour vérifier le comportement

### Améliorations UI
- Bouton admin ajusté à 48px minimum (accessibilité tactile)
- Tous les boutons principaux vérifient les standards d'accessibilité
- Police Inter pour meilleure lisibilité

## Tests End-to-End ✅
Tests Playwright réussis couvrant:
- Sélection utilisateur (Marine, Michael)
- Emprunt produit (MARTEAU)
- Retour produit
- Création nouveau produit (PRODUIT TEST XYZ)
- Validation admin
- Navigation toutes pages
- Filtres et recherche (PELLE)
- Vérification couleurs badges

## Améliorations Futures Possibles
- ⏳ Système d'alertes automatiques J+15 pour retards
- ⏳ Notifications push/email pour Marine
- ⏳ Export CSV du stock
- ⏳ Historique complet des mouvements
- ⏳ Statistiques avancées
- ⏳ Mode hors-ligne (PWA)

## Choix Techniques

### Design
- Material Design adapté pour application utilitaire
- Mobile-first avec maximum 3 clics par action
- Codes couleur intuitifs (feu tricolore)

### Sécurité
- Pas de mots de passe (équipe interne de confiance)
- Validation côté serveur pour toutes mutations
- Filtrage produits non validés
- Vérification rôle admin

### Base de données
- PostgreSQL via Neon (Drizzle ORM)
- CSV parser: `relax_quotes: true` pour guillemets spéciaux
- Import automatique au démarrage
- Calcul stock en temps réel

## Démarrage
```bash
npm run dev
```

L'application démarre automatiquement et:
1. Vérifie/crée les utilisateurs
2. Importe les produits depuis CSV
3. Crée des mouvements de démonstration
4. Lance le serveur sur port 5000

## Utilisation
1. Ouvrir l'application sur smartphone
2. Sélectionner son nom (Marine, Fatou, Michael, Cheikh, Papa)
3. Utiliser les 4 actions principales: PRENDRE, RENDRE, DÉPOSER, STOCK
4. Michael peut accéder à l'interface admin pour valider les nouveaux produits

---

**Application prête pour utilisation en production!** ✅
