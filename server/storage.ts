// Storage interface for FiltrePlante stock management
import { 
  users, products, movements, alerts, paniers, panierItems,
  type User, type InsertUser,
  type Product, type InsertProduct,
  type Movement, type InsertMovement,
  type Alert, type InsertAlert,
  type Panier, type InsertPanier,
  type PanierItem, type InsertPanierItem
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  
  // Products
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  getProductsByStatus(statut: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  validateProduct(id: number): Promise<Product>;
  
  // Movements
  getMovement(id: number): Promise<Movement | undefined>;
  getActiveMovementsByUser(userId: number): Promise<Movement[]>;
  getAllMovements(): Promise<Movement[]>;
  createMovement(movement: InsertMovement): Promise<Movement>;
  updateMovement(id: number, data: Partial<InsertMovement>): Promise<Movement>;
  
  // Alerts
  getUnreadAlerts(userId: number): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  markAlertAsRead(id: number): Promise<Alert>;
  
  // Panier
  getPanierWithItems(userId: number): Promise<{ panier: Panier | undefined; items: (PanierItem & { product: Product | null; movement: Movement | null })[] }>;
  addItemToPanier(userId: number, item: Omit<InsertPanierItem, "panierId">): Promise<PanierItem>;
  removeItemFromPanier(itemId: number): Promise<void>;
  clearPanier(userId: number): Promise<void>;
  updatePanierTimestamp(userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Products
  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getAllProducts(): Promise<Product[]> {
    return db.select().from(products);
  }

  async getProductsByStatus(statut: string): Promise<Product[]> {
    return db.select().from(products).where(eq(products.statut, statut));
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values(insertProduct)
      .returning();
    return product;
  }

  async updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product> {
    const [product] = await db
      .update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async validateProduct(id: number): Promise<Product> {
    const [product] = await db
      .update(products)
      .set({ statut: "valide" })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  // Movements
  async getMovement(id: number): Promise<Movement | undefined> {
    const [movement] = await db.select().from(movements).where(eq(movements.id, id));
    return movement || undefined;
  }

  async getActiveMovementsByUser(userId: number): Promise<Movement[]> {
    return db
      .select()
      .from(movements)
      .where(
        and(
          eq(movements.utilisateurId, userId),
          eq(movements.statut, "en_cours"),
          eq(movements.type, "pret")
        )
      );
  }

  async getAllMovements(): Promise<Movement[]> {
    return db.select().from(movements);
  }

  async createMovement(insertMovement: InsertMovement): Promise<Movement> {
    const [movement] = await db
      .insert(movements)
      .values(insertMovement)
      .returning();
    return movement;
  }

  async updateMovement(id: number, data: Partial<InsertMovement>): Promise<Movement> {
    const [movement] = await db
      .update(movements)
      .set(data)
      .where(eq(movements.id, id))
      .returning();
    return movement;
  }

  // Alerts
  async getUnreadAlerts(userId: number): Promise<Alert[]> {
    return db
      .select()
      .from(alerts)
      .where(
        and(
          eq(alerts.utilisateurCibleId, userId),
          eq(alerts.lue, 0)
        )
      );
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const [alert] = await db
      .insert(alerts)
      .values(insertAlert)
      .returning();
    return alert;
  }

  async markAlertAsRead(id: number): Promise<Alert> {
    const [alert] = await db
      .update(alerts)
      .set({ lue: 1 })
      .where(eq(alerts.id, id))
      .returning();
    return alert;
  }

  // Panier
  async getPanierWithItems(userId: number): Promise<{ panier: Panier | undefined; items: (PanierItem & { product: Product | null; movement: Movement | null })[] }> {
    // Get or create panier for user
    let [panier] = await db
      .select()
      .from(paniers)
      .where(eq(paniers.utilisateurId, userId));

    if (!panier) {
      [panier] = await db
        .insert(paniers)
        .values({ utilisateurId: userId })
        .returning();
    }

    // Get all items with joined product/movement data
    const items = await db
      .select({
        id: panierItems.id,
        panierId: panierItems.panierId,
        typeAction: panierItems.typeAction,
        produitId: panierItems.produitId,
        typeMouvement: panierItems.typeMouvement,
        movementId: panierItems.movementId,
        quantite: panierItems.quantite,
        product: products,
        movement: movements,
      })
      .from(panierItems)
      .leftJoin(products, eq(panierItems.produitId, products.id))
      .leftJoin(movements, eq(panierItems.movementId, movements.id))
      .where(eq(panierItems.panierId, panier.id));

    return { panier, items: items as (PanierItem & { product: Product | null; movement: Movement | null })[] };
  }

  async addItemToPanier(userId: number, item: Omit<InsertPanierItem, "panierId">): Promise<PanierItem> {
    // Get or create panier
    let [panier] = await db
      .select()
      .from(paniers)
      .where(eq(paniers.utilisateurId, userId));

    if (!panier) {
      [panier] = await db
        .insert(paniers)
        .values({ utilisateurId: userId })
        .returning();
    }

    // Update timestamp
    await db
      .update(paniers)
      .set({ dateModification: new Date() })
      .where(eq(paniers.id, panier.id));

    // Add item
    const [panierItem] = await db
      .insert(panierItems)
      .values({ ...item, panierId: panier.id })
      .returning();

    return panierItem;
  }

  async removeItemFromPanier(itemId: number): Promise<void> {
    // Get the item to find panier
    const [item] = await db
      .select()
      .from(panierItems)
      .where(eq(panierItems.id, itemId));

    if (item) {
      // Remove item
      await db.delete(panierItems).where(eq(panierItems.id, itemId));

      // Update panier timestamp
      await db
        .update(paniers)
        .set({ dateModification: new Date() })
        .where(eq(paniers.id, item.panierId));
    }
  }

  async clearPanier(userId: number): Promise<void> {
    const [panier] = await db
      .select()
      .from(paniers)
      .where(eq(paniers.utilisateurId, userId));

    if (panier) {
      await db.delete(panierItems).where(eq(panierItems.panierId, panier.id));
      await db.delete(paniers).where(eq(paniers.id, panier.id));
    }
  }

  async updatePanierTimestamp(userId: number): Promise<void> {
    await db
      .update(paniers)
      .set({ dateModification: new Date() })
      .where(eq(paniers.utilisateurId, userId));
  }
}

export const storage = new DatabaseStorage();
