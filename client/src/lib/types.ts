import type { Product, Movement, User, Alert } from "@shared/schema";

// Types étendus pour l'interface
export interface ProductWithStock extends Product {
  stockDisponible: number;
  stockStatus: "en_stock" | "pas_en_stock";
}

export interface ActiveLoan extends Movement {
  product: Product;
  user?: User;
  dureeJours: number;
  statusDuree: "recent" | "attention" | "retard";
}

export interface CategoryInfo {
  categorie: string;
  count: number;
  sousSections: string[];
}

export interface StockFilter {
  statut: "tous" | "en_stock" | "pas_en_stock";
  categorie?: string;
  sousSection?: string;
  recherche?: string;
}

export const TEAM_MEMBERS = [
  { id: 4, nom: "Cheikh", role: "utilisateur", email: "cheikh@filtreplante.com" },
  { id: 2, nom: "Fatou", role: "utilisateur", email: "fatou@filtreplante.com" },
  { id: 1, nom: "Marine", role: "admin", email: "marine@filtreplante.com" },
  { id: 3, nom: "Michael", role: "admin", email: "michael@filtreplante.com" },
  { id: 5, nom: "Papa", role: "utilisateur", email: "papa@filtreplante.com" },
] as const;
