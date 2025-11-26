import { Router } from "express";
import { storage } from "../storage";
import { productService } from "../services/ProductService";
import { logger } from "../middleware/logger";

const router = Router();

router.get("/active", async (req, res, next) => {
  try {
    const allMovements = await storage.getAllMovements();
    const activeMovements = allMovements.filter((m) => m.statut === "en_cours" && m.type === "pret");
    
    const enrichedLoans = await Promise.all(
      activeMovements.map(async (movement) => {
        const product = await storage.getProduct(movement.produitId);
        const user = await storage.getUser(movement.utilisateurId);
        const now = new Date();
        const loanDate = new Date(movement.date);
        const dureeJours = Math.floor((now.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let statusDuree: "recent" | "attention" | "retard";
        if (dureeJours < 7) {
          statusDuree = "recent";
        } else if (dureeJours < 15) {
          statusDuree = "attention";
        } else {
          statusDuree = "retard";
        }

        return {
          ...movement,
          product,
          user,
          dureeJours,
          statusDuree,
        };
      })
    );

    res.json(enrichedLoans);
  } catch (error) {
    next(error);
  }
});

router.get("/active/:userId", async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    const activeMovements = await storage.getActiveMovementsByUser(userId);
    
    const enrichedLoans = await Promise.all(
      activeMovements.map(async (movement) => {
        const product = await storage.getProduct(movement.produitId);
        const now = new Date();
        const loanDate = new Date(movement.date);
        const dureeJours = Math.floor((now.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let statusDuree: "recent" | "attention" | "retard";
        if (dureeJours < 7) {
          statusDuree = "recent";
        } else if (dureeJours < 15) {
          statusDuree = "attention";
        } else {
          statusDuree = "retard";
        }

        return {
          ...movement,
          product,
          dureeJours,
          statusDuree,
        };
      })
    );

    res.json(enrichedLoans);
  } catch (error) {
    next(error);
  }
});

router.post("/borrow", async (req, res, next) => {
  try {
    const { utilisateurId, produitId, quantite, type } = req.body;
    
    const product = await storage.getProduct(produitId);
    if (!product) {
      return res.status(404).json({ error: "Produit non trouvé" });
    }

    if (product.statut !== "valide") {
      return res.status(400).json({ error: "Ce produit doit être validé avant d'être emprunté" });
    }

    if (product.typesMouvementsAutorises !== "les_deux") {
      if (product.typesMouvementsAutorises !== type) {
        return res.status(400).json({ 
          error: `Ce produit n'autorise que le type "${product.typesMouvementsAutorises}"` 
        });
      }
    }

    const stockDisponible = await productService.getAvailableStock(produitId);
    if (quantite > stockDisponible) {
      return res.status(400).json({ error: "Stock insuffisant" });
    }

    const movementData: any = {
      utilisateurId,
      produitId,
      quantite,
      type,
      statut: type === "pret" ? "en_cours" : "termine",
    };

    if (type === "pret") {
      const returnDate = new Date();
      returnDate.setDate(returnDate.getDate() + 15);
      movementData.dateRetourPrevu = returnDate;
    }

    const movement = await storage.createMovement(movementData);
    productService.invalidateStockCache(produitId);

    if (type === "consommation") {
      const newStock = product.stockActuel - quantite;
      await storage.updateProduct(produitId, {
        stockActuel: newStock,
      });
      
      const isGeomembrane = product.longueur && product.largeur && !product.estTemplate;
      const isJRVariant = product.longueur && !product.largeur && product.nom.startsWith("JR -") && !product.estTemplate;
      if ((isGeomembrane || isJRVariant) && newStock === 0) {
        await storage.updateProduct(produitId, {
          actif: false,
        });
        logger.info(`Produit ${produitId} désactivé (stock=0)`);
      }
    }

    logger.info(`Mouvement ${type} créé: produit ${produitId}, quantité ${quantite}`);
    res.json(movement);
  } catch (error) {
    next(error);
  }
});

router.post("/return", async (req, res, next) => {
  try {
    const { mouvementId, quantite } = req.body;
    
    const movement = await storage.getMovement(mouvementId);
    if (!movement) {
      return res.status(404).json({ error: "Emprunt non trouvé" });
    }

    if (quantite > movement.quantite) {
      return res.status(400).json({ error: "Quantité invalide" });
    }

    if (quantite < movement.quantite) {
      await storage.createMovement({
        utilisateurId: movement.utilisateurId,
        produitId: movement.produitId,
        quantite,
        type: "retour",
        statut: "termine",
      });
      
      await storage.updateMovement(mouvementId, {
        quantite: movement.quantite - quantite,
      });
    } else {
      await storage.updateMovement(mouvementId, {
        statut: "termine",
      });
    }

    productService.invalidateStockCache(movement.produitId);
    logger.info(`Retour traité: mouvement ${mouvementId}, quantité ${quantite}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post("/deposit", async (req, res, next) => {
  try {
    const { utilisateurId, produitId, quantite } = req.body;
    
    const product = await storage.getProduct(produitId);
    if (!product) {
      return res.status(404).json({ error: "Produit non trouvé" });
    }

    if (product.statut !== "valide") {
      return res.status(400).json({ error: "Ce produit doit être validé avant d'ajouter du stock" });
    }

    const movement = await storage.createMovement({
      utilisateurId,
      produitId,
      quantite,
      type: "depot",
      statut: "termine",
    });

    const updateData: any = {
      stockActuel: product.stockActuel + quantite,
    };
    
    const isGeomembrane = product.longueur && product.largeur && !product.estTemplate;
    const isJRVariant = product.longueur && !product.largeur && product.nom.startsWith("JR -") && !product.estTemplate;
    if (!product.actif && (isGeomembrane || isJRVariant)) {
      updateData.actif = true;
      logger.info(`Produit ${produitId} réactivé (dépôt stock)`);
    }
    
    await storage.updateProduct(produitId, updateData);
    productService.invalidateStockCache(produitId);

    logger.info(`Dépôt créé: produit ${produitId}, quantité ${quantite}`);
    res.json(movement);
  } catch (error) {
    next(error);
  }
});

export default router;
