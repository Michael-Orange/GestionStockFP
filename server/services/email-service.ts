import { Resend } from 'resend';
import type { DatabaseStorage } from '../storage';
import type { InsertEmailLog } from '@/shared/schema';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  
  return {
    apiKey: connectionSettings.settings.api_key,
    fromEmail: connectionSettings.settings.from_email
  };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export interface SendEmailOptions {
  type: 'validation_panier' | 'nouveau_produit' | 'rappel_retard';
  to: string[]; // Array of emails
  subject: string;
  html: string;
  metadata?: Record<string, any>;
}

/**
 * Envoie un email via Resend et log le résultat dans la base de données
 */
export async function sendEmail(storage: DatabaseStorage, options: SendEmailOptions): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    // Envoyer l'email via Resend
    const result = await client.emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    // Logger le succès
    await storage.createEmailLog({
      type: options.type,
      destinataires: options.to,
      sujet: options.subject,
      statutEnvoi: 'success',
      erreur: null,
      metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    });

    console.log(`✅ Email envoyé avec succès: ${options.subject}`, result);
    return true;

  } catch (error: any) {
    // Logger l'erreur
    await storage.createEmailLog({
      type: options.type,
      destinataires: options.to,
      sujet: options.subject,
      statutEnvoi: 'error',
      erreur: error.message || 'Unknown error',
      metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    });

    console.error(`❌ Erreur envoi email: ${options.subject}`, error);
    
    // Ne pas throw l'erreur pour ne pas bloquer le flux principal
    // L'email est optionnel, l'application continue de fonctionner
    return false;
  }
}
