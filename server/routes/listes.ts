import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { listeService } from "../services/ListeService";
import { productService } from "../services/ProductService";
import { logger } from "../middleware/logger";
import { sendEmail } from "../services/email-service";
import { createValidationPanierEmail, type ValidationPanierData } from "../services/email-templates";
import { listes, listeItems, products, movements } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/:userId", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    const { liste, items } = await storage.getListeWithItems(userId);
    res.json({ liste, items });
  } catch (error) {
    next(error);
  }
});

router.post("/add", async (req, res, next) => {
  try {
    const { userId, item: itemData } = req.body;
    
    if (itemData.typeAction === "deposer" && itemData.produitId) {
      const product = await storage.getProduct(itemData.produitId);
      if (product && product.estTemplate && product.nom.includes("Rouleau partiellement utilisé")) {
        if (!itemData.longueur) {
          return res.status(400).json({ 
            error: "Veuillez saisir la longueur du rouleau partiellement utilisé" 
          });
        }
        
        const longueur = parseFloat(itemData.longueur);
        
        if (isNaN(longueur) || longueur <= 0) {
          return res.status(400).json({ 
            error: "La longueur doit être un nombre valide supérieur à 0" 
          });
        }
        
        if (longueur < 10) {
          return res.status(400).json({ 
            error: "Utilisez le produit Chute pour les longueurs inférieures à 10m" 
          });
        }
        if (longueur >= 100) {
          return res.status(400).json({ 
            error: "Un rouleau utilisé ne peut pas dépasser 100m" 
          });
        }
      }
    }
    
    const item = await storage.addItemToListe(userId, {
      typeAction: itemData.typeAction,
      produitId: itemData.produitId || null,
      typeMouvement: itemData.typeEmprunt || null,
      movementId: itemData.movementId || itemData.mouvementId || null,
      quantite: itemData.quantite,
      quantitePerdue: itemData.quantitePerdue || 0,
      longueur: itemData.longueur || null,
      largeur: itemData.largeur || null,
      couleur: itemData.couleur || null,
    });
    
    logger.info(`Item ajouté à liste user ${userId}: ${itemData.typeAction}`);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.delete("/item/:itemId", async (req, res, next) => {
  try {
    const itemId = parseInt(req.params.itemId);
    await storage.removeItemFromListe(itemId);
    logger.info(`Item ${itemId} supprimé de la liste`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/:userId/clear", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    await storage.clearListe(userId);
    logger.info(`Liste vidée pour user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post("/:userId/validate", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    const { liste, items } = await storage.getListeWithItems(userId);

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Liste vide" });
    }

    const results: any[] = [];
    const deposerProductMap = new Map<number, any>();

    for (const item of items) {
      if (item.typeAction === "prendre") {
        const product = item.product;
        if (!product) {
          throw new Error(`Produit non trouvé pour item ${item.id}`);
        }

        if (product.statut !== "valide") {
          throw new Error(`Le produit "${product.nom}" doit être validé avant utilisation`);
        }

        if (product.typesMouvementsAutorises !== "les_deux") {
          if (product.typesMouvementsAutorises !== item.typeMouvement) {
            throw new Error(`Le produit "${product.nom}" n'autorise que le type "${product.typesMouvementsAutorises}"`);
          }
        }

        const stockDisponible = await productService.getAvailableStock(product.id);
        if (item.quantite > stockDisponible) {
          throw new Error(`Stock insuffisant pour "${product.nom}" (disponible: ${stockDisponible})`);
        }

        const movementData: any = {
          utilisateurId: userId,
          produitId: product.id,
          quantite: item.quantite,
          type: item.typeMouvement,
          statut: item.typeMouvement === "pret" ? "en_cours" : "termine",
        };

        if (item.typeMouvement === "pret") {
          const returnDate = new Date();
          returnDate.setDate(returnDate.getDate() + 15);
          movementData.dateRetourPrevu = returnDate;
        }

        const movement = await storage.createMovement(movementData);

        if (item.typeMouvement === "consommation") {
          const newStock = product.stockActuel - item.quantite;
          await storage.updateProduct(product.id, {
            stockActuel: newStock,
          });
          
          const isGeomembrane = product.longueur && product.largeur && !product.estTemplate;
          const isJRVariant = product.longueur && !product.largeur && product.nom.startsWith("JR -") && !product.estTemplate;
          if ((isGeomembrane || isJRVariant) && newStock === 0) {
            await storage.updateProduct(product.id, {
              actif: false,
            });
          }
        }

        results.push({ type: "prendre", movement });
      } else if (item.typeAction === "rendre") {
        const movement = item.movement;
        if (!movement) {
          throw new Error(`Mouvement non trouvé pour item ${item.id}`);
        }

        const totalReturned = item.quantite + (item.quantitePerdue || 0);
        if (totalReturned > movement.quantite) {
          throw new Error("Quantité totale (rendue + perdue) invalide");
        }

        if (totalReturned < movement.quantite) {
          await storage.createMovement({
            utilisateurId: movement.utilisateurId,
            produitId: movement.produitId,
            quantite: item.quantite,
            type: "retour",
            statut: "termine",
            quantitePerdue: item.quantitePerdue || 0,
          });
          
          await storage.updateMovement(movement.id, {
            quantite: movement.quantite - totalReturned,
          });
        } else {
          await storage.updateMovement(movement.id, {
            statut: "termine",
            quantitePerdue: item.quantitePerdue || 0,
          });
        }

        if (item.quantitePerdue && item.quantitePerdue > 0) {
          const product = await storage.getProduct(movement.produitId);
          if (product) {
            const newStock = product.stockActuel - item.quantitePerdue;
            await storage.updateProduct(movement.produitId, {
              stockActuel: newStock,
            });
            
            const isGeomembrane = product.longueur && product.largeur && !product.estTemplate;
            const isJRVariant = product.longueur && !product.largeur && product.nom.startsWith("JR -") && !product.estTemplate;
            if ((isGeomembrane || isJRVariant) && newStock === 0) {
              await storage.updateProduct(movement.produitId, {
                actif: false,
              });
            }
          }
        }

        results.push({ type: "rendre", movementId: movement.id });
      } else if (item.typeAction === "deposer") {
        const product = item.product;
        if (!product) {
          throw new Error(`Produit non trouvé pour item ${item.id}`);
        }

        let targetProductId = product.id;
        
        if (product.sousSection === "Géomembranes" && item.longueur && item.largeur && item.couleur) {
          const minDim = Math.min(item.longueur, item.largeur);
          const maxDim = Math.max(item.longueur, item.largeur);
          const dimensionSuffix = `${minDim}mx${maxDim}m`;
          
          const baseName = product.nom.replace(' (Template)', '').trim();
          const variantName = `${baseName} ${dimensionSuffix} - ${item.couleur}`;
          
          const [existingVariant] = await db
            .select()
            .from(products)
            .where(
              and(
                eq(products.categorie, product.categorie),
                eq(products.sousSection, product.sousSection),
                eq(products.longueur, minDim),
                eq(products.largeur, maxDim),
                eq(products.couleur, item.couleur)
              )
            )
            .limit(1);
          
          let variantProduct;
          if (existingVariant) {
            variantProduct = existingVariant;
            
            if (!existingVariant.actif) {
              variantProduct = await storage.updateProduct(existingVariant.id, {
                actif: true,
              });
            }
          } else {
            variantProduct = await storage.createProduct({
              nom: variantName,
              categorie: product.categorie,
              sousSection: product.sousSection,
              unite: product.unite,
              stockActuel: 0,
              stockMinimum: 0,
              typesMouvementsAutorises: product.typesMouvementsAutorises,
              statut: "valide",
              creePar: userId,
              longueur: minDim,
              largeur: maxDim,
              couleur: item.couleur,
              estTemplate: false,
            });
          }
          
          targetProductId = variantProduct.id;
        }
        
        if (product.estTemplate && product.nom.includes("Rouleau partiellement utilisé") && product.nom.startsWith("JR -") && item.longueur) {
          const longueurValue = item.longueur;
          const dimensionSuffix = `(${longueurValue}m)`;
          
          const baseName = product.nom.replace(' (Rouleau partiellement utilisé)', '').trim();
          const variantName = `${baseName} ${dimensionSuffix}`;
          
          const [existingVariant] = await db
            .select()
            .from(products)
            .where(
              and(
                eq(products.nom, variantName),
                eq(products.categorie, product.categorie),
                eq(products.sousSection, product.sousSection)
              )
            )
            .limit(1);
          
          let variantProduct;
          if (existingVariant) {
            variantProduct = existingVariant;
            
            if (!existingVariant.actif) {
              variantProduct = await storage.updateProduct(existingVariant.id, {
                actif: true,
              });
            }
          } else {
            variantProduct = await storage.createProduct({
              nom: variantName,
              categorie: product.categorie,
              sousSection: product.sousSection,
              unite: "unité(s)",
              stockActuel: 0,
              stockMinimum: 0,
              typesMouvementsAutorises: product.typesMouvementsAutorises,
              statut: "valide",
              creePar: userId,
              longueur: longueurValue,
              estTemplate: false,
            });
          }
          
          targetProductId = variantProduct.id;
        }

        const targetProduct = await storage.getProduct(targetProductId);
        if (!targetProduct) {
          throw new Error(`Produit cible non trouvé`);
        }

        const updateData: any = {
          stockActuel: targetProduct.stockActuel + item.quantite,
        };
        
        const isGeomembrane = targetProduct.longueur && targetProduct.largeur && !targetProduct.estTemplate;
        const isJRVariant = targetProduct.longueur && !targetProduct.largeur && targetProduct.nom.startsWith("JR -") && !targetProduct.estTemplate;
        if (!targetProduct.actif && (isGeomembrane || isJRVariant)) {
          updateData.actif = true;
        }
        
        await storage.updateProduct(targetProductId, updateData);

        const movement = await storage.createMovement({
          utilisateurId: userId,
          produitId: targetProductId,
          quantite: item.quantite,
          type: "depot",
          statut: "termine",
        });

        deposerProductMap.set(item.id, targetProduct);
        
        results.push({ type: "deposer", movement, targetProduct });
      }
    }

    await storage.clearListe(userId);
    productService.invalidateStockCache();

    const user = await storage.getUser(userId);
    const validationData: ValidationPanierData = {
      userName: user?.nom || 'Utilisateur inconnu',
      date: new Date().toLocaleString('fr-FR'),
      items: {
        prendre: [],
        rendre: [],
        deposer: [],
        perdu: [],
      },
    };

    const returnProductIds = new Set<number>();
    for (const item of items) {
      if (item.typeAction === "rendre" && item.movement?.produitId) {
        returnProductIds.add(item.movement.produitId);
      }
    }
    
    const returnProductsMap = new Map<number, any>();
    for (const produitId of Array.from(returnProductIds)) {
      const product = await storage.getProduct(produitId);
      if (product) {
        returnProductsMap.set(produitId, product);
      }
    }

    for (const item of items) {
      if (item.typeAction === "prendre" && item.product) {
        validationData.items.prendre!.push({
          nom: item.product.nom,
          quantite: item.quantite,
          unite: item.product.unite,
          type: item.typeMouvement || 'pret',
        });
      } else if (item.typeAction === "rendre" && item.movement?.produitId) {
        const product = returnProductsMap.get(item.movement.produitId);
        if (product) {
          if (item.quantite > 0) {
            validationData.items.rendre!.push({
              nom: product.nom,
              quantite: item.quantite,
              unite: product.unite,
            });
          }
          if ((item.quantitePerdue || 0) > 0) {
            validationData.items.perdu!.push({
              nom: product.nom,
              quantite: item.quantitePerdue || 0,
              unite: product.unite,
            });
          }
        }
      } else if (item.typeAction === "deposer") {
        const targetProduct = deposerProductMap.get(item.id);
        if (targetProduct) {
          validationData.items.deposer!.push({
            nom: targetProduct.nom,
            quantite: item.quantite,
            unite: targetProduct.unite,
          });
        } else if (item.product) {
          validationData.items.deposer!.push({
            nom: item.product.nom,
            quantite: item.quantite,
            unite: item.product.unite,
          });
        }
      }
    }

    const emailHtml = createValidationPanierEmail(validationData);
    sendEmail(storage, {
      type: 'validation_panier',
      to: ['team@filtreplante.com'],
      subject: `[STOCK] Validation liste - ${user?.nom || 'Utilisateur'}`,
      html: emailHtml,
    }).catch(err => {
      logger.error(`Échec envoi email validation: ${err.message}`);
    });

    logger.info(`Liste validée pour user ${userId}: ${results.length} actions`);
    res.json({ success: true, results });
  } catch (error) {
    next(error);
  }
});

export default router;
