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
      background: linear-gradient(135deg, #157a70 0%, #2997aa 100%);
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
      background: #edf8f7;
      padding: 30px 20px;
      border-left: 3px solid #157a70;
      border-right: 3px solid #157a70;
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
      color: #157a70;
      border-bottom: 2px solid #157a70;
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
      background: #c7e7e3;
      color: #0d5249;
    }
    .badge-blue {
      background: #d4ebf3;
      color: #145a74;
    }
    .badge-orange {
      background: #fed7aa;
      color: #9a3412;
    }
    .badge-red {
      background: #fecaca;
      color: #991b1b;
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
    .button-link {
      display: inline-block;
      background: #157a70;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 15px 0 10px 0;
      transition: background 0.2s;
    }
    .button-link:hover {
      background: #0f5850;
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
    perdu?: Array<{ nom: string; quantite: number; unite: string }>;
  };
}

/**
 * Template: Email validation panier
 */
export function createValidationPanierEmail(data: ValidationPanierData): string {
  const { userName, date, items } = data;
  
  let sectionsHtml = '';
  
  // Section EMPRUNTÉ (type pret)
  if (items.prendre && items.prendre.length > 0) {
    const itemsPret = items.prendre.filter(item => item.type === 'pret');
    if (itemsPret.length > 0) {
      const itemsHtml = itemsPret.map(item => `
        <div class="item">
          <div class="item-name">
            ${item.nom}
            <span class="badge badge-blue">PRÊT</span>
          </div>
          <div class="item-details">${item.quantite} ${item.unite}</div>
        </div>
      `).join('');
      
      sectionsHtml += `
        <div class="section">
          <div class="section-title">📦 EMPRUNTÉ DU STOCK (${itemsPret.length})</div>
          ${itemsHtml}
        </div>
      `;
    }
    
    // Section PRÉLEVÉ (type consommation)
    const itemsConsommation = items.prendre.filter(item => item.type === 'consommation');
    if (itemsConsommation.length > 0) {
      const itemsHtml = itemsConsommation.map(item => `
        <div class="item">
          <div class="item-name">
            ${item.nom}
            <span class="badge badge-green">CONSOMMATION</span>
          </div>
          <div class="item-details">${item.quantite} ${item.unite}</div>
        </div>
      `).join('');
      
      sectionsHtml += `
        <div class="section">
          <div class="section-title">📦 PRÉLEVÉ DU STOCK (${itemsConsommation.length})</div>
          ${itemsHtml}
        </div>
      `;
    }
  }
  
  // Section REMIS EN STOCK
  if (items.rendre && items.rendre.length > 0) {
    const itemsHtml = items.rendre.map(item => `
      <div class="item">
        <div class="item-name">${item.nom}</div>
        <div class="item-details">${item.quantite} ${item.unite}</div>
      </div>
    `).join('');
    
    sectionsHtml += `
      <div class="section">
        <div class="section-title">🔄 REMIS EN STOCK ✅ (${items.rendre.length})</div>
        ${itemsHtml}
      </div>
    `;
  }
  
  // Section DÉPOSÉ EN STOCK
  if (items.deposer && items.deposer.length > 0) {
    const itemsHtml = items.deposer.map(item => `
      <div class="item">
        <div class="item-name">${item.nom}</div>
        <div class="item-details">+${item.quantite} ${item.unite}</div>
      </div>
    `).join('');
    
    sectionsHtml += `
      <div class="section">
        <div class="section-title">📥 DÉPOSÉ EN STOCK ✅ (${items.deposer.length})</div>
        ${itemsHtml}
      </div>
    `;
  }
  
  // Section MATÉRIEL PERDU
  if (items.perdu && items.perdu.length > 0) {
    const itemsHtml = items.perdu.map(item => `
      <div class="item">
        <div class="item-name">
          ${item.nom}
          <span class="badge badge-red">PERDU</span>
        </div>
        <div class="item-details" style="color: #991b1b; font-weight: 600;">-${item.quantite} ${item.unite}</div>
      </div>
    `).join('');
    
    sectionsHtml += `
      <div class="section" style="border-left: 3px solid #991b1b;">
        <div class="section-title" style="color: #991b1b; border-bottom-color: #991b1b;">⚠️ MATÉRIEL PERDU (${items.perdu.length})</div>
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
        <p style="margin-bottom: 0; color: #157a70; font-weight: 600;">✅ Mise à jour du stock automatique confirmée</p>
      </div>
      <div class="footer">
        <strong>FiltrePlante</strong> - Gestion de Stock<br>
        <a href="https://stock-filtreplante.replit.app" class="button-link">Accéder à l'application</a><br>
        <span style="font-size: 12px;">Cet email est généré automatiquement, ne pas répondre</span>
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
        <a href="https://stock-filtreplante.replit.app" class="button-link">Accéder à l'application</a><br>
        <span style="font-size: 12px;">Cet email est généré automatiquement, ne pas répondre</span>
      </div>
    </body>
    </html>
  `;
}

export interface ValidationProduitData {
  productName: string;
  category: string;
  subSection: string;
  validatedBy: string;
  date: string;
}

/**
 * Template: Email validation produit
 */
export function createValidationProduitEmail(data: ValidationProduitData): string {
  const { productName, category, subSection, validatedBy, date } = data;
  
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
        <h1>✅ Produit Validé</h1>
        <p style="margin: 5px 0 0 0;">${date}</p>
      </div>
      <div class="content">
        <p style="margin-top: 0;">Un nouveau produit a été validé et ajouté au stock:</p>
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
            <div class="item-name">Validé par</div>
            <div class="item-details">${validatedBy}</div>
          </div>
        </div>
        <p style="color: #157a70; font-weight: 600;">✅ Le produit est maintenant disponible dans l'application</p>
      </div>
      <div class="footer">
        <strong>FiltrePlante</strong> - Gestion de Stock<br>
        <a href="https://stock-filtreplante.replit.app" class="button-link">Accéder à l'application</a><br>
        <span style="font-size: 12px;">Cet email est généré automatiquement, ne pas répondre</span>
      </div>
    </body>
    </html>
  `;
}

