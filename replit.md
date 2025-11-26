# FiltrePlante - Gestion de Stock

## Overview
FiltrePlante is a mobile-first web application designed for stock management, catering to a five-person team. The application streamlines inventory processes, including borrowing, returning, and depositing items, with a focus on real-time stock tracking and administrative oversight. It aims to provide an intuitive and efficient tool for managing physical assets within the team.

## User Preferences
I prefer simple language and clear, concise explanations. For development, I favor an iterative approach with frequent, small updates. Please ask for confirmation before implementing any major changes or refactoring large sections of code. I appreciate detailed explanations, especially for complex architectural decisions or new feature implementations.

## System Architecture

### UI/UX Decisions
The application features a mobile-first design optimized for smartphones, ensuring touch targets are at least 48px for accessibility. It uses the Inter font for readability and incorporates an intuitive color-coded system (Green/Orange/Red) for stock status and loan duration. The design follows a Material Design aesthetic, aiming for a maximum of 3 clicks per primary action.

### Technical Implementations
The frontend is built with React and TypeScript, leveraging Vite, Wouter for routing, TanStack Query for data fetching, Shadcn UI for components, and Tailwind CSS for styling. The backend is an Express.js server interacting with a PostgreSQL database using Drizzle ORM.

### Feature Specifications
-   **User Management**: Supports 5 predefined users with role-based access (admin for Marine and Michael). Admin authentication is secured with bcrypt-hashed passwords.
-   **Stock Management**: Real-time stock calculation, color-coded indicators for stock levels (OK, Low, Empty), and intelligent filters.
-   **Loan Management**: Distinguishes between "Prêt" (loan) and "Consommation" (consumption), with color-coded badges for loan duration.
-   **Admin Validation**: Michael and Marine can validate new products and manage pending items via a password-protected admin interface.
-   **Product Creation**: A reusable component allows creation of new products from various pages, automatically setting their status to "en_attente" (pending admin validation). Dynamic dropdowns for categories, sub-sections, and units are supported.
-   **Unified Deposit Page**: Consolidates "Return" and "Deposit" functionalities into a single page with three tabs: "Mes emprunts" (My loans), "Tous les emprunts" (All loans), and "Ajouter du stock" (Add stock). This page also allows adding products with zero stock.
-   **Grouped Actions (Lists)**: Renamed from "Panier" (cart), this system allows users to group multiple "prendre" (take), "rendre" (return), and "déposer" (deposit) actions into a single list for validation. A global counter badge indicates pending actions.
-   **Automated Email System**: Integrates with Resend for sending automated notifications to Marine and Michael. Emails include validation summaries for grouped actions and alerts for new product creations. Includes robust error logging with result.error verification and uses HTML templates with inline CSS for compatibility.
-   **Home CTA Button**: Green fixed-bottom button "Valider ma liste (X items)" displayed on home page when list contains items, providing quick access to validation flow (18 Oct 2025).
-   **Géomembrane Soft Delete System** (21 Oct 2025): Géomembranes are automatically deactivated when stock reaches 0 (via consumption or lost items) and hidden from product listings. They are automatically reactivated when stock is deposited. This prevents duplicate géomembrane products while preserving movement history. Detection criteria: `product.longueur && product.largeur && !product.estTemplate`. All stock-mutating endpoints (liste validation, direct borrow, direct deposit) implement this logic consistently.

### System Design Choices
-   **Database**: PostgreSQL managed via Drizzle ORM, with separate development and production databases (Neon-hosted).
-   **Data Import**: Automatic CSV import of product data on application startup.
-   **Security**: Server-side validation for all data mutations, filtering of unvalidated products, and role-based access control. No password authentication for regular users (internal team context).
-   **Middleware Architecture** (26 Nov 2025): Centralized middleware infrastructure including:
    - `server/middleware/logger.ts` - Structured logging with [INFO]/[ERROR]/[WARN] format and ISO timestamps
    - `server/middleware/requestLogger.ts` - HTTP request logging with response timing
    - `server/middleware/errorHandler.ts` - Centralized uncaught error handling with smart status code detection
    - Middleware order in routes.ts: requestLogger → routes → errorHandler
-   **Business Logic Services** (26 Nov 2025): Refactored backend with dedicated service layer:
    - `server/services/ProductService.ts` - Product CRUD, stock cache (TTL 60s, 63ms→1ms optimization), géomembrane template/variant creation
    - `server/services/MovementService.ts` - Movement validation, stock checks, analytics (active loans, overdue, stats)
    - `server/services/ListeService.ts` - User cart/list management with transactional validation (CRITICAL)
    - `server/services/AlertService.ts` - Notification system for admins and users
    - `server/services/EmailService.ts` - Email dispatch via Resend with retry/exponential backoff (1s, 2s, 4s)
    - Test script: `scripts/test-services.ts` validates all 5 services
-   **Database Backup**: Manual backup script at `scripts/backup-database.ts` using pg_dump, saves to `/backups` folder.

## External Dependencies
-   **Database**: PostgreSQL (via Neon)
-   **ORM**: Drizzle ORM
-   **Frontend Framework**: React
-   **Build Tool**: Vite
-   **Routing**: Wouter
-   **State Management/Data Fetching**: TanStack Query
-   **UI Components**: Shadcn UI
-   **Styling**: Tailwind CSS
-   **Email Service**: Resend (for automated email notifications)
-   **Password Hashing**: bcrypt
-   **CSV Parsing**: Papa Parse (configured for `relax_quotes: true`)
-   **End-to-End Testing**: Playwright