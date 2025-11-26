import { storage } from "../storage";
import { db } from "../db";
import { logger } from "../middleware/logger";
import { productService } from "./ProductService";
import { emailService } from "./EmailService";
import { listes, listeItems, products, movements } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { Liste, ListeItem, Product, Movement, InsertMovement } from "@shared/schema";

interface AddItemData {
  produitId: number;
  quantite: number;
  typeMouvement: "pret" | "consommation";
  longueur?: number;
  largeur?: number;
  couleur?: string;
}

interface ListeItemWithDetails extends ListeItem {
  product: Product | null;
  movement: Movement | null;
}

interface ValidationResult {
  success: boolean;
  movementsCount: number;
  items: {
    prendre: { nom: string; quantite: number; unite: string; type: string }[];
    rendre: { nom: string; quantite: number; unite: string }[];
    deposer: { nom: string; quantite: number; unite: string }[];
    perdu: { nom: string; quantite: number; unite: string }[];
  };
}

class ListeService {
  async getUserListe(userId: number): Promise<{ liste: Liste | undefined; items: ListeItemWithDetails[] }> {
    return storage.getListeWithItems(userId);
  }

  async addItemToListe(userId: number, itemData: AddItemData): Promise<ListeItem> {
    const product = await storage.getProduct(itemData.produitId);
    if (!product) {
      throw new Error(`Produit introuvable: ${itemData.produitId}`);
    }

    if (!product.actif) {
      throw new Error(`Produit inactif: ${product.nom}`);
    }

    const listeItem = await storage.addItemToListe(userId, {
      typeAction: "prendre",
      produitId: itemData.produitId,
      typeMouvement: itemData.typeMouvement,
      movementId: null,
      quantite: itemData.quantite,
      quantitePerdue: 0,
      longueur: itemData.longueur || null,
      largeur: itemData.largeur || null,
      couleur: itemData.couleur || null,
    });

    logger.info(`Item ajouté à la liste user ${userId}: produit ${itemData.produitId}, qté ${itemData.quantite}`);
    return listeItem;
  }

  async addReturnToListe(userId: number, movementId: number, quantite: number, quantitePerdue: number = 0): Promise<ListeItem> {
    const movement = await storage.getMovement(movementId);
    if (!movement) {
      throw new Error(`Mouvement introuvable: ${movementId}`);
    }

    if (movement.type !== "pret" || movement.statut !== "en_cours") {
      throw new Error("Seuls les prêts actifs peuvent être retournés");
    }

    const listeItem = await storage.addItemToListe(userId, {
      typeAction: "rendre",
      produitId: null,
      typeMouvement: null,
      movementId: movementId,
      quantite: quantite,
      quantitePerdue: quantitePerdue,
      longueur: null,
      largeur: null,
      couleur: null,
    });

    logger.info(`Retour ajouté à la liste user ${userId}: mouvement ${movementId}`);
    return listeItem;
  }

  async addDepositToListe(userId: number, produitId: number, quantite: number, dimensions?: { longueur?: number; largeur?: number; couleur?: string }): Promise<ListeItem> {
    const product = await storage.getProduct(produitId);
    if (!product) {
      throw new Error(`Produit introuvable: ${produitId}`);
    }

    const listeItem = await storage.addItemToListe(userId, {
      typeAction: "deposer",
      produitId: produitId,
      typeMouvement: null,
      movementId: null,
      quantite: quantite,
      quantitePerdue: 0,
      longueur: dimensions?.longueur || null,
      largeur: dimensions?.largeur || null,
      couleur: dimensions?.couleur || null,
    });

    logger.info(`Dépôt ajouté à la liste user ${userId}: produit ${produitId}, qté ${quantite}`);
    return listeItem;
  }

  async updateListeItem(itemId: number, quantite: number): Promise<ListeItem | null> {
    if (quantite <= 0) {
      await this.removeListeItem(itemId);
      return null;
    }

    const [updated] = await db
      .update(listeItems)
      .set({ quantite })
      .where(eq(listeItems.id, itemId))
      .returning();

    return updated || null;
  }

  async removeListeItem(itemId: number): Promise<void> {
    await storage.removeItemFromListe(itemId);
    logger.info(`Item ${itemId} supprimé de la liste`);
  }

  async clearListe(userId: number): Promise<void> {
    await storage.clearListe(userId);
    logger.info(`Liste vidée pour user ${userId}`);
  }

  async getListeItemCount(userId: number): Promise<number> {
    const { items } = await storage.getListeWithItems(userId);
    return items.length;
  }

  async getListeSummary(userId: number): Promise<{ itemCount: number; categories: string[]; types: string[] }> {
    const { items } = await storage.getListeWithItems(userId);
    
    const categories = Array.from(new Set(
      items
        .filter(item => item.product)
        .map(item => item.product!.categorie)
    ));

    const types = Array.from(new Set(
      items.map(item => item.typeAction)
    ));

    return {
      itemCount: items.length,
      categories,
      types,
    };
  }

  async validateListe(userId: number): Promise<ValidationResult> {
    logger.info(`Début validation liste pour user ${userId}`);

    const validationData: ValidationResult = {
      success: false,
      movementsCount: 0,
      items: {
        prendre: [],
        rendre: [],
        deposer: [],
        perdu: [],
      },
    };

    try {
      const result = await db.transaction(async (tx) => {
        const [liste] = await tx
          .select()
          .from(listes)
          .where(eq(listes.utilisateurId, userId));

        if (!liste) {
          throw new Error("Liste introuvable pour cet utilisateur");
        }

        const items = await tx
          .select()
          .from(listeItems)
          .where(eq(listeItems.listeId, liste.id));

        if (items.length === 0) {
          throw new Error("La liste est vide");
        }

        const prendreItems = items.filter(i => i.typeAction === "prendre");
        const rendreItems = items.filter(i => i.typeAction === "rendre");
        const deposerItems = items.filter(i => i.typeAction === "deposer");

        const allProductIds = [
          ...prendreItems.map(i => i.produitId).filter(Boolean) as number[],
          ...deposerItems.map(i => i.produitId).filter(Boolean) as number[],
        ];

        const allMovementIds = rendreItems.map(i => i.movementId).filter(Boolean) as number[];

        const [fetchedProducts, fetchedMovements] = await Promise.all([
          allProductIds.length > 0 
            ? tx.select().from(products).where(inArray(products.id, allProductIds))
            : Promise.resolve([]),
          allMovementIds.length > 0
            ? tx.select().from(movements).where(inArray(movements.id, allMovementIds))
            : Promise.resolve([]),
        ]);

        const productMap = new Map(fetchedProducts.map(p => [p.id, p]));
        const movementMap = new Map(fetchedMovements.map(m => [m.id, m]));

        for (const item of prendreItems) {
          const product = productMap.get(item.produitId!);
          if (!product) {
            throw new Error(`Produit introuvable: ${item.produitId}`);
          }
          if (!product.actif) {
            throw new Error(`Produit inactif: ${product.nom}`);
          }

          const availableStock = await productService.getAvailableStock(item.produitId!);
          if (availableStock < item.quantite) {
            throw new Error(`Stock insuffisant pour ${product.nom}: ${availableStock} disponible, ${item.quantite} demandé`);
          }
        }

        for (const item of rendreItems) {
          const movement = movementMap.get(item.movementId!);
          if (!movement) {
            throw new Error(`Mouvement introuvable: ${item.movementId}`);
          }
          if (movement.type !== "pret" || movement.statut !== "en_cours") {
            throw new Error(`Mouvement ${item.movementId} n'est pas un prêt actif`);
          }
        }

        const createdMovements: Movement[] = [];

        for (const item of prendreItems) {
          const product = productMap.get(item.produitId!)!;
          
          const movementData: InsertMovement = {
            type: item.typeMouvement as "pret" | "consommation",
            utilisateurId: userId,
            produitId: item.produitId!,
            quantite: item.quantite,
            statut: item.typeMouvement === "pret" ? "en_cours" : "termine",
          };

          const [newMovement] = await tx.insert(movements).values(movementData).returning();
          createdMovements.push(newMovement);

          if (item.typeMouvement === "consommation") {
            await tx.update(products)
              .set({ stockActuel: product.stockActuel - item.quantite })
              .where(eq(products.id, item.produitId!));
          }

          validationData.items.prendre.push({
            nom: product.nom,
            quantite: item.quantite,
            unite: product.unite,
            type: item.typeMouvement!,
          });
        }

        for (const item of rendreItems) {
          const movement = movementMap.get(item.movementId!)!;
          const product = await tx.select().from(products).where(eq(products.id, movement.produitId)).then(r => r[0]);

          await tx.update(movements)
            .set({
              statut: "termine",
              dateRetourEffectif: new Date(),
              quantitePerdue: item.quantitePerdue || 0,
            })
            .where(eq(movements.id, item.movementId!));

          if ((item.quantitePerdue || 0) > 0 && product) {
            await tx.update(products)
              .set({ stockActuel: Math.max(0, product.stockActuel - (item.quantitePerdue || 0)) })
              .where(eq(products.id, movement.produitId));

            validationData.items.perdu.push({
              nom: product.nom,
              quantite: item.quantitePerdue || 0,
              unite: product.unite,
            });
          }

          if (product) {
            validationData.items.rendre.push({
              nom: product.nom,
              quantite: item.quantite,
              unite: product.unite,
            });
          }
        }

        for (const item of deposerItems) {
          let targetProduct = productMap.get(item.produitId!);
          
          if (!targetProduct) {
            throw new Error(`Produit introuvable pour dépôt: ${item.produitId}`);
          }

          if (targetProduct.estTemplate && item.longueur && item.largeur) {
            const variantName = `${targetProduct.nom} ${item.longueur}x${item.largeur}m${item.couleur ? ` ${item.couleur}` : ""}`;
            
            const existingVariants = await tx.select().from(products).where(
              and(
                eq(products.nom, variantName),
                eq(products.categorie, targetProduct.categorie)
              )
            );

            if (existingVariants.length > 0) {
              targetProduct = existingVariants[0];
              await tx.update(products)
                .set({ 
                  stockActuel: targetProduct.stockActuel + item.quantite,
                  actif: true,
                })
                .where(eq(products.id, targetProduct.id));
            } else {
              const [newVariant] = await tx.insert(products).values({
                categorie: targetProduct.categorie,
                sousSection: targetProduct.sousSection,
                nom: variantName,
                unite: targetProduct.unite,
                stockActuel: item.quantite,
                stockMinimum: targetProduct.stockMinimum,
                statut: "valide",
                typesMouvementsAutorises: targetProduct.typesMouvementsAutorises,
                longueur: item.longueur,
                largeur: item.largeur,
                couleur: item.couleur || null,
                estTemplate: false,
                actif: true,
              }).returning();
              targetProduct = newVariant;
            }
          } else {
            await tx.update(products)
              .set({ stockActuel: targetProduct.stockActuel + item.quantite })
              .where(eq(products.id, targetProduct.id));
          }

          const depotData: InsertMovement = {
            type: "depot",
            utilisateurId: userId,
            produitId: targetProduct.id,
            quantite: item.quantite,
            statut: "termine",
          };

          const [depotMovement] = await tx.insert(movements).values(depotData).returning();
          createdMovements.push(depotMovement);

          validationData.items.deposer.push({
            nom: targetProduct.nom,
            quantite: item.quantite,
            unite: targetProduct.unite,
          });
        }

        await tx.delete(listeItems).where(eq(listeItems.listeId, liste.id));
        await tx.delete(listes).where(eq(listes.id, liste.id));

        return {
          movementsCount: createdMovements.length,
          validationData,
        };
      });

      validationData.success = true;
      validationData.movementsCount = result.movementsCount;

      productService.invalidateStockCache();

      emailService.sendValidationEmail(userId, validationData.items).catch(err => {
        logger.error(`Échec envoi email validation: ${err.message}`);
      });

      logger.info(`Validation liste terminée pour user ${userId}: ${validationData.movementsCount} mouvements créés`);
      return validationData;

    } catch (error: any) {
      logger.error(`Échec validation liste user ${userId}: ${error.message}`);
      throw error;
    }
  }
}

export const listeService = new ListeService();
