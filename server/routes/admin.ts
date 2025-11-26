import { Router, Request, Response, NextFunction } from "express";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import bcrypt from "bcrypt";
import { storage } from "../storage";
import { logger } from "../middleware/logger";

const router = Router();

const adminAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { adminUserId, adminPassword } = req.body;
    
    if (!adminUserId || !adminPassword) {
      return res.status(401).json({ error: "Authentification admin requise" });
    }
    
    const admin = await storage.getUser(adminUserId);
    
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });
    }
    
    if (!admin.passwordHash) {
      return res.status(500).json({ error: "Mot de passe admin non configuré" });
    }
    
    const isValid = await bcrypt.compare(adminPassword, admin.passwordHash);
    
    if (!isValid) {
      logger.warn(`Tentative d'accès admin échouée pour userId ${adminUserId}`);
      return res.status(401).json({ error: "Mot de passe incorrect" });
    }
    
    logger.info(`Admin ${admin.nom} authentifié pour action admin`);
    next();
  } catch (error) {
    next(error);
  }
};

router.post("/import-csv", adminAuth, async (req, res, next) => {
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
        creePar: 3,
      });

      imported++;
    }

    logger.info(`Import CSV: ${imported} importés, ${skipped} ignorés`);
    res.json({ imported, skipped, total: records.length });
  } catch (error) {
    next(error);
  }
});

router.post("/init-users", adminAuth, async (req, res, next) => {
  try {
    const existingUsers = await storage.getAllUsers();
    
    if (existingUsers.length === 0) {
      const defaultUsers = [
        { nom: "Marine", email: "marine@filtreplante.com", role: "admin" },
        { nom: "Fatou", email: "fatou@filtreplante.com", role: "utilisateur" },
        { nom: "Michael", email: "michael@filtreplante.com", role: "admin" },
        { nom: "Cheikh", email: "cheikh@filtreplante.com", role: "utilisateur" },
        { nom: "Papa", email: "papa@filtreplante.com", role: "utilisateur" },
      ];

      for (const user of defaultUsers) {
        await storage.createUser(user);
      }

      logger.info("5 utilisateurs par défaut créés");
      res.json({ message: "Utilisateurs initialisés", count: 5 });
    } else {
      res.json({ message: "Utilisateurs déjà initialisés", count: existingUsers.length });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
