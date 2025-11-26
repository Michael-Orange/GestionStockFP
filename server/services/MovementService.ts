import { storage } from "../storage";
import { logger } from "../middleware/logger";
import { productService } from "./ProductService";
import type { Movement, InsertMovement, Product } from "@shared/schema";

interface CreateMovementData {
  type: "pret" | "consommation" | "depot" | "retour";
  utilisateurId: number;
  produitId: number;
  quantite: number;
  longueur?: number;
  largeur?: number;
  note?: string;
  dateRetourPrevu?: Date;
}

interface MovementValidation {
  valid: boolean;
  message?: string;
}

interface MovementFilters {
  statut?: string;
  type?: string;
}

interface ReturnData {
  quantiteRetournee?: number;
  quantitePerdue?: number;
  note?: string;
}

interface MovementStats {
  total: number;
  byType: {
    pret: number;
    consommation: number;
    depot: number;
    retour: number;
  };
  byUser: { userId: number; count: number }[];
}

class MovementService {
  private readonly LOW_STOCK_THRESHOLD = 5;

  async validateMovement(data: CreateMovementData): Promise<MovementValidation> {
    const product = await storage.getProduct(data.produitId);
    
    if (!product) {
      return { valid: false, message: `Produit introuvable: ${data.produitId}` };
    }

    if (!product.actif) {
      return { valid: false, message: `Produit inactif: ${product.nom}` };
    }

    if (data.type === "pret" || data.type === "consommation") {
      const availableStock = await productService.getAvailableStock(data.produitId);
      if (availableStock < data.quantite) {
        return { 
          valid: false, 
          message: `Stock insuffisant pour ${product.nom}: ${availableStock} disponible, ${data.quantite} demandé` 
        };
      }
    }

    const isGeomembrane = productService.isGeomembrane(product);
    if (isGeomembrane && (data.type === "depot" || data.type === "pret")) {
      if (!data.longueur || !data.largeur) {
        return { valid: false, message: "Dimensions requises pour les géomembranes" };
      }
    }

    return { valid: true };
  }

  async createMovement(data: CreateMovementData): Promise<Movement> {
    const validation = await this.validateMovement(data);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const product = await storage.getProduct(data.produitId);
    if (!product) {
      throw new Error(`Produit introuvable: ${data.produitId}`);
    }

    const movementData: InsertMovement = {
      type: data.type,
      utilisateurId: data.utilisateurId,
      produitId: data.produitId,
      quantite: data.quantite,
      statut: data.type === "pret" ? "en_cours" : "termine",
      dateRetourPrevu: data.dateRetourPrevu,
    };

    const movement = await storage.createMovement(movementData);

    if (data.type === "depot") {
      await storage.updateProduct(data.produitId, {
        stockActuel: product.stockActuel + data.quantite,
      });
      logger.info(`Dépôt: +${data.quantite} pour produit ${data.produitId}`);
    } else if (data.type === "consommation") {
      await storage.updateProduct(data.produitId, {
        stockActuel: product.stockActuel - data.quantite,
      });
      logger.info(`Consommation: -${data.quantite} pour produit ${data.produitId}`);
    }

    productService.invalidateStockCache(data.produitId);

    if (data.type === "pret" || data.type === "consommation") {
      const newAvailableStock = await productService.getAvailableStock(data.produitId);
      if (newAvailableStock <= this.LOW_STOCK_THRESHOLD && newAvailableStock > 0) {
        logger.warn(`Stock faible pour ${product.nom}: ${newAvailableStock} restant(s)`);
      }
    }

    logger.info(`Mouvement créé: ${movement.id} - ${data.type} - ${data.quantite}x produit ${data.produitId}`);
    return movement;
  }

  async getUserMovements(userId: number, filters?: MovementFilters): Promise<Movement[]> {
    const allMovements = await storage.getAllMovements();
    let userMovements = allMovements.filter(m => m.utilisateurId === userId);

    if (filters?.statut) {
      userMovements = userMovements.filter(m => m.statut === filters.statut);
    }

    if (filters?.type) {
      userMovements = userMovements.filter(m => m.type === filters.type);
    }

    return userMovements.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async getProductMovements(productId: number): Promise<Movement[]> {
    const allMovements = await storage.getAllMovements();
    return allMovements
      .filter(m => m.produitId === productId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getActiveLoans(userId?: number): Promise<Movement[]> {
    const allMovements = await storage.getAllMovements();
    let activeLoans = allMovements.filter(
      m => m.type === "pret" && m.statut === "en_cours"
    );

    if (userId !== undefined) {
      activeLoans = activeLoans.filter(m => m.utilisateurId === userId);
    }

    return activeLoans.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async processReturn(movementId: number, returnData: ReturnData): Promise<Movement> {
    const movement = await storage.getMovement(movementId);
    
    if (!movement) {
      throw new Error(`Mouvement introuvable: ${movementId}`);
    }

    if (movement.type !== "pret") {
      throw new Error(`Seuls les prêts peuvent être retournés. Type: ${movement.type}`);
    }

    if (movement.statut !== "en_cours") {
      throw new Error(`Ce prêt est déjà terminé`);
    }

    const quantiteRetournee = returnData.quantiteRetournee ?? movement.quantite;
    const quantitePerdue = returnData.quantitePerdue ?? 0;

    if (quantiteRetournee + quantitePerdue > movement.quantite) {
      throw new Error(`Quantité retournée (${quantiteRetournee}) + perdue (${quantitePerdue}) > quantité prêtée (${movement.quantite})`);
    }

    const product = await storage.getProduct(movement.produitId);
    if (!product) {
      throw new Error(`Produit introuvable: ${movement.produitId}`);
    }

    const updatedMovement = await storage.updateMovement(movementId, {
      statut: "termine",
      dateRetourEffectif: new Date(),
      quantitePerdue: quantitePerdue,
    } as any);

    if (quantitePerdue > 0) {
      const newStock = product.stockActuel - quantitePerdue;
      await storage.updateProduct(movement.produitId, {
        stockActuel: Math.max(0, newStock),
      });
      logger.info(`Retour avec perte: -${quantitePerdue} stock pour produit ${movement.produitId}`);
    }

    productService.invalidateStockCache(movement.produitId);

    logger.info(`Retour traité: mouvement ${movementId}, retourné: ${quantiteRetournee}, perdu: ${quantitePerdue}`);
    return updatedMovement;
  }

  async getMovementStats(period: "week" | "month" | "year"): Promise<MovementStats> {
    const allMovements = await storage.getAllMovements();
    
    const now = new Date();
    let cutoffDate: Date;
    
    switch (period) {
      case "week":
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }

    const periodMovements = allMovements.filter(
      m => new Date(m.date) >= cutoffDate
    );

    const byType = {
      pret: periodMovements.filter(m => m.type === "pret").length,
      consommation: periodMovements.filter(m => m.type === "consommation").length,
      depot: periodMovements.filter(m => m.type === "depot").length,
      retour: periodMovements.filter(m => m.type === "retour").length,
    };

    const userCounts = new Map<number, number>();
    for (const m of periodMovements) {
      userCounts.set(m.utilisateurId, (userCounts.get(m.utilisateurId) || 0) + 1);
    }
    const byUser = Array.from(userCounts.entries()).map(([userId, count]) => ({ userId, count }));

    return {
      total: periodMovements.length,
      byType,
      byUser,
    };
  }

  async getMostBorrowedProducts(limit: number = 10): Promise<{ productId: number; productName: string; count: number }[]> {
    const allMovements = await storage.getAllMovements();
    const loanMovements = allMovements.filter(m => m.type === "pret");

    const productCounts = new Map<number, number>();
    for (const m of loanMovements) {
      productCounts.set(m.produitId, (productCounts.get(m.produitId) || 0) + 1);
    }

    const sortedProducts = Array.from(productCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const productIds = sortedProducts.map(([id]) => id);
    const products = await productService.getProductsByIds(productIds);
    const productMap = new Map(products.map(p => [p.id, p]));

    return sortedProducts.map(([productId, count]) => ({
      productId,
      productName: productMap.get(productId)?.nom || `Produit #${productId}`,
      count,
    }));
  }

  async getOverdueLoans(daysThreshold: number = 7): Promise<Movement[]> {
    const activeLoans = await this.getActiveLoans();
    const now = new Date();
    const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;

    return activeLoans.filter(m => {
      const loanDate = new Date(m.date);
      return now.getTime() - loanDate.getTime() > thresholdMs;
    });
  }
}

export const movementService = new MovementService();
