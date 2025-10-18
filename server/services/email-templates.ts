/**
 * Templates HTML pour les emails
 * Design responsive mobile/desktop
 */

// Styles CSS communs pour tous les emails
const baseStyles = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      background: #f9fafb;
      padding: 30px 20px;
      border-left: 3px solid #22c55e;
      border-right: 3px solid #22c55e;
    }
    .section {
      background: white;
      padding: 20px;
      margin: 15px 0;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #22c55e;
      border-bottom: 2px solid #22c55e;
      padding-bottom: 8px;
    }
    .item {
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .item:last-child {
      border-bottom: none;
    }
    .item-name {
      font-weight: 600;
      color: #111827;
    }
    .item-details {
      color: #6b7280;
      font-size: 14px;
      margin-top: 4px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }
    .badge-green {
      background: #d1fae5;
      color: #065f46;
    }
    .badge-blue {
      background: #dbeafe;
      color: #1e40af;
    }
    .badge-orange {
      background: #fed7aa;
      color: #9a3412;
    }
    .footer {
      background: #1f2937;
      color: #9ca3af;
      padding: 20px;
      text-align: center;
      font-size: 14px;
      border-radius: 0 0 8px 8px;
    }
    .footer strong {
      color: white;
    }
    @media only screen and (max-width: 600px) {
      body {
        padding: 10px;
      }
      .header h1 {
        font-size: 20px;
      }
      .content {
        padding: 20px 15px;
      }
      .section {
        padding: 15px;
      }
    }
  </style>
`;

export interface ValidationPanierData {
  userName: string;
  date: string;
  items: {
    prendre?: Array<{ nom: string; quantite: number; unite: string; type: string }>;
    rendre?: Array<{ nom: string; quantite: number; unite: string }>;
    deposer?: Array<{ nom: string; quantite: number; unite: string }>;
  };
}

/**
 * Template: Email validation panier
 */
export function createValidationPanierEmail(data: ValidationPanierData): string {
  const { userName, date, items } = data;
  
  let sectionsHtml = '';
  
  // Section PRENDRE
  if (items.prendre && items.prendre.length > 0) {
    const itemsHtml = items.prendre.map(item => `
      <div class="item">
        <div class="item-name">
          ${item.nom}
          <span class="badge ${item.type === 'pret' ? 'badge-blue' : 'badge-green'}">${item.type.toUpperCase()}</span>
        </div>
        <div class="item-details">${item.quantite} ${item.unite}</div>
      </div>
    `).join('');
    
    sectionsHtml += `
      <div class="section">
        <div class="section-title">📦 À PRENDRE (${items.prendre.length})</div>
        ${itemsHtml}
      </div>
    `;
  }
  
  // Section RENDRE
  if (items.rendre && items.rendre.length > 0) {
    const itemsHtml = items.rendre.map(item => `
      <div class="item">
        <div class="item-name">${item.nom}</div>
        <div class="item-details">${item.quantite} ${item.unite}</div>
      </div>
    `).join('');
    
    sectionsHtml += `
      <div class="section">
        <div class="section-title">🔄 À RENDRE (${items.rendre.length})</div>
        ${itemsHtml}
      </div>
    `;
  }
  
  // Section DÉPOSER
  if (items.deposer && items.deposer.length > 0) {
    const itemsHtml = items.deposer.map(item => `
      <div class="item">
        <div class="item-name">${item.nom}</div>
        <div class="item-details">+${item.quantite} ${item.unite}</div>
      </div>
    `).join('');
    
    sectionsHtml += `
      <div class="section">
        <div class="section-title">📥 À DÉPOSER (${items.deposer.length})</div>
        ${itemsHtml}
      </div>
    `;
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${baseStyles}
    </head>
    <body>
      <div class="header">
        <h1>📋 Session de ${userName}</h1>
        <p style="margin: 5px 0 0 0;">${date}</p>
      </div>
      <div class="content">
        <p style="margin-top: 0;">Récapitulatif de la session de stock validée:</p>
        ${sectionsHtml}
        <p style="margin-bottom: 0; color: #059669; font-weight: 600;">✅ Mise à jour du stock automatique confirmée</p>
      </div>
      <div class="footer">
        <strong>FiltrePlante</strong> - Gestion de Stock<br>
        Cet email est généré automatiquement, ne pas répondre
      </div>
    </body>
    </html>
  `;
}

export interface NouveauProduitData {
  productName: string;
  category: string;
  subSection: string;
  createdBy: string;
  date: string;
}

/**
 * Template: Email nouveau produit en attente
 */
export function createNouveauProduitEmail(data: NouveauProduitData): string {
  const { productName, category, subSection, createdBy, date } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${baseStyles}
    </head>
    <body>
      <div class="header">
        <h1>🔔 Nouveau Produit en Attente</h1>
        <p style="margin: 5px 0 0 0;">${date}</p>
      </div>
      <div class="content">
        <p style="margin-top: 0;">Un nouveau produit a été créé et attend validation:</p>
        <div class="section">
          <div class="item">
            <div class="item-name">Nom du produit</div>
            <div class="item-details">${productName}</div>
          </div>
          <div class="item">
            <div class="item-name">Catégorie</div>
            <div class="item-details">${category} › ${subSection}</div>
          </div>
          <div class="item">
            <div class="item-name">Créé par</div>
            <div class="item-details">${createdBy}</div>
          </div>
        </div>
        <p style="color: #dc2626; font-weight: 600;">⚠️ Action nécessaire: Validation requise dans l'interface admin</p>
      </div>
      <div class="footer">
        <strong>FiltrePlante</strong> - Gestion de Stock<br>
        Cet email est généré automatiquement, ne pas répondre
      </div>
    </body>
    </html>
  `;
}

