import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// UTILISATEURS
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("utilisateur"), // "admin" | "utilisateur"
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// PRODUITS
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  categorie: text("categorie").notNull(),
  sousSection: text("sous_section").notNull(),
  nom: text("nom").notNull(),
  unite: text("unite").notNull(), // "u" (unité) ou "m" (mètre) etc
  stockActuel: integer("stock_actuel").notNull().default(0),
  stockMinimum: integer("stock_minimum").notNull().default(0),
  statut: text("statut").notNull().default("valide"), // "valide" | "en_attente"
  typesMouvementsAutorises: text("types_mouvements_autorises").notNull().default("les_deux"), // "pret" | "consommation" | "les_deux"
  creePar: integer("cree_par"), // user id
  dateCreation: timestamp("date_creation").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({ 
  id: true, 
  dateCreation: true 
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// MOUVEMENTS (prêt, consommation, retour, dépôt)
export const movements = pgTable("movements", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull().defaultNow(),
  utilisateurId: integer("utilisateur_id").notNull(),
  produitId: integer("produit_id").notNull(),
  quantite: integer("quantite").notNull(),
  type: text("type").notNull(), // "pret" | "consommation" | "retour" | "depot"
  statut: text("statut").notNull().default("en_cours"), // "en_cours" | "termine"
  dateRetourPrevu: timestamp("date_retour_prevu"), // pour les prêts uniquement
  dateRetourEffectif: timestamp("date_retour_effectif"),
});

export const insertMovementSchema = createInsertSchema(movements).omit({ 
  id: true, 
  date: true,
  dateRetourEffectif: true
});
export type InsertMovement = z.infer<typeof insertMovementSchema>;
export type Movement = typeof movements.$inferSelect;

// ALERTES
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "retard_emprunt" | "nouveau_produit" | "stock_faible"
  mouvementId: integer("mouvement_id"), // référence optionnelle au mouvement concerné
  produitId: integer("produit_id"), // référence optionnelle au produit concerné
  utilisateurCibleId: integer("utilisateur_cible_id").notNull(), // qui doit voir l'alerte
  message: text("message").notNull(),
  dateCreation: timestamp("date_creation").notNull().defaultNow(),
  lue: integer("lue").notNull().default(0), // 0 = non lue, 1 = lue
});

export const insertAlertSchema = createInsertSchema(alerts).omit({ 
  id: true, 
  dateCreation: true 
});
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// RELATIONS
export const usersRelations = relations(users, ({ many }) => ({
  movements: many(movements),
  productsCreated: many(products),
  alerts: many(alerts),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  creator: one(users, {
    fields: [products.creePar],
    references: [users.id],
  }),
  movements: many(movements),
  alerts: many(alerts),
}));

export const movementsRelations = relations(movements, ({ one, many }) => ({
  user: one(users, {
    fields: [movements.utilisateurId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [movements.produitId],
    references: [products.id],
  }),
  alerts: many(alerts),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  targetUser: one(users, {
    fields: [alerts.utilisateurCibleId],
    references: [users.id],
  }),
  movement: one(movements, {
    fields: [alerts.mouvementId],
    references: [movements.id],
  }),
  product: one(products, {
    fields: [alerts.produitId],
    references: [products.id],
  }),
}));
