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
- ✅ **Système de panier pour actions groupées** (NOUVEAU)
- ✅ Tests end-to-end réussis
- ✅ Design mobile-first avec accessibilité tactile (48px minimum)
- ✅ Bug critique corrigé: filtrage produits en_attente

## Architecture

### Base de données PostgreSQL (Drizzle ORM)
- **users**: 5 utilisateurs (Marine, Fatou, Michael [admin], Cheikh, Papa)
- **products**: 305 produits importés depuis CSV
  - Champs: catégorie, sous-section, nom, unité, stockActuel, stockMinimum, statut (valide/en_attente)
- **movements**: Mouvements de stock
  - Types: pret, consommation, retour, depot
  - Statut: en_cours, termine
- **alerts**: Alertes et notifications
  - Types: retard_emprunt, nouveau_produit, stock_faible

### Frontend (React + TypeScript)
- Stack: Vite, React, Wouter, TanStack Query, Shadcn UI, Tailwind CSS
- Design: Mobile-first optimisé pour smartphone (48px touch targets)
- Thème: Inter font, indicateurs colorés (Vert/Orange/Rouge)

### Pages principales
1. **Home** (`/`): Sélection utilisateur, stats rapides, liste emprunts en cours, boutons d'action, badge panier
2. **Prendre** (`/prendre`): Navigation Catégorie → Sous-section → Produit avec boutons "Ajouter au panier" et "Valider maintenant"
3. **Rendre** (`/rendre`): Liste emprunts avec durée écoulée, boutons "Ajouter au panier" et "Valider maintenant"
4. **Panier** (`/panier`): Vue groupée des actions (PRENDRE/RENDRE), retrait d'items, vidage et validation groupée (NOUVEAU)
5. **Déposer** (`/deposer`): Ajout stock existant ou création nouveau produit (statut en_attente)
6. **Stock** (`/stock`): Vue par catégorie avec filtres (OK/Faible/Vide) et accordéons
7. **Admin** (`/admin`): Validation produits en attente (Michael uniquement)

## Fonctionnalités Implémentées ✅

### Gestion Utilisateurs
- Sélection utilisateur sans mot de passe (localStorage)
- Context React pour utilisateur actuel
- Interface admin conditionnelle (role=admin)

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
- Création nouveaux produits (statut en_attente)
- Validation par Michael avant utilisation
- Filtrage sécurisé: produits non validés invisibles dans PRENDRE/DÉPOSER
- Validation défensive côté serveur (empêche emprunts de produits non validés)

### Système de Panier (Actions Groupées) ✅ NOUVEAU
- **Badge compteur** dans navigation principale (icône ShoppingCart)
- **Ajout au panier** depuis PRENDRE et RENDRE workflows
- **Boutons dual-action**: "Ajouter au panier" (outline) + "Valider maintenant" (primary)
- **Page panier** avec affichage groupé:
  - Section "À PRENDRE" avec produits et types (prêt/consommation)
  - Section "À RENDRE" avec emprunts et quantités
- **Actions panier**:
  - Retirer item individuel
  - Vider tout le panier
  - Valider ensemble (crée tous mouvements en une fois)
- **UX optimisée**: reset automatique après ajout pour continuer parcours
- **Invalidation cache**: queries panier, mouvements, produits invalidées après chaque action

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
- `GET /api/movements/active/:userId` - Emprunts en cours utilisateur
- `POST /api/movements/borrow` - Emprunter produit (avec validation statut)
- `POST /api/movements/return` - Retourner produit
- `POST /api/movements/deposit` - Déposer stock (avec validation statut)

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
