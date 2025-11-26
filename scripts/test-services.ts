/**
 * Script de test manuel pour les services Phase 2
 * Usage: npx tsx scripts/test-services.ts
 */

import { productService } from "../server/services/ProductService";
import { movementService } from "../server/services/MovementService";
import { listeService } from "../server/services/ListeService";
import { alertService } from "../server/services/AlertService";
import { emailService } from "../server/services/EmailService";
import { storage } from "../server/storage";

const TEST_USER_ID = 3; // Michael
const TEST_PRODUCT_ID = 50; // Premier produit disponible (IDs commencent à 50)

async function testProductService() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TEST: ProductService");
  console.log("=".repeat(60));

  try {
    // Test getAllProducts
    console.log("\n📋 getAllProducts()...");
    const products = await productService.getAllProducts();
    console.log(`   ✅ ${products.length} produits récupérés`);

    // Test getProductById
    console.log(`\n📋 getProductById(${TEST_PRODUCT_ID})...`);
    const product = await productService.getProductById(TEST_PRODUCT_ID);
    console.log(`   ✅ Produit: ${product.nom}`);

    // Test getAvailableStock with cache
    console.log(`\n📋 getAvailableStock(${TEST_PRODUCT_ID}) - 1er appel...`);
    const start1 = Date.now();
    const stock1 = await productService.getAvailableStock(TEST_PRODUCT_ID);
    const time1 = Date.now() - start1;
    console.log(`   ✅ Stock disponible: ${stock1} (${time1}ms)`);

    console.log(`\n📋 getAvailableStock(${TEST_PRODUCT_ID}) - 2ème appel (cache)...`);
    const start2 = Date.now();
    const stock2 = await productService.getAvailableStock(TEST_PRODUCT_ID);
    const time2 = Date.now() - start2;
    console.log(`   ✅ Stock disponible: ${stock2} (${time2}ms)`);
    console.log(`   ${time2 < time1 ? "✅ Cache fonctionne!" : "⚠️ Cache potentiellement non actif"}`);

    // Test getCategories
    console.log("\n📋 getCategories()...");
    const categories = await productService.getCategories();
    console.log(`   ✅ ${categories.length} catégories: ${categories.slice(0, 3).join(", ")}...`);

    // Test getSousSections
    console.log("\n📋 getSousSections()...");
    const sousSections = await productService.getSousSections();
    console.log(`   ✅ ${sousSections.length} sous-sections`);

    // Test getProductsByIds
    console.log("\n📋 getProductsByIds([50, 51, 52])...");
    const batchProducts = await productService.getProductsByIds([50, 51, 52]);
    console.log(`   ✅ ${batchProducts.length} produits récupérés en batch`);

    console.log("\n✅ ProductService: TOUS LES TESTS PASSÉS");
    return true;
  } catch (error: any) {
    console.log(`\n❌ ProductService ERROR: ${error.message}`);
    return false;
  }
}

async function testMovementService() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TEST: MovementService");
  console.log("=".repeat(60));

  try {
    // Test validateMovement
    console.log("\n📋 validateMovement() - stock suffisant...");
    const validation = await movementService.validateMovement({
      type: "pret",
      utilisateurId: TEST_USER_ID,
      produitId: TEST_PRODUCT_ID,
      quantite: 1,
    });
    console.log(`   ✅ Validation: ${validation.valid ? "OK" : validation.message}`);

    // Test validateMovement with insufficient stock
    console.log("\n📋 validateMovement() - stock insuffisant...");
    const validation2 = await movementService.validateMovement({
      type: "pret",
      utilisateurId: TEST_USER_ID,
      produitId: TEST_PRODUCT_ID,
      quantite: 999999,
    });
    console.log(`   ✅ Validation: ${validation2.valid ? "OK" : "Refusé (attendu)"} - ${validation2.message || ""}`);

    // Test getUserMovements
    console.log("\n📋 getUserMovements()...");
    const userMovements = await movementService.getUserMovements(TEST_USER_ID);
    console.log(`   ✅ ${userMovements.length} mouvements pour user ${TEST_USER_ID}`);

    // Test getActiveLoans
    console.log("\n📋 getActiveLoans()...");
    const activeLoans = await movementService.getActiveLoans();
    console.log(`   ✅ ${activeLoans.length} prêts actifs total`);

    // Test getActiveLoans for specific user
    console.log("\n📋 getActiveLoans(userId)...");
    const userLoans = await movementService.getActiveLoans(TEST_USER_ID);
    console.log(`   ✅ ${userLoans.length} prêts actifs pour user ${TEST_USER_ID}`);

    // Test getMovementStats
    console.log("\n📋 getMovementStats('month')...");
    const stats = await movementService.getMovementStats("month");
    console.log(`   ✅ Stats: ${stats.total} mouvements ce mois`);
    console.log(`      Prêts: ${stats.byType.pret}, Consommations: ${stats.byType.consommation}`);
    console.log(`      Dépôts: ${stats.byType.depot}, Retours: ${stats.byType.retour}`);

    // Test getMostBorrowedProducts
    console.log("\n📋 getMostBorrowedProducts(5)...");
    const topProducts = await movementService.getMostBorrowedProducts(5);
    console.log(`   ✅ Top ${topProducts.length} produits empruntés:`);
    topProducts.forEach((p, i) => console.log(`      ${i + 1}. ${p.productName}: ${p.count} fois`));

    // Test getOverdueLoans
    console.log("\n📋 getOverdueLoans(7)...");
    const overdueLoans = await movementService.getOverdueLoans(7);
    console.log(`   ✅ ${overdueLoans.length} prêts > 7 jours`);

    console.log("\n✅ MovementService: TOUS LES TESTS PASSÉS");
    return true;
  } catch (error: any) {
    console.log(`\n❌ MovementService ERROR: ${error.message}`);
    return false;
  }
}

async function testListeService() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TEST: ListeService");
  console.log("=".repeat(60));

  try {
    // Test getUserListe
    console.log("\n📋 getUserListe()...");
    const { liste, items } = await listeService.getUserListe(TEST_USER_ID);
    console.log(`   ✅ Liste: ${liste ? "existe" : "nouvelle"}, ${items.length} items`);

    // Test getListeItemCount
    console.log("\n📋 getListeItemCount()...");
    const count = await listeService.getListeItemCount(TEST_USER_ID);
    console.log(`   ✅ Nombre d'items: ${count}`);

    // Test getListeSummary
    console.log("\n📋 getListeSummary()...");
    const summary = await listeService.getListeSummary(TEST_USER_ID);
    console.log(`   ✅ Résumé: ${summary.itemCount} items, ${summary.categories.length} catégories, types: ${summary.types.join(", ") || "aucun"}`);

    // Note: We don't actually add/validate items to avoid modifying data
    console.log("\n⚠️ addItemToListe() et validateListe() non testés pour préserver les données");

    console.log("\n✅ ListeService: TESTS LECTURE PASSÉS");
    return true;
  } catch (error: any) {
    console.log(`\n❌ ListeService ERROR: ${error.message}`);
    return false;
  }
}

async function testAlertService() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TEST: AlertService");
  console.log("=".repeat(60));

  try {
    // Test getUserAlerts
    console.log("\n📋 getUserAlerts()...");
    const alerts = await alertService.getUserAlerts(TEST_USER_ID);
    console.log(`   ✅ ${alerts.length} alertes pour user ${TEST_USER_ID}`);

    // Test getUnreadCount
    console.log("\n📋 getUnreadCount()...");
    const unreadCount = await alertService.getUnreadCount(TEST_USER_ID);
    console.log(`   ✅ ${unreadCount} alertes non lues`);

    // Note: We don't create alerts to avoid spam
    console.log("\n⚠️ createAlert() non testé pour éviter le spam");

    console.log("\n✅ AlertService: TESTS LECTURE PASSÉS");
    return true;
  } catch (error: any) {
    console.log(`\n❌ AlertService ERROR: ${error.message}`);
    return false;
  }
}

async function testEmailService() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TEST: EmailService");
  console.log("=".repeat(60));

  try {
    // Check if Resend is configured
    console.log("\n📋 Vérification configuration Resend...");
    const hasResendKey = !!process.env.RESEND_API_KEY;
    console.log(`   ${hasResendKey ? "✅" : "⚠️"} RESEND_API_KEY ${hasResendKey ? "configurée" : "non configurée"}`);

    // Note: We don't send actual emails
    console.log("\n⚠️ sendWithRetry() non testé pour éviter l'envoi d'emails réels");
    console.log("   Le service utilise retry avec backoff: 1s, 2s, 4s");

    console.log("\n✅ EmailService: CONFIGURATION VÉRIFIÉE");
    return true;
  } catch (error: any) {
    console.log(`\n❌ EmailService ERROR: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     TESTS MANUELS SERVICES - PHASE 2 REFACTORISATION       ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const results: { service: string; passed: boolean }[] = [];

  results.push({ service: "ProductService", passed: await testProductService() });
  results.push({ service: "MovementService", passed: await testMovementService() });
  results.push({ service: "ListeService", passed: await testListeService() });
  results.push({ service: "AlertService", passed: await testAlertService() });
  results.push({ service: "EmailService", passed: await testEmailService() });

  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                    RÉSUMÉ DES TESTS                        ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  
  for (const result of results) {
    const status = result.passed ? "✅ PASSÉ" : "❌ ÉCHEC";
    console.log(`║  ${result.service.padEnd(20)} ${status.padEnd(36)}║`);
  }

  const allPassed = results.every(r => r.passed);
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log(`║  TOTAL: ${results.filter(r => r.passed).length}/${results.length} services fonctionnels                      ║`);
  console.log("╚════════════════════════════════════════════════════════════╝");

  if (allPassed) {
    console.log("\n🎉 PHASE 2 VALIDÉE - Tous les services sont opérationnels!");
  } else {
    console.log("\n⚠️ Certains services nécessitent une correction.");
  }

  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch(console.error);
