# Design Guidelines - FiltrePlante Stock Management App

## Design Approach
**System-Based Approach**: Material Design principles adapted for mobile-first utility application with FiltrePlante brand identity
**Rationale**: Function-focused inventory management requiring clarity, efficiency, and data visibility with cohesive green/earth color palette

## Core Design Principles
1. **Mobile-First Efficiency**: Every interaction optimized for one-handed smartphone use
2. **Information Hierarchy**: Stock status visible at all times without extra taps
3. **Progressive Disclosure**: Show critical info first, details on demand
4. **Visual Feedback**: Immediate confirmation of all actions
5. **Brand Cohesion**: Consistent use of FiltrePlante green/earth palette throughout

## 🌿 FiltrePlante Color Palette

### Primary Brand Colors
- **Vert Principal** (#2E7D32): Header, navigation principale, éléments de marque
- **Vert Vif** (#4CAF50): Bouton PRENDRE, validations, confirmations positives
- **Bleu Eau** (#1565C0): Bouton DÉPOSER, informations, actions secondaires
- **Beige Terre** (#8D6E63): Bouton STOCK, sections neutres, éléments tertiaires
- **Vert Clair** (#E8F5E8): Fonds de sections, arrière-plans doux, zones admin

### Status & Alert Colors
- **Stock OK** (#4CAF50 - Vert Vif): Texte et indicateurs pour stock disponible
- **Stock Faible** (#FF8F00 - Orange Alerte): Texte et badges pour stock bas
- **Stock Vide** (#D32F2F - Rouge Urgent): Texte et alertes pour rupture
- **Emprunts Actifs** (#1565C0 - Bleu Eau): Badges et compteurs d'emprunts

### Light Mode (Couleurs de fond et texte)
- **Background**: 0 0% 98% (Blanc cassé)
- **Surface**: 0 0% 100% (Blanc pur)
- **Text Primary**: 0 0% 13% (Presque noir)
- **Text Secondary**: 0 0% 45% (Gris moyen)
- **Border**: 0 0% 85% (Gris clair)

### Dark Mode
- **Primary**: Vert Vif adapté (#66BB6A)
- **Background**: 0 0% 7% (Presque noir)
- **Surface**: 0 0% 11% (Gris très foncé)
- **Text Primary**: 0 0% 98% (Blanc cassé)
- **Text Secondary**: 0 0% 65% (Gris clair)

### HSL Conversions for Tailwind
Pour utiliser dans index.css (format HSL sans parenthèses):
- **Vert Principal** (#2E7D32): 123 48% 33%
- **Vert Vif** (#4CAF50): 122 39% 49%
- **Bleu Eau** (#1565C0): 210 79% 43%
- **Beige Terre** (#8D6E63): 15 25% 47%
- **Orange Alerte** (#FF8F00): 34 100% 50%
- **Rouge Urgent** (#D32F2F): 0 70% 51%
- **Vert Clair** (#E8F5E8): 120 31% 94%

## Typography
- **Font Family**: 'Inter' via Google Fonts CDN
- **Headings**: 600 weight, sizes 24px (H1), 20px (H2), 18px (H3)
- **Body**: 400 weight, 16px (readable on mobile)
- **Labels/Secondary**: 500 weight, 14px
- **Stock Numbers**: 700 weight (bold for quick scanning)

## Layout System
**Spacing Scale**: Tailwind units of 2, 4, 6, 8, 12, 16
- Card padding: p-4 to p-6
- Section spacing: gap-4 or gap-6
- Page margins: px-4 (mobile), px-6 (tablet+)
- Vertical rhythm: space-y-4 for lists, space-y-6 for sections

## Component Specifications

### Header & Navigation
- **Header "FiltrePlante"**: Fond Vert Principal (#2E7D32), texte blanc, hauteur 64px
- **User Selector**: Intégré dans le header, texte blanc sur fond vert
- **Badge session/panier**: Fond blanc avec nombre en Vert Principal (bon contraste), position top-right du header, ombre légère

### Action Buttons (Home Page)
- **Bouton PRENDRE**: Fond Vert Principal (#2E7D32), texte blanc, icône blanche (bon contraste WCAG AA)
- **Bouton DÉPOSER**: Fond Bleu Eau (#1565C0), texte blanc, icône blanche
- **Bouton STOCK**: Fond Beige Terre (#8D6E63), texte blanc, icône blanche
- **Bouton CTA "Valider ma liste"**: Fond Vert Principal (#2E7D32), texte blanc (accessibilité)
- **Bouton RENDRE**: Style outline avec bordure Vert Principal, texte Vert Principal
- Minimum height: 56px (mobile optimisé)
- Border radius: 12px (coins arrondis modernes)
- Box shadow: 0 2px 8px rgba(0,0,0,0.12) (ombres légères)
- Note: Vert Vif (#4CAF50) n'est pas utilisé pour les boutons car le contraste avec texte blanc < WCAG AA

### Product Cards
Display format: **"Product Name (current/total)"**
- Status indicator dot (left side, 10px diameter)
- Product name (bold, 16px)
- Stock fraction (regular, 14px, aligned right)
- Card height: min 72px for comfortable tapping
- Border radius: 8px
- Hover: subtle elevation shadow

### Stock Display Badges
- **Stock OK**: Fond Vert Vif (#4CAF50), texte blanc
- **Stock Faible**: Fond Orange Alerte (#FF8F00), texte blanc
- **Stock Vide**: Fond Rouge Urgent (#D32F2F), texte blanc
- Format: "5 disponibles" ou "Stock faible (2)" ou "Rupture"
- Border radius: 16px (pill shape)
- Padding: py-1 px-3
- Font weight: 500

### Loan Duration Badges
- **< 7 jours**: Fond Vert Vif (#4CAF50), texte blanc
- **7-14 jours**: Fond Orange Alerte (#FF8F00), texte blanc
- **15+ jours**: Fond Rouge Urgent (#D32F2F), texte blanc
- Format: "Emprunté depuis X jours"
- Border radius: 16px (pill shape)

### Forms (Quantity Input)
- Large numeric input with +/- steppers
- Boutons +/- avec fond Vert Vif (#4CAF50), texte blanc
- Minimum touch target: 56px for +/- buttons
- Current value centered and bold
- Border radius: 8px

### Admin Interface
- **Background**: Vert Clair (#E8F5E8) pour toute la page admin
- **Pending products**: Badge "En attente" Orange Alerte, cards avec fond blanc
- **Action buttons**: 
  - Valider: Fond Vert Principal (#2E7D32), texte blanc (accessibilité)
  - Modifier: Fond Bleu Eau (#1565C0), texte blanc
  - Supprimer: Fond Rouge Urgent (#D32F2F), texte blanc
- Clear product details preview with proper spacing

### Alerts/Notifications
- Toast notifications: Top of screen, auto-dismiss 3s
- Success: Fond Vert Vif (#4CAF50)
- Warning: Fond Orange Alerte (#FF8F00)
- Error: Fond Rouge Urgent (#D32F2F)
- Info: Fond Bleu Eau (#1565C0)
- Border radius: 8px
- Box shadow: 0 4px 12px rgba(0,0,0,0.15)

## ✨ Visual Enhancements

### Coins Arrondis (Border Radius)
- **Boutons principaux**: 12px (rounded-xl)
- **Cards**: 8px (rounded-lg)
- **Badges/Pills**: 16px ou 9999px (rounded-full)
- **Inputs**: 8px (rounded-lg)
- **Modals**: 12px (rounded-xl)

### Ombres (Shadows)
- **Boutons**: 0 2px 8px rgba(0,0,0,0.12) au repos, 0 4px 12px rgba(0,0,0,0.18) au hover
- **Cards**: 0 1px 4px rgba(0,0,0,0.08)
- **Modals**: 0 8px 24px rgba(0,0,0,0.15)
- **Notifications**: 0 4px 12px rgba(0,0,0,0.15)

### Icônes
- **Style**: Lucide React (cohérent dans toute l'app)
- **Taille**: 20px pour boutons, 24px pour navigation
- **Couleur**: Blanc sur fonds colorés, Vert Principal sur fonds clairs
- Exemples:
  - PRENDRE: ShoppingCart ou Plus
  - DÉPOSER: Package ou Upload
  - STOCK: Database ou List
  - RENDRE: ArrowLeft ou Undo

## Page-Specific Layouts

### Home Page
- Header: Fond Vert Principal (#2E7D32) avec "FiltrePlante" en blanc
- User selector intégré dans le header
- Badge panier/session en Vert Vif, top-right
- Grid 2x2 des boutons d'action principaux
- Section "Mes emprunts en cours" avec badges de durée
- Badge global "Valider ma liste (X items)" en bas (fond Vert Vif, fixe)

### PRENDRE Page
- Header standard (Vert Principal)
- Search bar sticky
- Breadcrumb navigation
- Product grid/list avec indicateurs de stock colorés
- Floating action button (Vert Vif) pour validation

### DÉPOSER Page (3 tabs)
- Tab "Mes emprunts": Liste avec badges bleu
- Tab "Tous les emprunts": Vue admin avec filtres
- Tab "Ajouter du stock": Formulaire avec bouton Bleu Eau
- Background sections: Vert Clair (#E8F5E8) pour zones admin

### STOCK Page
- Filter chips: Actif en Vert Vif, inactifs en outline
- Grouped by category (collapsible)
- Stock levels color-coded (Vert/Orange/Rouge)
- Background: Blanc avec sections Vert Clair pour catégories

### Admin Validation
- Background global: Vert Clair (#E8F5E8)
- Cards produits en attente: Fond blanc, border Orange
- Password input: Standard avec icône
- Action buttons: Vert Vif (valider), Rouge Urgent (supprimer)

## 📱 Responsive Mobile
- Touch targets: minimum 48px (recommandé 56px pour confort)
- Grid adaptatif: 2 colonnes sur mobile, 3-4 sur tablet
- Spacing généreux: minimum 16px entre éléments interactifs
- Bottom sheet modals pour actions contextuelles
- Swipe gestures pour navigation (optionnel)

## Accessibility
- Contraste minimum WCAG AA: 4.5:1 pour texte normal, 3:1 pour texte large
- Tous les boutons ont des labels explicites
- Icônes accompagnées de texte
- États focus visibles (ring Vert Principal)
- Pas de couleur seule comme indicateur (icône + couleur)

## Animations
Minimal et fonctionnel:
- Page transitions: Slide 200ms
- Button press: Scale 0.98, 100ms
- Toast: Slide in from top 250ms
- Loading: Spinner Vert Vif uniquement quand nécessaire
- Hover elevation: transition 150ms ease
