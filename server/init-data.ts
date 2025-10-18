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
      
      // Hash password for admins: "Fplante@Stock1!"
      const adminPasswordHash = await bcrypt.hash("Fplante@Stock1!", 10);
      
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
      
      // Mise à jour des mots de passe admin si nécessaire
      const adminPasswordHash = await bcrypt.hash("Fplante@Stock1!", 10);
      for (const user of existingUsers) {
        if (user.role === "admin" && !user.passwordHash) {
          await storage.updateUserPassword(user.id, adminPasswordHash);
          console.log(`🔒 Mot de passe ajouté pour ${user.nom}`);
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
          stockActuel: Math.floor(Math.random() * 10) + 1, // Random initial stock 1-10
          stockMinimum: Math.floor(Math.random() * 3) + 1, // Random min stock 1-3
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

  // 3. Create sample movements for demo
  try {
    const allMovements = await storage.getAllMovements();
    
    if (allMovements.length === 0) {
      console.log("🔄 Creating sample movements...");
      const products = await storage.getAllProducts();
      
      if (products.length >= 3) {
        // Create 3 sample loans
        const marteau = products.find(p => p.nom === "MARTEAU");
        const pelle = products.find(p => p.nom === "PELLE");
        const scie = products.find(p => p.nom === "SCIE A BOIS");

        if (marteau) {
          // Loan from 5 days ago (recent)
          const date5DaysAgo = new Date();
          date5DaysAgo.setDate(date5DaysAgo.getDate() - 5);
          
          await storage.createMovement({
            utilisateurId: 1, // Marine
            produitId: marteau.id,
            quantite: 1,
            type: "pret",
            statut: "en_cours",
            dateRetourPrevu: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
          });
        }

        if (pelle) {
          // Loan from 10 days ago (attention)
          const date10DaysAgo = new Date();
          date10DaysAgo.setDate(date10DaysAgo.getDate() - 10);
          
          await storage.createMovement({
            utilisateurId: 4, // Cheikh
            produitId: pelle.id,
            quantite: 2,
            type: "pret",
            statut: "en_cours",
            dateRetourPrevu: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
          });
        }

        if (scie) {
          // Loan from 20 days ago (retard!)
          const date20DaysAgo = new Date();
          date20DaysAgo.setDate(date20DaysAgo.getDate() - 20);
          
          await storage.createMovement({
            utilisateurId: 2, // Fatou
            produitId: scie.id,
            quantite: 1,
            type: "pret",
            statut: "en_cours",
            dateRetourPrevu: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (overdue)
          });

          // Create alert for late return
          await storage.createAlert({
            type: "retard_emprunt",
            mouvementId: 3,
            produitId: scie.id,
            utilisateurCibleId: 1, // Alert for Marine (stock manager)
            message: `Fatou n'a pas encore rendu: ${scie.nom} (en retard de 5 jours)`,
            lue: 0,
          });
        }

        console.log("✅ Sample movements created: 3");
      }
    } else {
      console.log(`✅ Movements already exist: ${allMovements.length}`);
    }
  } catch (error) {
    console.error("❌ Error creating sample movements:", error);
  }

  console.log("🎉 Initialization complete!");
}
