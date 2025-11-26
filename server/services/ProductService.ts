import { storage } from "../storage";
import { logger } from "../middleware/logger";
import type { Product, InsertProduct } from "@shared/schema";

interface StockCacheEntry {
  value: number;
  timestamp: number;
}

interface ProductFilters {
  categorie?: string;
  sousSection?: string;
  actifOnly?: boolean;
  statutOnly?: string;
}

class ProductService {
  private stockCache = new Map<number, StockCacheEntry>();
  private readonly CACHE_TTL = 60000; // 60 seconds

  private clearStaleCache(): void {
    const now = Date.now();
    const entries = Array.from(this.stockCache.entries());
    for (const [id, entry] of entries) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.stockCache.delete(id);
      }
    }
  }

  invalidateStockCache(productId?: number): void {
    if (productId) {
      this.stockCache.delete(productId);
    } else {
      this.stockCache.clear();
    }
  }

  async getAllProducts(filters?: ProductFilters): Promise<Product[]> {
    let products: Product[];

    if (filters?.statutOnly) {
      products = await storage.getProductsByStatus(filters.statutOnly);
    } else {
      products = await storage.getAllProducts();
    }

    if (filters?.actifOnly !== false) {
      products = products.filter(p => p.actif);
    }

    if (filters?.categorie) {
      products = products.filter(p => p.categorie === filters.categorie);
    }

    if (filters?.sousSection) {
      products = products.filter(p => p.sousSection === filters.sousSection);
    }

    return products;
  }

  async getProductById(id: number): Promise<Product> {
    const product = await storage.getProduct(id);
    if (!product) {
      throw new Error(`Produit introuvable: ${id}`);
    }
    return product;
  }

  async getProductsByIds(ids: number[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    return storage.getProductsByIds(ids);
  }

  async getAvailableStock(productId: number): Promise<number> {
    this.clearStaleCache();

    const cached = this.stockCache.get(productId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.value;
    }

    const product = await storage.getProduct(productId);
    if (!product) {
      throw new Error(`Produit introuvable: ${productId}`);
    }

    const allMovements = await storage.getAllMovements();
    
    const activeLoans = allMovements.filter(
      (m) => m.produitId === productId && m.type === "pret" && m.statut === "en_cours"
    );
    const totalLoanedQuantity = activeLoans.reduce((sum, m) => sum + m.quantite, 0);
    
    const availableStock = product.stockActuel - totalLoanedQuantity;

    this.stockCache.set(productId, {
      value: availableStock,
      timestamp: Date.now(),
    });

    return availableStock;
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    if (!data.nom || data.nom.trim() === "") {
      throw new Error("Le nom du produit est requis");
    }
    if (!data.categorie || data.categorie.trim() === "") {
      throw new Error("La catégorie du produit est requise");
    }

    if (data.estTemplate && (!data.longueur || !data.largeur)) {
      logger.warn(`Création template sans dimensions complètes: ${data.nom}`);
    }

    const product = await storage.createProduct(data);
    logger.info(`Produit créé: ${product.id} - ${product.nom}`);
    return product;
  }

  async updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product> {
    const existing = await storage.getProduct(id);
    if (!existing) {
      throw new Error(`Produit introuvable: ${id}`);
    }

    const updated = await storage.updateProduct(id, data);
    this.invalidateStockCache(id);
    logger.info(`Produit mis à jour: ${id}`);
    return updated;
  }

  async deleteProduct(id: number): Promise<void> {
    const existing = await storage.getProduct(id);
    if (!existing) {
      throw new Error(`Produit introuvable: ${id}`);
    }

    const allMovements = await storage.getAllMovements();
    const activeLoans = allMovements.filter(
      (m) => m.produitId === id && m.type === "pret" && m.statut === "en_cours"
    );

    if (activeLoans.length > 0) {
      throw new Error(`Impossible de supprimer: ${activeLoans.length} prêt(s) actif(s) pour ce produit`);
    }

    await storage.updateProduct(id, { actif: false });
    this.invalidateStockCache(id);
    logger.info(`Produit désactivé (soft delete): ${id}`);
  }

  async toggleProductStatus(id: number, isActive: boolean): Promise<Product> {
    const existing = await storage.getProduct(id);
    if (!existing) {
      throw new Error(`Produit introuvable: ${id}`);
    }

    const updated = await storage.updateProduct(id, { actif: isActive });
    logger.info(`Produit ${id} - statut actif: ${isActive}`);
    return updated;
  }

  async createFromTemplate(templateId: number, variantData: {
    longueur?: number;
    largeur?: number;
    couleur?: string;
    quantite?: number;
  }): Promise<Product> {
    const template = await storage.getProduct(templateId);
    if (!template) {
      throw new Error(`Template introuvable: ${templateId}`);
    }
    if (!template.estTemplate) {
      throw new Error(`Le produit ${templateId} n'est pas un template`);
    }

    const isGeomembrane = template.categorie === "Géomembranes" || 
                          template.nom.toLowerCase().includes("membrane");

    if (isGeomembrane) {
      if (!variantData.longueur || !variantData.largeur) {
        throw new Error("Longueur et largeur requises pour les géomembranes");
      }
    }

    const variantName = isGeomembrane
      ? `${template.nom} ${variantData.longueur}x${variantData.largeur}m${variantData.couleur ? ` ${variantData.couleur}` : ""}`
      : template.nom;

    const variant = await storage.createProduct({
      categorie: template.categorie,
      sousSection: template.sousSection,
      nom: variantName,
      unite: template.unite,
      stockActuel: variantData.quantite || 0,
      stockMinimum: template.stockMinimum,
      statut: "valide",
      typesMouvementsAutorises: template.typesMouvementsAutorises,
      longueur: variantData.longueur || null,
      largeur: variantData.largeur || null,
      couleur: variantData.couleur || null,
      estTemplate: false,
      actif: true,
    });

    logger.info(`Variant créé depuis template ${templateId}: ${variant.id} - ${variant.nom}`);
    return variant;
  }

  isGeomembrane(product: Product): boolean {
    return !!(product.longueur && product.largeur && !product.estTemplate);
  }

  async getCategories(): Promise<string[]> {
    const products = await storage.getAllProducts();
    const categories = Array.from(new Set(products.map(p => p.categorie)));
    return categories.sort();
  }

  async getSousSections(categorie?: string): Promise<string[]> {
    let products = await storage.getAllProducts();
    if (categorie) {
      products = products.filter(p => p.categorie === categorie);
    }
    const sousSections = Array.from(new Set(products.map(p => p.sousSection)));
    return sousSections.sort();
  }
}

export const productService = new ProductService();
