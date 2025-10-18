// Storage interface for FiltrePlante stock management
import { 
  users, products, movements, alerts,
  type User, type InsertUser,
  type Product, type InsertProduct,
  type Movement, type InsertMovement,
  type Alert, type InsertAlert
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
}

export const storage = new DatabaseStorage();
