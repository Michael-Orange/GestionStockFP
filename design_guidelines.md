# Design Guidelines - FiltrePlante Stock Management App

## Design Approach
**System-Based Approach**: Material Design principles adapted for mobile-first utility application
**Rationale**: Function-focused inventory management requiring clarity, efficiency, and data visibility over aesthetic novelty

## Core Design Principles
1. **Mobile-First Efficiency**: Every interaction optimized for one-handed smartphone use
2. **Information Hierarchy**: Stock status visible at all times without extra taps
3. **Progressive Disclosure**: Show critical info first, details on demand
4. **Visual Feedback**: Immediate confirmation of all actions

## Color Palette

### Light Mode
- **Primary**: 142 71% 45% (Green - represents healthy stock)
- **Background**: 0 0% 98%
- **Surface**: 0 0% 100%
- **Text Primary**: 0 0% 13%
- **Text Secondary**: 0 0% 45%

### Status Colors (Critical for Stock Indicators)
- **Stock OK (Green)**: 142 71% 45%
- **Stock Low (Orange)**: 25 95% 53%
- **Stock Empty (Red)**: 0 84% 60%
- **Pending Validation (Blue)**: 217 91% 60%

### Dark Mode
- **Primary**: 142 71% 55%
- **Background**: 0 0% 7%
- **Surface**: 0 0% 11%
- **Text Primary**: 0 0% 98%
- **Text Secondary**: 0 0% 65%

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

### Navigation
- **Bottom Navigation Bar** (fixed): 4 main actions (PRENDRE, RENDRE, DÉPOSER, STOCK)
- Icons + labels for clarity
- Active state with primary color fill
- Height: 72px for easy thumb access

### User Selection Dropdown
- Large tap target (min 48px height)
- Current user always visible in header
- Simple list selection (no password complexity)

### Product Cards
Display format: **"Product Name (current/total)"**
- Example: "MARTEAU (3/5)"
- Status indicator dot (left side, 8px diameter)
- Product name (bold, 16px)
- Stock fraction (regular, 14px, aligned right)
- Card height: min 64px for comfortable tapping

### Category Navigation
- **Breadcrumb trail** at top: Catégorie → Sous-section → Produit
- Large category cards (min 80px height)
- Icon or emoji visual identifier per category
- Item count badge on each category

### Search Bar
- Sticky at page top
- Clear button always visible when text present
- Real-time filtering
- Placeholder: "Rechercher un produit..."

### Action Buttons
- **Primary CTA**: Full-width on mobile, primary green color
- **Secondary**: Outline style with border
- Minimum height: 48px
- Border radius: 8px
- Text: 500 weight, 15px

### Stock Display Badge
- Colored background based on status
- White text for contrast
- Rounded pill shape (full rounded corners)
- Format: "5 disponibles" or "Stock faible (2)" or "Rupture"

### Forms (Quantity Input)
- Large numeric input with +/- steppers
- Minimum touch target: 56px for +/- buttons
- Current value centered and bold
- Max quantity validation shown below

### Radio Buttons (Prêt/Consommation)
- Large touch targets (min 48px)
- Clear visual distinction when selected
- Label text 16px for readability

### Loan Duration Display
- Format: "Emprunté depuis X jours"
- Color coding: Green (<7 days), Orange (7-14 days), Red (15+ days)
- Badge style for quick recognition

### Admin Validation Interface
- Pending products: Yellow/amber highlight
- Action buttons horizontal layout: Valider (green), Modifier (blue), Supprimer (red)
- Clear product details preview

### Alerts/Notifications
- Toast notifications: Top of screen, auto-dismiss 3s
- Critical alerts: Persistent banner until dismissed
- Badge count on user profile for pending items

## Page-Specific Layouts

### Home Page
- User selector at very top
- Quick stats cards (2x2 grid): Total emprunts, Produits faibles, Alertes, etc.
- "Mes emprunts en cours" list with duration badges
- Bottom navigation

### PRENDRE Page
- Search bar (sticky)
- Breadcrumb navigation
- Category/Product grid or list
- Stock counter always visible
- Floating action button for validation

### RENDRE Page
- List of borrowed items
- Each item shows: Name, duration, quantity borrowed
- Inline quantity selector for partial returns
- Batch return option at bottom

### STOCK Page
- Filter chips at top (OK, Faible, Vide, Tous)
- Grouped by category (collapsible sections)
- Stock levels color-coded throughout
- Pull-to-refresh gesture

### DÉPOSER Page
- Product search first
- If not found: Quick "Créer nouveau produit" CTA
- Form with auto-complete for categories
- Immediate feedback: "Produit ajouté (en attente de validation)"

## Images
No hero images required - this is a utility application focused on data and actions. Use:
- **Icons**: Material Icons via CDN for categories and actions
- **Status indicators**: Colored dots/badges (CSS-based, not images)
- **Empty states**: Simple illustrations (optional) for "Aucun emprunt" etc.

## Animations
Minimal and functional only:
- Page transitions: Simple slide (200ms)
- Button press: Scale down to 0.95 (100ms)
- Toast notifications: Slide in from top (250ms)
- Loading states: Spinner only when necessary

## Accessibility
- All interactive elements: min 48px touch target
- Color not sole indicator (use icons + text)
- High contrast ratios (WCAG AA minimum)
- Form labels always visible
- Error messages clear and actionable