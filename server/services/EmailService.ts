import { storage } from "../storage";
import { logger } from "../middleware/logger";
import { Resend } from "resend";
import type { Movement, Product, ListeItem, User, InsertEmailLog } from "@shared/schema";

interface EmailData {
  to: string[];
  subject: string;
  html: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface ValidationItem {
  nom: string;
  quantite: number;
  unite: string;
  type?: string;
}

class EmailService {
  private resend: Resend | null = null;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      logger.warn("RESEND_API_KEY non configurée - emails désactivés");
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendWithRetry(emailData: EmailData): Promise<SendResult> {
    if (!this.resend) {
      logger.warn("Resend non configuré - email ignoré");
      return { success: false, error: "Email service not configured" };
    }

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const result = await this.resend.emails.send({
          from: "FiltrePlante <noreply@filtreplante.com>",
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
        });

        if (result.error) {
          throw new Error(result.error.message);
        }

        await this.logEmail({
          type: "validation_panier",
          destinataires: emailData.to,
          sujet: emailData.subject,
          statutEnvoi: "success",
          metadata: JSON.stringify({ messageId: result.data?.id }),
        });

        logger.info(`Email envoyé: ${emailData.subject} → ${emailData.to.join(", ")}`);
        return { success: true, messageId: result.data?.id };

      } catch (error: any) {
        const errorMessage = error?.message || "Unknown error";
        logger.warn(`Email attempt ${attempt + 1}/${this.MAX_RETRIES} failed: ${errorMessage}`);

        if (attempt < this.MAX_RETRIES - 1) {
          await this.sleep(this.RETRY_DELAYS[attempt]);
        } else {
          await this.logEmail({
            type: "validation_panier",
            destinataires: emailData.to,
            sujet: emailData.subject,
            statutEnvoi: "error",
            erreur: errorMessage,
          });

          logger.error(`Email failed after ${this.MAX_RETRIES} attempts: ${errorMessage}`);
          return { success: false, error: errorMessage };
        }
      }
    }

    return { success: false, error: "Max retries exceeded" };
  }

  async logEmail(data: Omit<InsertEmailLog, "dateEnvoi">): Promise<void> {
    try {
      await storage.createEmailLog(data as InsertEmailLog);
    } catch (error) {
      logger.error(`Failed to log email: ${error}`);
    }
  }

  async sendValidationEmail(
    userId: number, 
    items: { prendre: ValidationItem[]; rendre: ValidationItem[]; deposer: ValidationItem[]; perdu: ValidationItem[] }
  ): Promise<SendResult> {
    const user = await storage.getUser(userId);
    if (!user) {
      return { success: false, error: `User not found: ${userId}` };
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const html = this.buildValidationEmailHtml(user.nom, dateStr, items);

    return this.sendWithRetry({
      to: ["team@filtreplante.com"],
      subject: `[STOCK] Session de ${user.nom} - ${dateStr}`,
      html,
    });
  }

  async sendNewProductEmail(productId: number, creatorId: number): Promise<SendResult> {
    const product = await storage.getProduct(productId);
    const creator = await storage.getUser(creatorId);

    if (!product || !creator) {
      return { success: false, error: "Product or creator not found" };
    }

    const html = this.buildNewProductEmailHtml(product, creator.nom);

    return this.sendWithRetry({
      to: ["team@filtreplante.com"],
      subject: `[STOCK] Nouveau produit à valider: ${product.nom}`,
      html,
    });
  }

  async sendReturnReminderEmail(userId: number, loans: Movement[]): Promise<SendResult> {
    const user = await storage.getUser(userId);
    if (!user) {
      return { success: false, error: `User not found: ${userId}` };
    }

    const productIds = loans.map(l => l.produitId);
    const products = await storage.getProductsByIds(productIds);
    const productMap = new Map(products.map(p => [p.id, p]));

    const loanDetails = loans.map(loan => ({
      productName: productMap.get(loan.produitId)?.nom || `Produit #${loan.produitId}`,
      quantite: loan.quantite,
      date: new Date(loan.date).toLocaleDateString("fr-FR"),
    }));

    const html = this.buildReminderEmailHtml(user.nom, loanDetails);

    return this.sendWithRetry({
      to: [user.email],
      subject: `[STOCK] Rappel: matériel à retourner`,
      html,
    });
  }

  async sendStockAlertEmail(product: Product, stockLevel: number): Promise<SendResult> {
    const html = this.buildStockAlertEmailHtml(product, stockLevel);

    return this.sendWithRetry({
      to: ["team@filtreplante.com"],
      subject: `[STOCK] Alerte stock faible: ${product.nom}`,
      html,
    });
  }

  private buildValidationEmailHtml(
    userName: string, 
    dateStr: string,
    items: { prendre: ValidationItem[]; rendre: ValidationItem[]; deposer: ValidationItem[]; perdu: ValidationItem[] }
  ): string {
    const sections: string[] = [];

    if (items.prendre.length > 0) {
      const rows = items.prendre.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.nom}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantite} ${item.unite}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.type === 'pret' ? 'Prêt' : 'Consommation'}</td>
        </tr>
      `).join("");
      sections.push(`
        <h3 style="color: #157a70; margin-top: 20px;">📦 Prises</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #edf8f7;">
              <th style="padding: 8px; text-align: left;">Produit</th>
              <th style="padding: 8px; text-align: center;">Quantité</th>
              <th style="padding: 8px; text-align: center;">Type</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `);
    }

    if (items.rendre.length > 0) {
      const rows = items.rendre.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.nom}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantite} ${item.unite}</td>
        </tr>
      `).join("");
      sections.push(`
        <h3 style="color: #2997aa; margin-top: 20px;">↩️ Retours</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #edf8f7;">
              <th style="padding: 8px; text-align: left;">Produit</th>
              <th style="padding: 8px; text-align: center;">Quantité</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `);
    }

    if (items.deposer.length > 0) {
      const rows = items.deposer.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.nom}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">+${item.quantite} ${item.unite}</td>
        </tr>
      `).join("");
      sections.push(`
        <h3 style="color: #22c55e; margin-top: 20px;">📥 Dépôts</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #edf8f7;">
              <th style="padding: 8px; text-align: left;">Produit</th>
              <th style="padding: 8px; text-align: center;">Quantité</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `);
    }

    if (items.perdu.length > 0) {
      const rows = items.perdu.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.nom}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center; color: #dc2626;">-${item.quantite} ${item.unite}</td>
        </tr>
      `).join("");
      sections.push(`
        <h3 style="color: #dc2626; margin-top: 20px;">⚠️ Perdu</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #fef2f2;">
              <th style="padding: 8px; text-align: left;">Produit</th>
              <th style="padding: 8px; text-align: center;">Quantité</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `);
    }

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #157a70; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">FiltrePlante - Stock</h1>
        </div>
        <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <p><strong>Utilisateur:</strong> ${userName}</p>
          <p><strong>Date:</strong> ${dateStr}</p>
          ${sections.join("")}
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Ce message a été envoyé automatiquement par l'application FiltrePlante Stock.
        </p>
      </body>
      </html>
    `;
  }

  private buildNewProductEmailHtml(product: Product, creatorName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">Nouveau produit à valider</h1>
        </div>
        <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <p><strong>Créé par:</strong> ${creatorName}</p>
          <table style="width: 100%; margin-top: 16px;">
            <tr><td style="padding: 4px 0;"><strong>Nom:</strong></td><td>${product.nom}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Catégorie:</strong></td><td>${product.categorie}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Sous-section:</strong></td><td>${product.sousSection}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Unité:</strong></td><td>${product.unite}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Stock initial:</strong></td><td>${product.stockActuel}</td></tr>
          </table>
          <p style="margin-top: 20px;">
            <a href="https://stock-filtreplante.replit.app/admin" 
               style="display: inline-block; background: #157a70; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Valider le produit
            </a>
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private buildReminderEmailHtml(userName: string, loans: { productName: string; quantite: number; date: string }[]): string {
    const rows = loans.map(loan => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${loan.productName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${loan.quantite}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${loan.date}</td>
      </tr>
    `).join("");

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #2997aa; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">Rappel: matériel à retourner</h1>
        </div>
        <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <p>Bonjour ${userName},</p>
          <p>Vous avez du matériel en prêt depuis plus de 7 jours:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <thead>
              <tr style="background: #edf8f7;">
                <th style="padding: 8px; text-align: left;">Produit</th>
                <th style="padding: 8px; text-align: center;">Quantité</th>
                <th style="padding: 8px; text-align: center;">Date d'emprunt</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top: 20px;">
            Merci de retourner ce matériel dès que possible.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private buildStockAlertEmailHtml(product: Product, stockLevel: number): string {
    const color = stockLevel === 0 ? "#dc2626" : "#f59e0b";
    const title = stockLevel === 0 ? "Stock épuisé" : "Stock faible";

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">${title}</h1>
        </div>
        <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <p><strong>Produit:</strong> ${product.nom}</p>
          <p><strong>Catégorie:</strong> ${product.categorie} → ${product.sousSection}</p>
          <p><strong>Stock restant:</strong> <span style="color: ${color}; font-weight: bold;">${stockLevel} ${product.unite}</span></p>
          <p style="margin-top: 20px;">
            Une action est requise pour réapprovisionner ce produit.
          </p>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
