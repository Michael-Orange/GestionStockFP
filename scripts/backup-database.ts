import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const BACKUPS_DIR = path.join(process.cwd(), "backups");

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

async function main() {
  console.log("🔄 Démarrage du backup de la base de données...\n");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ Erreur: La variable DATABASE_URL n'est pas définie.");
    process.exit(1);
  }

  if (!fs.existsSync(BACKUPS_DIR)) {
    console.log("📁 Création du dossier /backups...");
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const timestamp = getTimestamp();
  const filename = `backup_gestionstock_${timestamp}.sql`;
  const filepath = path.join(BACKUPS_DIR, filename);

  try {
    console.log("📊 Extraction des données...");
    console.log("   Tables: users, products, movements, alerts, listes, liste_items, email_logs\n");

    const pgDumpOutput = execSync(
      `pg_dump "${databaseUrl}" --no-owner --no-acl --clean --if-exists`,
      {
        encoding: "utf-8",
        maxBuffer: 100 * 1024 * 1024,
      }
    );

    const header = `-- =====================================================
-- BACKUP GESTION STOCK FILTREPLANTE
-- Date: ${new Date().toISOString()}
-- Fichier: ${filename}
-- =====================================================
-- Ce fichier contient un dump complet de la base de données
-- incluant la structure des tables et toutes les données.
-- Pour restaurer: psql DATABASE_URL < ${filename}
-- =====================================================

`;

    fs.writeFileSync(filepath, header + pgDumpOutput, "utf-8");

    if (!fs.existsSync(filepath)) {
      throw new Error("Le fichier de backup n'a pas été créé.");
    }

    const stats = fs.statSync(filepath);
    const fileSize = formatBytes(stats.size);
    const lineCount = pgDumpOutput.split("\n").length;

    const tableMatches = pgDumpOutput.match(/CREATE TABLE/g);
    const tableCount = tableMatches ? tableMatches.length : 0;

    const insertMatches = pgDumpOutput.match(/INSERT INTO/g);
    const insertCount = insertMatches ? insertMatches.length : 0;

    console.log("═══════════════════════════════════════════════════════");
    console.log("✅ BACKUP CRÉÉ AVEC SUCCÈS");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`📄 Fichier    : ${filepath}`);
    console.log(`📏 Taille     : ${fileSize}`);
    console.log(`📝 Lignes     : ${lineCount.toLocaleString()}`);
    console.log(`🗃️  Tables     : ${tableCount}`);
    console.log(`📥 Insertions : ${insertCount.toLocaleString()}`);
    console.log("═══════════════════════════════════════════════════════");
    console.log(`\n✅ Backup créé : ${filepath} (${fileSize})\n`);

  } catch (error: any) {
    console.error("═══════════════════════════════════════════════════════");
    console.error("❌ ERREUR LORS DU BACKUP");
    console.error("═══════════════════════════════════════════════════════");
    
    if (error.message?.includes("connection")) {
      console.error("Cause: Impossible de se connecter à la base de données.");
      console.error("Vérifiez que DATABASE_URL est correcte et que la DB est accessible.");
    } else if (error.message?.includes("ENOSPC")) {
      console.error("Cause: Espace disque insuffisant.");
      console.error("Libérez de l'espace et réessayez.");
    } else {
      console.error(`Détails: ${error.message || error}`);
    }
    
    console.error("═══════════════════════════════════════════════════════");
    process.exit(1);
  }
}

main();
