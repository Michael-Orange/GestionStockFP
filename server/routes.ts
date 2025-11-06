import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { insertProductSchema, insertMovementSchema, insertAlertSchema, listes, listeItems, products } from "@shared/schema";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import { sendEmail } from "./services/email-service";
import { 
  createValidationPanierEmail, 
  createNouveauProduitEmail,
  createValidationProduitEmail,
  createRefusProduitEmail,
  type ValidationPanierData,
  type NouveauProduitData,
  type ValidationProduitData,
  type RefusProduitData
} from "./services/email-templates";

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
    const stockStatus: "en_stock" | "pas_en_stock" = stockDisponible > 0 ? "en_stock" : "pas_en_stock";

    return {
      ...product,
      stockDisponible,
      stockStatus,
    };
  };

  // ========== AUTHENTICATION ==========
  
  // POST /api/auth/verify-admin - Verify admin password
  app.post("/api/auth/verify-admin", async (req, res) => {
    try {
      const { userId, password } = req.body;
      
      if (!userId || !password) {
        return res.status(400).json({ error: "userId et password requis" });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Utilisateur n'est pas admin" });
      }
      
      if (!user.passwordHash) {
        return res.status(500).json({ error: "Mot de passe non configuré pour cet admin" });
      }
      
      const isValid = await bcrypt.compare(password, user.passwordHash);
      
      if (isValid) {
        res.json({ success: true, user: { id: user.id, nom: user.nom, role: user.role } });
      } else {
        res.status(401).json({ success: false, error: "Mot de passe incorrect" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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

      const categories = Array.from(categoryMap.entries())
        .map(([categorie, info]) => ({
          categorie,
          count: info.count,
          sousSections: Array.from(info.sousSections),
        }))
        .sort((a, b) => a.categorie.localeCompare(b.categorie));

      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/categories/:categorie/sous-sections - Get all sous-sections for a category
  app.get("/api/categories/:categorie/sous-sections", async (req, res) => {
    try {
      const { categorie } = req.params;
      const allProducts = await storage.getAllProducts();
      const validatedProducts = allProducts.filter(
        (p) => p.statut === "valide" && p.categorie === categorie
      );
      
      const sousSectionsSet = new Set<string>();
      validatedProducts.forEach((product) => {
        sousSectionsSet.add(product.sousSection);
      });

      // Tri avec "Tous" en premier, puis alphabétique
      const sousSections = Array.from(sousSectionsSet).sort((a, b) => {
        if (a === "Tous") return -1;
        if (b === "Tous") return 1;
        return a.localeCompare(b);
      });
      res.json(sousSections);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/units - Get all unique units used in products
  app.get("/api/units", async (req, res) => {
    try {
      const units = await storage.getAllUnits();
      res.json(units);
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
      
      // Auto-create variants for Tubes & tuyaux
      if (parsed.sousSection === "Tubes & tuyaux") {
        const isJR = parsed.nom.startsWith("JR -");
        
        if (isJR) {
          // Update base product name to add (Rouleau de 100m) suffix for consistency
          const updatedName = `${parsed.nom} (Rouleau de 100m)`;
          await storage.updateProduct(product.id, {
            nom: updatedName,
          });
          // Update product object with new name for subsequent use (emails, alerts, response)
          product.nom = updatedName;
          
          // For JR products, create 3 additional products:
          // 1. Rouleau de 50m
          const rouleau50Data = {
            ...parsed,
            nom: `${parsed.nom} (Rouleau de 50m)`,
            unite: "Rouleau de 50m",
            stockActuel: 0,
          };
          await storage.createProduct(rouleau50Data);
          
          // 2. Template Rouleau partiellement utilisé
          const templateData = {
            ...parsed,
            nom: `${parsed.nom} (Rouleau partiellement utilisé)`,
            unite: "unité(s)",
            stockActuel: 0,
            estTemplate: true,
          };
          await storage.createProduct(templateData);
          
          // 3. Chute > 3m (et inf. à 10m)
          const chuteData = {
            ...parsed,
            nom: `${parsed.nom} (Chute)`,
            unite: "Chute > 3m (et inf. à 10m)",
            stockActuel: 0,
          };
          await storage.createProduct(chuteData);
        } else {
          // For PRESSION and EVAC products, create only chute with > 50cm
          const chuteData = {
            ...parsed,
            nom: `${parsed.nom} (Chute)`,
            unite: "Chute > 50cm",
            stockActuel: 0,
          };
          await storage.createProduct(chuteData);
        }
      }
      
      // Send email if created by non-admin user (not Michael=3 and not Marine=1)
      if (parsed.creePar && parsed.creePar !== 3 && parsed.creePar !== 1) {
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
          to: ['marine@filtreplante.com', 'michael@filtreplante.com'],
          subject: `[STOCK] Nouveau produit en attente - ${product.nom}`,
          html: emailHtml,
        });
      }
      
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
      const { userId } = req.body;
      
      const product = await storage.validateProduct(id);
      
      // Get admin name for email
      let validatedBy = 'Administrateur';
      if (userId) {
        const admin = await storage.getUser(userId);
        if (admin) {
          validatedBy = admin.nom;
        }
      }
      
      // Send email to notify team that product is now validated and available
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
        to: ['marine@filtreplante.com', 'michael@filtreplante.com', 'fatou@filtreplante.com'],
        subject: `[STOCK] Produit validé - ${product.nom}`,
        html: emailHtml,
      });
      
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
      const { userId } = req.body;
      
      // Get product info before deletion
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      // Get creator name for email
      let createdBy = 'Utilisateur inconnu';
      if (product.creePar) {
        const creator = await storage.getUser(product.creePar);
        if (creator) {
          createdBy = creator.nom;
        }
      }
      
      // Get admin name for email
      let refusedBy = 'Administrateur';
      if (userId) {
        const admin = await storage.getUser(userId);
        if (admin) {
          refusedBy = admin.nom;
        }
      }
      
      // Send email to notify team that product was refused
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
        to: ['marine@filtreplante.com', 'michael@filtreplante.com'],
        subject: `[STOCK] Produit refusé - ${product.nom}`,
        html: emailHtml,
      });
      
      // Delete the product
      await storage.deleteProduct(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========== MOVEMENTS ==========

  // GET /api/movements/active - Get ALL active loans (all users)
  app.get("/api/movements/active", async (req, res) => {
    try {
      const allMovements = await storage.getAllMovements();
      const activeMovements = allMovements.filter((m) => m.statut === "en_cours" && m.type === "pret");
      
      // Enrich with product info, user info, and duration
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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
        const newStock = product.stockActuel - quantite;
        await storage.updateProduct(produitId, {
          stockActuel: newStock,
        });
        
        // Désactiver géomembrane ou JR variant si stock=0
        const isGeomembrane = product.longueur && product.largeur && !product.estTemplate;
        const isJRVariant = product.longueur && !product.largeur && product.nom.startsWith("JR -") && !product.estTemplate;
        if ((isGeomembrane || isJRVariant) && newStock === 0) {
          await storage.updateProduct(produitId, {
            actif: false,
          });
        }
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
        });
        
        // Update original movement quantity
        await storage.updateMovement(mouvementId, {
          quantite: movement.quantite - quantite,
        });
      } else {
        // Full return - mark movement as completed
        await storage.updateMovement(mouvementId, {
          statut: "termine",
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

      // Update product stock and reactivate if inactive géomembrane
      const updateData: any = {
        stockActuel: product.stockActuel + quantite,
      };
      
      // Si le produit était inactif (géomembrane ou JR variant), le réactiver
      const isGeomembrane = product.longueur && product.largeur && !product.estTemplate;
      const isJRVariant = product.longueur && !product.largeur && product.nom.startsWith("JR -") && !product.estTemplate;
      if (!product.actif && (isGeomembrane || isJRVariant)) {
        updateData.actif = true;
      }
      
      await storage.updateProduct(produitId, updateData);

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
      
      type CSVRecord = {
        Catégorie: string;
        "Sous-section": string;
        Produit: string;
        Unité: string;
      };

      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as CSVRecord[];

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

  // ========== LISTE ==========

  // GET /api/liste/:userId - Get user's liste with items
  app.get("/api/liste/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { liste, items } = await storage.getListeWithItems(userId);
      res.json({ liste, items });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/liste/add - Add item to liste
  app.post("/api/liste/add", async (req, res) => {
    try {
      const { userId, item: itemData } = req.body;
      
      // Validation for JR template deposits
      if (itemData.typeAction === "deposer" && itemData.produitId) {
        const product = await storage.getProduct(itemData.produitId);
        if (product && product.estTemplate && product.nom.includes("Rouleau partiellement utilisé")) {
          // Longueur is required for JR templates
          if (!itemData.longueur) {
            return res.status(400).json({ 
              error: "Veuillez saisir la longueur du rouleau partiellement utilisé" 
            });
          }
          
          const longueur = parseFloat(itemData.longueur);
          
          // Check if longueur is a valid number
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
        movementId: itemData.movementId || itemData.mouvementId || null, // Support both spellings
        quantite: itemData.quantite,
        quantitePerdue: itemData.quantitePerdue || 0,
        longueur: itemData.longueur || null, // For Géomembrane deposits
        largeur: itemData.largeur || null, // For Géomembrane deposits
        couleur: itemData.couleur || null, // For Géomembrane deposits
      });
      
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE /api/liste/item/:itemId - Remove item from liste
  app.delete("/api/liste/item/:itemId", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      await storage.removeItemFromListe(itemId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE /api/liste/:userId/clear - Clear user's liste
  app.delete("/api/liste/:userId/clear", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      await storage.clearListe(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/liste/:userId/validate - Validate liste and create movements
  app.post("/api/liste/:userId/validate", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { liste, items } = await storage.getListeWithItems(userId);

      if (!items || items.length === 0) {
        return res.status(400).json({ error: "Liste vide" });
      }

      // TODO: Wrap all operations in a transaction for atomicity
      // Currently not transactional - if an error occurs mid-loop, partial changes persist
      const results = [];
      const deposerProductMap = new Map<number, any>(); // Maps liste_item ID to target product for deposer actions

      // Process each item
      for (const item of items) {
        if (item.typeAction === "prendre") {
          // Validate product
          const product = item.product;
          if (!product) {
            throw new Error(`Produit non trouvé pour item ${item.id}`);
          }

          if (product.statut !== "valide") {
            throw new Error(`Le produit "${product.nom}" doit être validé avant utilisation`);
          }

          // Check movement type is allowed
          if (product.typesMouvementsAutorises !== "les_deux") {
            if (product.typesMouvementsAutorises !== item.typeMouvement) {
              throw new Error(`Le produit "${product.nom}" n'autorise que le type "${product.typesMouvementsAutorises}"`);
            }
          }

          // Check stock
          const stockDisponible = await calculateAvailableStock(product.id, product.stockActuel);
          if (item.quantite > stockDisponible) {
            throw new Error(`Stock insuffisant pour "${product.nom}" (disponible: ${stockDisponible})`);
          }

          // Create movement
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

          // If consumption, update stock immediately
          if (item.typeMouvement === "consommation") {
            const newStock = product.stockActuel - item.quantite;
            await storage.updateProduct(product.id, {
              stockActuel: newStock,
            });
            
            // Désactiver géomembrane ou JR variant si stock=0
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
          // Return movement
          const movement = item.movement;
          if (!movement) {
            throw new Error(`Mouvement non trouvé pour item ${item.id}`);
          }

          const totalReturned = item.quantite + (item.quantitePerdue || 0);
          if (totalReturned > movement.quantite) {
            throw new Error("Quantité totale (rendue + perdue) invalide");
          }

          if (totalReturned < movement.quantite) {
            // Partial return
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
            // Full return
            await storage.updateMovement(movement.id, {
              statut: "termine",
              quantitePerdue: item.quantitePerdue || 0,
            });
          }

          // Update stock: only lost items decrease stock (returns don't change stock for loans)
          if (item.quantitePerdue && item.quantitePerdue > 0) {
            const product = await storage.getProduct(movement.produitId);
            if (product) {
              const newStock = product.stockActuel - item.quantitePerdue;
              await storage.updateProduct(movement.produitId, {
                stockActuel: newStock,
              });
              
              // Désactiver géomembrane ou JR variant si stock=0
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
          // Deposit to stock
          const product = item.product;
          if (!product) {
            throw new Error(`Produit non trouvé pour item ${item.id}`);
          }

          let targetProductId = product.id;
          
          // Debug logging for Géomembrane detection
          console.error("=== DEPOSER DEBUG ===");
          console.error("Product:", JSON.stringify({nom: product.nom, id: product.id, sousSection: product.sousSection}));
          console.error("Item dims:", JSON.stringify({longueur: item.longueur, largeur: item.largeur, couleur: item.couleur}));
          console.error("Condition:", product.sousSection === "Géomembranes", "&&", !!item.longueur, "&&", !!item.largeur);
          
          // Handle Géomembrane deposits with dimensions and color
          if (product.sousSection === "Géomembranes" && item.longueur && item.largeur && item.couleur) {
            console.error(">>> ENTERING GÉOMEMBRANE VARIANT CREATION LOGIC");

            // Normalize dimensions (smaller first)
            const minDim = Math.min(item.longueur, item.largeur);
            const maxDim = Math.max(item.longueur, item.largeur);
            const dimensionSuffix = `${minDim}mx${maxDim}m`;
            
            // Generate product name (remove " (Template)" if present)
            const baseName = product.nom.replace(' (Template)', '').trim();
            const variantName = `${baseName} ${dimensionSuffix} - ${item.couleur}`;
            
            // Check if variant already exists (including inactive products)
            // Uniqueness: longueur × largeur × couleur
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
              // Produit trouvé (actif ou inactif)
              variantProduct = existingVariant;
              
              // Si inactif, réactiver
              if (!existingVariant.actif) {
                variantProduct = await storage.updateProduct(existingVariant.id, {
                  actif: true,
                });
              }
            } else {
              // Créer nouveau variant
              variantProduct = await storage.createProduct({
                nom: variantName,
                categorie: product.categorie,
                sousSection: product.sousSection,
                unite: product.unite,
                stockActuel: 0,
                stockMinimum: 0,
                typesMouvementsAutorises: product.typesMouvementsAutorises,
                statut: "valide", // Auto-validated
                creePar: userId,
                longueur: minDim,
                largeur: maxDim,
                couleur: item.couleur,
                estTemplate: false,
              });
            }
            
            targetProductId = variantProduct.id;
          }
          
          // Handle JR "Rouleau partiellement utilisé" deposits with longueur
          if (product.estTemplate && product.nom.includes("Rouleau partiellement utilisé") && product.nom.startsWith("JR -") && item.longueur) {
            console.error(">>> ENTERING JR VARIANT CREATION LOGIC");
            
            const longueurValue = item.longueur;
            const dimensionSuffix = `(${longueurValue}m)`;
            
            // Generate product name: remove "(Rouleau partiellement utilisé)" and add dimension
            const baseName = product.nom.replace(' (Rouleau partiellement utilisé)', '').trim();
            const variantName = `${baseName} ${dimensionSuffix}`;
            
            // Check if variant already exists (including inactive products)
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
              // Produit trouvé (actif ou inactif)
              variantProduct = existingVariant;
              
              // Si inactif, réactiver
              if (!existingVariant.actif) {
                variantProduct = await storage.updateProduct(existingVariant.id, {
                  actif: true,
                });
              }
            } else {
              // Créer nouveau variant JR
              variantProduct = await storage.createProduct({
                nom: variantName,
                categorie: product.categorie,
                sousSection: product.sousSection,
                unite: "unité(s)",
                stockActuel: 0,
                stockMinimum: 0,
                typesMouvementsAutorises: product.typesMouvementsAutorises,
                statut: "valide", // Auto-validated
                creePar: userId,
                longueur: longueurValue,
                estTemplate: false,
              });
            }
            
            targetProductId = variantProduct.id;
          }

          // Get current stock of target product
          const targetProduct = await storage.getProduct(targetProductId);
          if (!targetProduct) {
            throw new Error(`Produit cible non trouvé`);
          }

          // Update product stock and reactivate if inactive
          const updateData: any = {
            stockActuel: targetProduct.stockActuel + item.quantite,
          };
          
          // Si le produit était inactif (géomembrane ou JR variant), le réactiver
          const isGeomembrane = targetProduct.longueur && targetProduct.largeur && !targetProduct.estTemplate;
          const isJRVariant = targetProduct.longueur && !targetProduct.largeur && targetProduct.nom.startsWith("JR -") && !targetProduct.estTemplate;
          if (!targetProduct.actif && (isGeomembrane || isJRVariant)) {
            updateData.actif = true;
          }
          
          await storage.updateProduct(targetProductId, updateData);

          // Create deposit movement
          const movement = await storage.createMovement({
            utilisateurId: userId,
            produitId: targetProductId,
            quantite: item.quantite,
            type: "depot",
            statut: "termine",
          });

          // Store target product for email generation
          deposerProductMap.set(item.id, targetProduct);
          
          results.push({ type: "deposer", movement, targetProduct });
        }
      }

      // Clear liste after successful validation
      await storage.clearListe(userId);

      // Send validation email
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

      // Pre-fetch all unique product IDs needed for returns
      const returnProductIds = new Set<number>();
      for (const item of items) {
        if (item.typeAction === "rendre" && item.movement?.produitId) {
          returnProductIds.add(item.movement.produitId);
        }
      }
      
      // Fetch all return products in one query
      const returnProductsMap = new Map<number, any>();
      for (const produitId of Array.from(returnProductIds)) {
        const product = await storage.getProduct(produitId);
        if (product) {
          returnProductsMap.set(produitId, product);
        }
      }

      // Build email data from items
      for (const item of items) {
        if (item.typeAction === "prendre" && item.product) {
          validationData.items.prendre!.push({
            nom: item.product.nom,
            quantite: item.quantite,
            unite: item.product.unite,
            type: item.typeMouvement || 'pret',
          });
        } else if (item.typeAction === "rendre" && item.movement?.produitId) {
          // For returns, get product from pre-fetched map
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
          // Use the actual deposited product (could be variant) instead of the template
          const targetProduct = deposerProductMap.get(item.id);
          if (targetProduct) {
            validationData.items.deposer!.push({
              nom: targetProduct.nom,
              quantite: item.quantite,
              unite: targetProduct.unite,
            });
          }
        }
      }

      const emailHtml = createValidationPanierEmail(validationData);
      
      // Déterminer les destinataires selon l'utilisateur
      // Papa (5), Cheikh (3), Fatou (4) → Marine + Michael + Fatou
      // Marine (1), Michael (2) → Marine + Michael uniquement
      const recipients = ['marine@filtreplante.com', 'michael@filtreplante.com'];
      if (userId === 3 || userId === 4 || userId === 5) {
        recipients.push('fatou@filtreplante.com');
      }
      
      await sendEmail(storage, {
        type: 'validation_panier',
        to: recipients,
        subject: `[STOCK] Session de ${validationData.userName} - ${validationData.date}`,
        html: emailHtml,
      });

      res.json({ success: true, results });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
