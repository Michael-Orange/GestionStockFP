// Storage interface for FiltrePlante stock management
import { 
  users, products, movements, alerts, listes, listeItems, emailLogs,
  type User, type InsertUser,
  type Product, type InsertProduct,
  type Movement, type InsertMovement,
  type Alert, type InsertAlert,
  type Liste, type InsertListe,
  type ListeItem, type InsertListeItem,
  type EmailLog, type InsertEmailLog
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: number, passwordHash: string): Promise<void>;
  
  // Products
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  getProductsByStatus(statut: string): Promise<Product[]>;
  getAllUnits(): Promise<string[]>;
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
  
  // Liste
  getListeWithItems(userId: number): Promise<{ liste: Liste | undefined; items: (ListeItem & { product: Product | null; movement: Movement | null })[] }>;
  addItemToListe(userId: number, item: Omit<InsertListeItem, "listeId">): Promise<ListeItem>;
  removeItemFromListe(itemId: number): Promise<void>;
  clearListe(userId: number): Promise<void>;
  updateListeTimestamp(userId: number): Promise<void>;
  
  // Email Logs
  createEmailLog(emailLog: InsertEmailLog): Promise<EmailLog>;
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

  async updateUserPassword(userId: number, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));
  }

  // Products
  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getAllProducts(): Promise<Product[]> {
    return db.select().from(products).where(eq(products.actif, true));
  }

  async getProductsByStatus(statut: string): Promise<Product[]> {
    return db.select().from(products).where(and(eq(products.statut, statut), eq(products.actif, true)));
  }

  async getAllUnits(): Promise<string[]> {
    const result = await db
      .selectDistinct({ unite: products.unite })
      .from(products)
      .where(eq(products.actif, true))
      .orderBy(products.unite);
    return result.map(r => r.unite);
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

  // Liste
  async getListeWithItems(userId: number): Promise<{ liste: Liste | undefined; items: (ListeItem & { product: Product | null; movement: Movement | null })[] }> {
    // Get or create liste for user
    let [liste] = await db
      .select()
      .from(listes)
      .where(eq(listes.utilisateurId, userId));

    if (!liste) {
      [liste] = await db
        .insert(listes)
        .values({ utilisateurId: userId })
        .returning();
    }

    // Get all items with joined product/movement data
    const rawItems = await db
      .select({
        id: listeItems.id,
        listeId: listeItems.listeId,
        typeAction: listeItems.typeAction,
        produitId: listeItems.produitId,
        typeMouvement: listeItems.typeMouvement,
        movementId: listeItems.movementId,
        quantite: listeItems.quantite,
        quantitePerdue: listeItems.quantitePerdue,
        longueur: listeItems.longueur, // For Géomembrane deposits
        largeur: listeItems.largeur, // For Géomembrane deposits
        couleur: listeItems.couleur, // For Géomembrane deposits
        product: products,
        movement: movements,
      })
      .from(listeItems)
      .leftJoin(products, eq(listeItems.produitId, products.id))
      .leftJoin(movements, eq(listeItems.movementId, movements.id))
      .where(eq(listeItems.listeId, liste.id));

    // For items where product is null but movement exists, fetch product via movement.produitId
    const items = await Promise.all(
      rawItems.map(async (item) => {
        if (!item.product && item.movement?.produitId) {
          // Fetch product via movement
          const product = await this.getProduct(item.movement.produitId);
          return { ...item, product: product || null };
        }
        return item;
      })
    );

    return { liste, items: items as (ListeItem & { product: Product | null; movement: Movement | null })[] };
  }

  async addItemToListe(userId: number, item: Omit<InsertListeItem, "listeId">): Promise<ListeItem> {
    // Get or create liste
    let [liste] = await db
      .select()
      .from(listes)
      .where(eq(listes.utilisateurId, userId));

    if (!liste) {
      [liste] = await db
        .insert(listes)
        .values({ utilisateurId: userId })
        .returning();
    }

    // Update timestamp
    await db
      .update(listes)
      .set({ dateModification: new Date() })
      .where(eq(listes.id, liste.id));

    // Add item
    const [listeItem] = await db
      .insert(listeItems)
      .values({ ...item, listeId: liste.id })
      .returning();

    return listeItem;
  }

  async removeItemFromListe(itemId: number): Promise<void> {
    // Get the item to find liste
    const [item] = await db
      .select()
      .from(listeItems)
      .where(eq(listeItems.id, itemId));

    if (item) {
      // Remove item
      await db.delete(listeItems).where(eq(listeItems.id, itemId));

      // Update liste timestamp
      await db
        .update(listes)
        .set({ dateModification: new Date() })
        .where(eq(listes.id, item.listeId));
    }
  }

  async clearListe(userId: number): Promise<void> {
    const [liste] = await db
      .select()
      .from(listes)
      .where(eq(listes.utilisateurId, userId));

    if (liste) {
      await db.delete(listeItems).where(eq(listeItems.listeId, liste.id));
      await db.delete(listes).where(eq(listes.id, liste.id));
    }
  }

  async updateListeTimestamp(userId: number): Promise<void> {
    await db
      .update(listes)
      .set({ dateModification: new Date() })
      .where(eq(listes.utilisateurId, userId));
  }

  // Email Logs
  async createEmailLog(insertEmailLog: InsertEmailLog): Promise<EmailLog> {
    const [emailLog] = await db
      .insert(emailLogs)
      .values(insertEmailLog)
      .returning();
    return emailLog;
  }
}

export const storage = new DatabaseStorage();
