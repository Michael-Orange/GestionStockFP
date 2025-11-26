import { Router } from "express";
import { storage } from "../storage";
import { productService } from "../services/ProductService";
import { insertProductSchema } from "@shared/schema";
import { sendEmail } from "../services/email-service";
import { 
  createNouveauProduitEmail, 
  createValidationProduitEmail,
  createRefusProduitEmail,
  type NouveauProduitData,
  type ValidationProduitData,
  type RefusProduitData
} from "../services/email-templates";
import { logger } from "../middleware/logger";

const router = Router();

const enrichProductWithStock = async (product: any) => {
  const stockDisponible = await productService.getAvailableStock(product.id);
  const stockStatus: "en_stock" | "pas_en_stock" = stockDisponible > 0 ? "en_stock" : "pas_en_stock";
  return {
    ...product,
    stockDisponible,
    stockStatus,
  };
};

router.get("/", async (req, res, next) => {
  try {
    const allProducts = await storage.getAllProducts();
    const validatedProducts = allProducts.filter((p) => p.statut === "valide");
    const enrichedProducts = await Promise.all(
      validatedProducts.map((p) => enrichProductWithStock(p))
    );
    res.json(enrichedProducts);
  } catch (error) {
    next(error);
  }
});

router.get("/pending", async (req, res, next) => {
  try {
    const pendingProducts = await storage.getProductsByStatus("en_attente");
    const enrichedProducts = await Promise.all(
      pendingProducts.map((p) => enrichProductWithStock(p))
    );
    res.json(enrichedProducts);
  } catch (error) {
    next(error);
  }
});

router.get("/export-csv", async (req, res, next) => {
  try {
    const allProducts = await storage.getAllProducts();
    const enrichedProducts = await Promise.all(
      allProducts.map((p) => enrichProductWithStock(p))
    );
    
    const escapeCSV = (field: string) => {
      const escaped = field.replace(/"/g, '""');
      return `"${escaped}"`;
    };
    
    const csvHeader = "Catégorie,Sous-section,Produit,Unité,Stock Actuel,Stock Disponible,Stock Minimum,Statut,Type Autorisé\n";
    const csvRows = enrichedProducts.map((p) => 
      `${escapeCSV(p.categorie)},${escapeCSV(p.sousSection)},${escapeCSV(p.nom)},${escapeCSV(p.unite)},${p.stockActuel},${p.stockDisponible},${p.stockMinimum},${escapeCSV(p.statut)},${escapeCSV(p.typesMouvementsAutorises)}`
    ).join("\n");
    
    const csv = csvHeader + csvRows;
    
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="stock-filtreplante-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send("\ufeff" + csv);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = insertProductSchema.parse(req.body);
    const product = await storage.createProduct(parsed);
    
    if (parsed.sousSection === "Tubes & tuyaux") {
      const isJR = parsed.nom.startsWith("JR -");
      
      if (isJR) {
        const updatedName = `${parsed.nom} (Rouleau de 100m)`;
        await storage.updateProduct(product.id, {
          nom: updatedName,
        });
        product.nom = updatedName;
        
        const rouleau50Data = {
          ...parsed,
          nom: `${parsed.nom} (Rouleau de 50m)`,
          unite: "Rouleau de 50m",
          stockActuel: 0,
        };
        await storage.createProduct(rouleau50Data);
        
        const templateData = {
          ...parsed,
          nom: `${parsed.nom} (Rouleau partiellement utilisé)`,
          unite: "unité(s)",
          stockActuel: 0,
          estTemplate: true,
        };
        await storage.createProduct(templateData);
        
        const chuteData = {
          ...parsed,
          nom: `${parsed.nom} (Chute)`,
          unite: "Chute > 3m (et inf. à 10m)",
          stockActuel: 0,
        };
        await storage.createProduct(chuteData);
      } else {
        const chuteData = {
          ...parsed,
          nom: `${parsed.nom} (Chute)`,
          unite: "Chute > 50cm",
          stockActuel: 0,
        };
        await storage.createProduct(chuteData);
      }
    }
    
    if (parsed.creePar) {
      const creator = await storage.getUser(parsed.creePar);
      const emailData: NouveauProduitData = {
        productName: product.nom,
        category: product.categorie,
        subSection: product.sousSection,
        createdBy: creator?.nom || 'Utilisateur inconnu',
        date: new Date().toLocaleString('fr-FR'),
      };
      
      const emailHtml = createNouveauProduitEmail(emailData);
      await sendEmail(storage, {
        type: 'nouveau_produit',
        to: ['team@filtreplante.com'],
        subject: `[STOCK] Nouveau produit en attente - ${product.nom}`,
        html: emailHtml,
      });
    }
    
    if (parsed.creePar !== 3) {
      await storage.createAlert({
        type: "nouveau_produit",
        produitId: product.id,
        utilisateurCibleId: 3,
        message: `Nouveau produit créé : ${product.nom}`,
        lue: 0,
      });
    }
    
    logger.info(`Produit créé: ${product.id} - ${product.nom}`);
    res.json(product);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/validate", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { userId } = req.body;
    
    const product = await storage.validateProduct(id);
    
    let validatedBy = 'Administrateur';
    if (userId) {
      const admin = await storage.getUser(userId);
      if (admin) {
        validatedBy = admin.nom;
      }
    }
    
    const emailData: ValidationProduitData = {
      productName: product.nom,
      category: product.categorie,
      subSection: product.sousSection,
      validatedBy,
      date: new Date().toLocaleString('fr-FR'),
    };
    
    const emailHtml = createValidationProduitEmail(emailData);
    await sendEmail(storage, {
      type: 'validation_produit',
      to: ['team@filtreplante.com'],
      subject: `[STOCK] Produit validé - ${product.nom}`,
      html: emailHtml,
    });
    
    logger.info(`Produit ${id} validé par ${validatedBy}`);
    res.json(product);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const product = await storage.updateProduct(id, req.body);
    productService.invalidateStockCache(id);
    logger.info(`Produit ${id} mis à jour`);
    res.json(product);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { userId } = req.body;
    
    const product = await storage.getProduct(id);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    let createdBy = 'Utilisateur inconnu';
    if (product.creePar) {
      const creator = await storage.getUser(product.creePar);
      if (creator) {
        createdBy = creator.nom;
      }
    }
    
    let refusedBy = 'Administrateur';
    if (userId) {
      const admin = await storage.getUser(userId);
      if (admin) {
        refusedBy = admin.nom;
      }
    }
    
    const emailData: RefusProduitData = {
      productName: product.nom,
      category: product.categorie,
      subSection: product.sousSection,
      createdBy,
      refusedBy,
      date: new Date().toLocaleString('fr-FR'),
    };
    
    const emailHtml = createRefusProduitEmail(emailData);
    await sendEmail(storage, {
      type: 'refus_produit',
      to: ['team@filtreplante.com'],
      subject: `[STOCK] Produit refusé - ${product.nom}`,
      html: emailHtml,
    });
    
    await storage.deleteProduct(id);
    productService.invalidateStockCache(id);
    logger.info(`Produit ${id} supprimé/refusé par ${refusedBy}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get("/units", async (req, res, next) => {
  try {
    const units = await storage.getAllUnits();
    res.json(units);
  } catch (error) {
    next(error);
  }
});

export default router;
