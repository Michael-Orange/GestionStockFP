// Script to initialize default data: users and CSV import
import { storage } from "./storage";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import bcrypt from "bcrypt";

export async function initializeData() {
  console.log("🚀 Initializing FiltrePlante data...");

  // 1. Initialize users
  try {
    const existingUsers = await storage.getAllUsers();
    
    if (existingUsers.length === 0) {
      console.log("📝 Creating default users...");
      
      // Hash password for admins: "Fp2025"
      const adminPasswordHash = await bcrypt.hash("Fp2025", 10);
      
      const defaultUsers = [
        { nom: "Marine", email: "marine@filtreplante.com", role: "admin", passwordHash: adminPasswordHash },
        { nom: "Fatou", email: "fatou@filtreplante.com", role: "utilisateur", passwordHash: null },
        { nom: "Michael", email: "michael@filtreplante.com", role: "admin", passwordHash: adminPasswordHash },
        { nom: "Cheikh", email: "cheikh@filtreplante.com", role: "utilisateur", passwordHash: null },
        { nom: "Papa", email: "papa@filtreplante.com", role: "utilisateur", passwordHash: null },
      ];

      for (const user of defaultUsers) {
        await storage.createUser(user);
      }
      console.log("✅ Users created: 5 (admins avec mot de passe configuré)");
    } else {
      console.log(`✅ Users already exist: ${existingUsers.length}`);
      
      // Mise à jour des mots de passe admin si nécessaire (changement vers "Fp2025")
      const adminPasswordHash = await bcrypt.hash("Fp2025", 10);
      for (const user of existingUsers) {
        if (user.role === "admin") {
          await storage.updateUserPassword(user.id, adminPasswordHash);
          console.log(`🔒 Mot de passe mis à jour pour ${user.nom}`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error creating users:", error);
  }

  // 2. Import products from CSV
  try {
    const existingProducts = await storage.getAllProducts();
    
    if (existingProducts.length === 0) {
      console.log("📦 Importing products from CSV...");
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
      const seen = new Set<string>();

      for (const record of records) {
        const { Catégorie, "Sous-section": SousSection, Produit, Unité } = record;
        
        if (!Catégorie || !SousSection || !Produit || !Unité) {
          continue;
        }

        // Avoid duplicates in CSV itself
        const key = `${Catégorie}|${SousSection}|${Produit}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        await storage.createProduct({
          categorie: Catégorie,
          sousSection: SousSection,
          nom: Produit,
          unite: Unité,
          stockActuel: 0, // Stock initial à 0
          stockMinimum: 1, // Stock minimum par défaut
          statut: "valide",
          creePar: 3, // Michael (admin)
        });

        imported++;
      }

      console.log(`✅ Products imported: ${imported}`);
    } else {
      console.log(`✅ Products already exist: ${existingProducts.length}`);
    }
  } catch (error) {
    console.error("❌ Error importing CSV:", error);
  }

  // 3. Ne pas créer de mouvements de test (données de production uniquement)
  try {
    const allMovements = await storage.getAllMovements();
    console.log(`✅ Movements already exist: ${allMovements.length}`);
  } catch (error) {
    console.error("❌ Error checking movements:", error);
  }

  console.log("🎉 Initialization complete!");
}
