import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertMovementSchema, insertAlertSchema } from "@shared/schema";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // Helper function to calculate available stock
  const calculateAvailableStock = async (productId: number, currentStock: number) => {
    const allMovements = await storage.getAllMovements();
    const activeLoans = allMovements.filter(
      (m) => m.produitId === productId && m.type === "pret" && m.statut === "en_cours"
    );
    const totalLoaned = activeLoans.reduce((sum, m) => sum + m.quantite, 0);
    return currentStock - totalLoaned;
  };

  // Helper function to enrich product with stock status
  const enrichProductWithStock = async (product: any) => {
    const stockDisponible = await calculateAvailableStock(product.id, product.stockActuel);
    let stockStatus: "ok" | "faible" | "vide";
    
    if (stockDisponible === 0) {
      stockStatus = "vide";
    } else if (stockDisponible <= product.stockMinimum) {
      stockStatus = "faible";
    } else {
      stockStatus = "ok";
    }

    return {
      ...product,
      stockDisponible,
      stockStatus,
    };
  };

  // ========== PRODUCTS ==========
  
  // GET /api/products - Get all validated products with stock status
  app.get("/api/products", async (req, res) => {
    try {
      const allProducts = await storage.getAllProducts();
      // Only return validated products
      const validatedProducts = allProducts.filter((p) => p.statut === "valide");
      const enrichedProducts = await Promise.all(
        validatedProducts.map((p) => enrichProductWithStock(p))
      );
      res.json(enrichedProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/products/pending - Get products pending validation (admin only)
  app.get("/api/products/pending", async (req, res) => {
    try {
      const pendingProducts = await storage.getProductsByStatus("en_attente");
      const enrichedProducts = await Promise.all(
        pendingProducts.map((p) => enrichProductWithStock(p))
      );
      res.json(enrichedProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/categories - Get all categories with product counts
  app.get("/api/categories", async (req, res) => {
    try {
      const allProducts = await storage.getAllProducts();
      const validatedProducts = allProducts.filter((p) => p.statut === "valide");
      
      const categoryMap = new Map<string, { count: number; sousSections: Set<string> }>();
      
      validatedProducts.forEach((product) => {
        if (!categoryMap.has(product.categorie)) {
          categoryMap.set(product.categorie, { count: 0, sousSections: new Set() });
        }
        const catInfo = categoryMap.get(product.categorie)!;
        catInfo.count++;
        catInfo.sousSections.add(product.sousSection);
      });

      const categories = Array.from(categoryMap.entries()).map(([categorie, info]) => ({
        categorie,
        count: info.count,
        sousSections: Array.from(info.sousSections),
      }));

      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/products/export-csv - Export all products with quantities (admin)
  app.get("/api/products/export-csv", async (req, res) => {
    try {
      const allProducts = await storage.getAllProducts();
      const enrichedProducts = await Promise.all(
        allProducts.map((p) => enrichProductWithStock(p))
      );
      
      // Helper to escape CSV fields
      const escapeCSV = (field: string) => {
        const escaped = field.replace(/"/g, '""');
        return `"${escaped}"`;
      };
      
      // Generate CSV
      const csvHeader = "Catégorie,Sous-section,Produit,Unité,Stock Actuel,Stock Disponible,Stock Minimum,Statut,Type Autorisé\n";
      const csvRows = enrichedProducts.map((p) => 
        `${escapeCSV(p.categorie)},${escapeCSV(p.sousSection)},${escapeCSV(p.nom)},${escapeCSV(p.unite)},${p.stockActuel},${p.stockDisponible},${p.stockMinimum},${escapeCSV(p.statut)},${escapeCSV(p.typesMouvementsAutorises)}`
      ).join("\n");
      
      const csv = csvHeader + csvRows;
      
      // Set headers for file download
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="stock-filtreplante-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send("\ufeff" + csv); // UTF-8 BOM for Excel
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/products - Create new product
  app.post("/api/products", async (req, res) => {
    try {
      const parsed = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(parsed);
      
      // Notify admin (Michael = id 3) if not created by admin
      if (parsed.creePar !== 3) {
        await storage.createAlert({
          type: "nouveau_produit",
          produitId: product.id,
          utilisateurCibleId: 3, // Michael
          message: `Nouveau produit créé : ${product.nom}`,
          lue: 0,
        });
      }
      
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/products/:id/validate - Validate pending product (admin)
  app.post("/api/products/:id/validate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.validateProduct(id);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // PUT /api/products/:id - Update product (admin)
  app.put("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.updateProduct(id, req.body);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE /api/products/:id - Delete product (admin)
  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProduct(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========== MOVEMENTS ==========

  // GET /api/movements/active/:userId - Get active loans for a user
  app.get("/api/movements/active/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const activeMovements = await storage.getActiveMovementsByUser(userId);
      
      // Enrich with product info and duration
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/movements/borrow - Borrow a product
  app.post("/api/movements/borrow", async (req, res) => {
    try {
      const { utilisateurId, produitId, quantite, type } = req.body;
      
      // Validate stock availability
      const product = await storage.getProduct(produitId);
      if (!product) {
        return res.status(404).json({ error: "Produit non trouvé" });
      }

      // Defensive check: reject non-validated products
      if (product.statut !== "valide") {
        return res.status(400).json({ error: "Ce produit doit être validé avant d'être emprunté" });
      }

      // Check if movement type is allowed for this product
      if (product.typesMouvementsAutorises !== "les_deux") {
        if (product.typesMouvementsAutorises !== type) {
          return res.status(400).json({ 
            error: `Ce produit n'autorise que le type "${product.typesMouvementsAutorises}"` 
          });
        }
      }

      const stockDisponible = await calculateAvailableStock(produitId, product.stockActuel);
      if (quantite > stockDisponible) {
        return res.status(400).json({ error: "Stock insuffisant" });
      }

      // Create movement
      const movementData: any = {
        utilisateurId,
        produitId,
        quantite,
        type,
        statut: type === "pret" ? "en_cours" : "termine",
      };

      // Set expected return date for loans (15 days)
      if (type === "pret") {
        const returnDate = new Date();
        returnDate.setDate(returnDate.getDate() + 15);
        movementData.dateRetourPrevu = returnDate;
      }

      const movement = await storage.createMovement(movementData);

      // If it's consumption, update stock immediately
      if (type === "consommation") {
        await storage.updateProduct(produitId, {
          stockActuel: product.stockActuel - quantite,
        });
      }

      res.json(movement);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/movements/return - Return a borrowed product
  app.post("/api/movements/return", async (req, res) => {
    try {
      const { mouvementId, quantite } = req.body;
      
      const movement = await storage.getMovement(mouvementId);
      if (!movement) {
        return res.status(404).json({ error: "Emprunt non trouvé" });
      }

      if (quantite > movement.quantite) {
        return res.status(400).json({ error: "Quantité invalide" });
      }

      // If partial return, create new movement for returned amount
      if (quantite < movement.quantite) {
        await storage.createMovement({
          utilisateurId: movement.utilisateurId,
          produitId: movement.produitId,
          quantite,
          type: "retour",
          statut: "termine",
          dateRetourEffectif: new Date(),
        });
        
        // Update original movement quantity
        await storage.updateMovement(mouvementId, {
          quantite: movement.quantite - quantite,
        });
      } else {
        // Full return - mark movement as completed
        await storage.updateMovement(mouvementId, {
          statut: "termine",
          dateRetourEffectif: new Date(),
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/movements/deposit - Deposit stock
  app.post("/api/movements/deposit", async (req, res) => {
    try {
      const { utilisateurId, produitId, quantite } = req.body;
      
      const product = await storage.getProduct(produitId);
      if (!product) {
        return res.status(404).json({ error: "Produit non trouvé" });
      }

      // Defensive check: reject non-validated products
      if (product.statut !== "valide") {
        return res.status(400).json({ error: "Ce produit doit être validé avant d'ajouter du stock" });
      }

      // Create deposit movement
      const movement = await storage.createMovement({
        utilisateurId,
        produitId,
        quantite,
        type: "depot",
        statut: "termine",
      });

      // Update product stock
      await storage.updateProduct(produitId, {
        stockActuel: product.stockActuel + quantite,
      });

      res.json(movement);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========== ALERTS ==========

  // GET /api/alerts/unread/:userId - Get unread alerts for a user
  app.get("/api/alerts/unread/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const alerts = await storage.getUnreadAlerts(userId);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/alerts/:id/read - Mark alert as read
  app.post("/api/alerts/:id/read", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const alert = await storage.markAlertAsRead(id);
      res.json(alert);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========== CSV IMPORT ==========

  // POST /api/import-csv - Import products from CSV (admin only)
  app.post("/api/import-csv", async (req, res) => {
    try {
      const csvPath = join(process.cwd(), "attached_assets", "dust_output_1760788353237._1760788811965.csv");
      const csvContent = readFileSync(csvPath, "utf-8");
      
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
        relax_column_count: true,
      });

      let imported = 0;
      let skipped = 0;

      for (const record of records) {
        const { Catégorie, "Sous-section": SousSection, Produit, Unité } = record;
        
        if (!Catégorie || !SousSection || !Produit || !Unité) {
          skipped++;
          continue;
        }

        // Check if product already exists
        const existingProducts = await storage.getAllProducts();
        const exists = existingProducts.some(
          (p) => 
            p.nom === Produit &&
            p.categorie === Catégorie &&
            p.sousSection === SousSection
        );

        if (exists) {
          skipped++;
          continue;
        }

        await storage.createProduct({
          categorie: Catégorie,
          sousSection: SousSection,
          nom: Produit,
          unite: Unité,
          stockActuel: 0,
          stockMinimum: 0,
          statut: "valide",
          creePar: 3, // Michael (admin)
        });

        imported++;
      }

      res.json({ imported, skipped, total: records.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== USERS ==========

  // Initialize default users if not exists
  app.post("/api/init-users", async (req, res) => {
    try {
      const existingUsers = await storage.getAllUsers();
      
      if (existingUsers.length === 0) {
        const defaultUsers = [
          { nom: "Marine", email: "marine@filtreplante.com", role: "utilisateur" },
          { nom: "Fatou", email: "fatou@filtreplante.com", role: "utilisateur" },
          { nom: "Michael", email: "michael@filtreplante.com", role: "admin" },
          { nom: "Cheikh", email: "cheikh@filtreplante.com", role: "utilisateur" },
          { nom: "Papa", email: "papa@filtreplante.com", role: "utilisateur" },
        ];

        for (const user of defaultUsers) {
          await storage.createUser(user);
        }

        res.json({ message: "Utilisateurs initialisés", count: 5 });
      } else {
        res.json({ message: "Utilisateurs déjà initialisés", count: existingUsers.length });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
