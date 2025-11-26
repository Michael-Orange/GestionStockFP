import { storage } from "../storage";
import { logger } from "../middleware/logger";
import type { Alert, InsertAlert } from "@shared/schema";

interface CreateAlertData {
  type: "nouveau_produit" | "retour_attendu" | "stock_bas" | "validation_produit";
  utilisateurCibleId: number;
  produitId?: number;
  mouvementId?: number;
  message: string;
}

interface AlertFilters {
  unreadOnly?: boolean;
}

class AlertService {
  async createAlert(data: CreateAlertData): Promise<Alert> {
    const alertData: InsertAlert = {
      type: data.type,
      utilisateurCibleId: data.utilisateurCibleId,
      produitId: data.produitId ?? null,
      mouvementId: data.mouvementId ?? null,
      message: data.message,
      lue: 0,
    };

    const alert = await storage.createAlert(alertData);
    logger.info(`Alerte créée: ${alert.id} - ${data.type} pour user ${data.utilisateurCibleId}`);
    return alert;
  }

  async getUserAlerts(userId: number, filters?: AlertFilters): Promise<Alert[]> {
    if (filters?.unreadOnly) {
      const unreadAlerts = await storage.getUnreadAlerts(userId);
      return unreadAlerts.sort((a, b) => 
        new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime()
      );
    }
    
    const allAlerts = await storage.getUserAlerts(userId);
    return allAlerts.sort((a, b) => 
      new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime()
    );
  }

  async getUnreadCount(userId: number): Promise<number> {
    const unreadAlerts = await storage.getUnreadAlerts(userId);
    return unreadAlerts.length;
  }

  async markAsRead(alertId: number): Promise<Alert> {
    const alert = await storage.markAlertAsRead(alertId);
    logger.info(`Alerte ${alertId} marquée comme lue`);
    return alert;
  }

  async markAllAsRead(userId: number): Promise<{ count: number }> {
    const unreadAlerts = await storage.getUnreadAlerts(userId);
    
    for (const alert of unreadAlerts) {
      await storage.markAlertAsRead(alert.id);
    }

    logger.info(`${unreadAlerts.length} alertes marquées comme lues pour user ${userId}`);
    return { count: unreadAlerts.length };
  }

  async createStockLowAlert(productId: number, stockLevel: number): Promise<Alert[]> {
    const admins = await storage.getAllUsers();
    const adminUsers = admins.filter(u => u.role === "admin");

    const product = await storage.getProduct(productId);
    if (!product) {
      throw new Error(`Produit introuvable: ${productId}`);
    }

    const alerts: Alert[] = [];
    for (const admin of adminUsers) {
      const alert = await this.createAlert({
        type: "stock_bas",
        utilisateurCibleId: admin.id,
        produitId: productId,
        message: `Stock faible pour "${product.nom}": ${stockLevel} restant(s)`,
      });
      alerts.push(alert);
    }

    logger.info(`Alertes stock bas créées pour produit ${productId} (${adminUsers.length} admins notifiés)`);
    return alerts;
  }

  async createNewProductAlert(productId: number, creatorId: number): Promise<Alert[]> {
    const admins = await storage.getAllUsers();
    const adminUsers = admins.filter(u => u.role === "admin" && u.id !== creatorId);

    const product = await storage.getProduct(productId);
    if (!product) {
      throw new Error(`Produit introuvable: ${productId}`);
    }

    const creator = await storage.getUser(creatorId);
    const creatorName = creator?.nom || "Utilisateur inconnu";

    const alerts: Alert[] = [];
    for (const admin of adminUsers) {
      const alert = await this.createAlert({
        type: "nouveau_produit",
        utilisateurCibleId: admin.id,
        produitId: productId,
        message: `Nouveau produit à valider: "${product.nom}" créé par ${creatorName}`,
      });
      alerts.push(alert);
    }

    logger.info(`Alertes nouveau produit créées pour produit ${productId} (${adminUsers.length} admins notifiés)`);
    return alerts;
  }

  async createReturnReminderAlerts(): Promise<Alert[]> {
    const allMovements = await storage.getAllMovements();
    const overdueLoans = allMovements.filter(m => {
      if (m.type !== "pret" || m.statut !== "en_cours") return false;
      
      const loanDate = new Date(m.date);
      const now = new Date();
      const daysSinceLoan = (now.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24);
      
      return daysSinceLoan > 7;
    });

    const alerts: Alert[] = [];
    
    for (const loan of overdueLoans) {
      const product = await storage.getProduct(loan.produitId);
      const productName = product?.nom || `Produit #${loan.produitId}`;

      const loanDate = new Date(loan.date);
      const daysSinceLoan = Math.floor(
        (new Date().getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const alert = await this.createAlert({
        type: "retour_attendu",
        utilisateurCibleId: loan.utilisateurId,
        mouvementId: loan.id,
        produitId: loan.produitId,
        message: `Rappel: "${productName}" emprunté depuis ${daysSinceLoan} jours`,
      });
      alerts.push(alert);
    }

    logger.info(`${alerts.length} alertes de rappel retour créées`);
    return alerts;
  }

  async createValidationAlert(productId: number, approved: boolean, adminId: number): Promise<Alert | null> {
    const product = await storage.getProduct(productId);
    if (!product || !product.creePar) {
      return null;
    }

    const admin = await storage.getUser(adminId);
    const adminName = admin?.nom || "Admin";

    const alert = await this.createAlert({
      type: "validation_produit",
      utilisateurCibleId: product.creePar,
      produitId: productId,
      message: approved 
        ? `Votre produit "${product.nom}" a été validé par ${adminName}`
        : `Votre produit "${product.nom}" a été refusé par ${adminName}`,
    });

    return alert;
  }
}

export const alertService = new AlertService();
