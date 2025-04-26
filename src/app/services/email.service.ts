import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import emailjs from 'emailjs-com';
import {  firstValueFrom, Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Commande } from '../models/commande';
import { endOfDay, endOfMonth, endOfWeek, endOfYear, isWithinInterval, startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
interface BatchNumberGenerationConfig {
  prefix?: string;
  dateFormat?: string;
  randomDigits?: number;
}
@Injectable({
  providedIn: 'root'
})
export class EmailService {
  downloadInvoicePdf(invoiceNumber: string | undefined) {
    throw new Error('Method not implemented.');
  }
  private emailServiceId = 'service_tx2l5pc';
  private emailTemplateId = 'template_k0yishm';
  private emailUserId = 'LKPl8oSC80IDn7FO2';
  private historiquePath = '/historique-commandes';  // Chemin de stockage des commandes dans Firebase
  http: any;

  constructor(private db: AngularFireDatabase) {}

  /**
   * Envoie un email de confirmation de commande via EmailJS.
   * @param order - La commande à envoyer par email.
   */
  sendEmail(order: any) {
    // Vérification que l'email du fournisseur est présent
    if (!order.supplierEmail) {
      console.error("❌ L'email du fournisseur est manquant !");
      return;
    }

    // Préparation des paramètres d'email
    const emailParams = {
      to_email: order.supplierEmail,
      to_name: order.supplierName,
      order_id: order.id,
      product_id: order.idProduit,
      product_name: order.productName,
      product_volume: order.productVolume, 
      quantity: order.quantity,
      unit_price: `${order.unitPrice} DT`,
      total_ht: `${order.totalHT.toFixed(2)} DT`,
      total_ttc: `${order.totalTTC.toFixed(2)} DT`,
      delivery_date: new Date(order.deliveryDate).toLocaleDateString('fr-FR'),
      order_date: new Date(order.dateCommande).toLocaleDateString('fr-FR'),
      company_name: 'QStocker',
      batch_number: order.batchNumber || 'N/A', 
    };
    
    emailjs.send(this.emailServiceId, this.emailTemplateId, emailParams, this.emailUserId)
      .then(() => {
        console.log("✅ Email envoyé avec succès !");
      })
      .catch(error => {
        console.error("❌ Erreur lors de l'envoi de l'email :", error);
      });
    

    // Envoi de l'email via EmailJS
    emailjs.send(this.emailServiceId, this.emailTemplateId, emailParams, this.emailUserId)
      .then(() => console.log(`📧 Email envoyé à ${order.supplierEmail}`))
      .catch(error => console.error('❌ Erreur EmailJS:', error));
  }
  generateBatchNumber(config?: BatchNumberGenerationConfig): string {
    const {
      prefix = 'LOT',
      dateFormat = 'YYMMDD',
      randomDigits = 4
    } = config || {};

    const now = new Date();
    let datePart = '';

    switch(dateFormat) {
      case 'YYMMDD':
        datePart = now.toISOString().slice(2, 10).replace(/-/g, '');
        break;
      case 'DDMMYYYY':
        datePart = [
          now.getDate().toString().padStart(2, '0'),
          (now.getMonth() + 1).toString().padStart(2, '0'),
          now.getFullYear()
        ].join('');
        break;
      default:
        datePart = now.getTime().toString();
    }

    const randomMax = Math.pow(10, randomDigits);
    const randomPart = Math.floor(randomMax / 10 + Math.random() * (randomMax - randomMax / 10));

    return `${prefix}-${datePart}-${randomPart}`;
  }
  /**
   * Récupère toutes les commandes de l'historique depuis Firebase.
   * @returns Observable de toutes les commandes de l'historique.
   */
  getCommandes(params?: { period: string }): Observable<Commande[]> {
    return this.db.list(this.historiquePath).snapshotChanges().pipe(
      map((changes: any[]) => 
        changes.map(c => {
          const commande: Commande = { 
            key: c.payload.key, 
            ...c.payload.val(),
            invoiceNumber: c.payload.val().invoiceNumber || this.generateInvoiceNumber(c.payload.val().dateCommande)
          };
          
          if (!c.payload.val().invoiceNumber) {
            this.db.object(`/historique-commandes/${c.payload.key}`).update({ 
              invoiceNumber: commande.invoiceNumber 
            });
          }
  
          return {
            ...commande,
            totalTTC: commande.totalHT * 1.19,
            paymentStatus: this.calculatePaymentStatus(commande),
            daysOverdue: this.calculateDaysOverdue(commande.deliveryDate) // Maintenant safe car la méthode gère undefined
          };
        })
      ),
      map(commandes => this.filterByPeriod(commandes, params?.period)),
      catchError(error => {
        console.error('Erreur de récupération des commandes:', error);
        return of([]);
      })
    );
  }

  private calculatePaymentStatus(commande: Commande): 'En attente' | 'Payé' | 'En retard' {
    if (commande.paymentStatus === 'Payé') return 'Payé';
    if (!commande.dueDate) return 'En attente';
    
    const today = new Date();
    const dueDate = new Date(commande.dueDate);
    return today > dueDate ? 'En retard' : 'En attente';
  }

  private calculateDaysOverdue(deliveryDate?: string): number {
    if (!deliveryDate) return 0; 
    
    const dueDate = new Date(deliveryDate);
    const today = new Date();
    return Math.max(Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24)), 0);
  }

private filterByPeriod(commandes: Commande[], period?: string): Commande[] {
  if (!period) return commandes;
  
  const { start, end } = this.getDateRange(period);
  return commandes.filter(c => 
    isWithinInterval(new Date(c.dateCommande), { start, end })
  );
}

private getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  switch(period) {
    case 'today': return { 
      start: startOfDay(now), 
      end: endOfDay(now) 
    };
    case 'week': return { 
      start: startOfWeek(now, { weekStartsOn: 1 }), 
      end: endOfWeek(now, { weekStartsOn: 1 }) 
    };
    case 'month': return { 
      start: startOfMonth(now), 
      end: endOfMonth(now) 
    };
    case 'year': return { 
      start: startOfYear(now), 
      end: endOfYear(now) 
    };
    default: return { 
      start: new Date(0), 
      end: new Date() 
    };
  }
}  /**
   * Ajoute une commande à l'historique des commandes dans Firebase Realtime Database.
   * @param commande - La commande à ajouter.
   * @returns Promise résolue une fois l'ajout terminé.
   */
async ajouterCommandeHistorique(commande: any): Promise<void> {
  const newCommande = {
    ...commande,
    key: this.db.createPushId(),
    invoiceNumber: this.generateBatchNumber({ prefix: 'FACT' }) // Ajout du numéro de facture
  };

  return this.db.list(this.historiquePath).set(newCommande.key, newCommande)
    .then(() => {
      console.log("✅ Commande ajoutée avec ID:", newCommande.key);
      this.sendEmail(newCommande);
    });
}

  // Ajouter une méthode de mise à jour

  async updateCommande(commandeKey: string, updateData: any): Promise<void> {
    const commandeRef = this.db.object(`/historique-commandes/${commandeKey}`);
    const currentData = await firstValueFrom(commandeRef.valueChanges());
    
    return commandeRef.update({ 
      ...(currentData || {}), // Gère les valeurs null/undefined
      ...(updateData || {}) 
    });
  } 



  deleteCommande(idCommande: string): Promise<void> {
    return this.db.object(`${this.historiquePath}/${idCommande}`).remove();
  }

  //facturation
  public generateInvoiceNumber(dateString: string): string {
    const date = new Date(dateString);
    return `FAC-${date.getFullYear()}${(date.getMonth()+1)
      .toString().padStart(2,'0')}${date.getDate()
      .toString().padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  


 // Génération de facture PDF
async imprimerPDF(commande: any): Promise<void> {
  try {
    const doc = new jsPDF();
    this.buildPDFContent(doc, commande);
    doc.save(`facture-${commande.invoiceNumber}.pdf`);
    return Promise.resolve();
  } catch (error) {
    console.error("Erreur génération PDF :", error);
    return Promise.reject(error);
  }
}

private buildPDFContent(doc: jsPDF, commande: any): void {
  // Configuration initiale
  const primaryColor: [number, number, number] = [44, 62, 80];
  doc.setFont('helvetica');
  
  // En-tête
  doc.setFontSize(24);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', 14, 22);

  // Informations fournisseur
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${commande.supplierName}\n${commande.supplierAddress}\nTél: ${commande.supplierPhone}`,
    14, 30
  );

  // Informations facture
  const invoiceInfo = [
    `Date: ${new Date().toLocaleDateString('fr-FR')}`,
    `N°: ${commande.invoiceNumber}`,
    `Commande: ${commande.id}`
  ];
  doc.text(invoiceInfo, 190, 30, { align: 'right' });

  // Tableau des articles
  autoTable(doc, {
    startY: 60,
    head: [['Produit', 'Quantité', 'Prix unitaire', 'Total HT']],
    body: commande.items.map((item: any) => [
      item.productName,
      item.quantity,
      `${item.unitPrice.toFixed(2)} DT`,
      `${(item.quantity * item.unitPrice).toFixed(2)} DT`
    ]),
    theme: 'grid',
    headStyles: { 
      fillColor: [245, 246, 250],
      textColor: 0,
      fontStyle: 'bold'
    },
    styles: { fontSize: 10 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' }
    }
  });

  // Totaux
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.text(`Total HT: ${commande.totalHT.toFixed(2)} DT`, 190, finalY, { align: 'right' });
  doc.text(`TVA 19%: ${(commande.totalHT * 0.19).toFixed(2)} DT`, 190, finalY + 5, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(`Total TTC: ${commande.totalTTC.toFixed(2)} DT`, 190, finalY + 10, { align: 'right' });

  // Filigrane
  if (commande.paymentStatus === 'Payé') {
    doc.setFontSize(72);
    doc.setTextColor(211, 211, 211);
    doc.setTextColor(211, 211, 211); // Light gray color
    doc.setFontSize(72);
    doc.text('PAYÉ', 105, 150, { angle: 45, align: 'center' });
  }

  // Mentions légales
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Paiement sous 30 jours. Pénalité de retard selon article L. 441-6 du code de commerce.',
    14, finalY + 20, { maxWidth: 180 }
  );
}


  
  private createDocumentDefinition(commande: any): any {
    return {
      content: [
        // En-tête
        {
          columns: [
            { 
              text: 'FACTURE', 
              style: 'header',
              width: '*'
            },
            {
              image: 'logo', // Ajoutez votre logo dans pdfMake.vfs
              width: 100,
              alignment: 'right'
            }
          ]
        },
        { text: '\n' },

        // Informations fournisseur
        {
          columns: [
            {
              text: `${commande.supplierName}\n${commande.supplierAddress}\nTél: ${commande.supplierPhone}`,
              style: 'companyInfo'
            },
            {
              text: [
                { text: 'Date de facturation: ', bold: true },
                new Date().toLocaleDateString('fr-FR') + '\n',
                { text: 'N° Facture: ', bold: true },
                commande.invoiceNumber + '\n',
                { text: 'Référence commande: ', bold: true },
                commande.id
              ],
              alignment: 'right'
            }
          ]
        },
        { text: '\n\n' },

        // Tableau des articles
        {
          table: {
            headerRows: 1,
            widths: ['*', '10%', '15%', '20%'],
            body: [
              [
                { text: 'Désignation', style: 'tableHeader' },
                { text: 'Quantité', style: 'tableHeader' },
                { text: 'Prix unitaire', style: 'tableHeader' },
                { text: 'Total HT', style: 'tableHeader' }
              ],
              ...commande.items.map(item => [
                item.productName,
                item.quantity,
                { text: `${item.unitPrice.toFixed(2)} DT`, alignment: 'right' },
                { text: `${(item.quantity * item.unitPrice).toFixed(2)} DT`, alignment: 'right' }
              ])
            ]
          }
        },
        { text: '\n' },

        // Totaux
        {
          stack: [
            {
              columns: [
                { text: 'Total HT:', alignment: 'right' },
                { text: `${commande.totalHT.toFixed(2)} DT`, alignment: 'right', width: 100 }
              ]
            },
            {
              columns: [
                { text: 'TVA (19%):', alignment: 'right' },
                { text: `${(commande.totalHT * 0.19).toFixed(2)} DT`, alignment: 'right', width: 100 }
              ]
            },
            {
              columns: [
                { text: 'Total TTC:', alignment: 'right', bold: true },
                { text: `${commande.totalTTC.toFixed(2)} DT`, alignment: 'right', bold: true, width: 100 }
              ]
            }
          ]
        },
        { text: '\n\n' },

        // Mentions légales
        {
          text: [
            'Conditions de paiement : ',
            { text: '30 jours net\n', bold: true },
            'En cas de retard de paiement, seront exigibles, conformément à l\'article L. 441-6 du code de commerce, une indemnité forfaitaire de 40 € due au titre des frais de recouvrement.'
          ],
          style: 'footer'
        }
      ],

      // Styles
      styles: {
        header: {
          fontSize: 24,
          bold: true,
          color: '#2c3e50',
          margin: [0, 0, 0, 20]
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'black',
          fillColor: '#f5f6fa'
        },
        companyInfo: {
          fontSize: 10,
          lineHeight: 1.2
        },
        footer: {
          fontSize: 8,
          color: '#666',
          lineHeight: 1.2
        }
      },

      // Filigrane si payé
      watermark: commande.paymentStatus === 'Payé' ? {
        text: 'PAYÉ',
        color: '#d3d3d3',
        opacity: 0.3,
        bold: true,
        fontSize: 72
      } : null
    };
  }
  
  async sendPaymentReminder(commande: any): Promise<void> {
    try {
      const params = {
        to_email: commande.supplierEmail,
        due_date: commande.dueDate,
        invoice_number: commande.invoiceNumber,
        amount: commande.totalHT * 1.19
      };
      
      await emailjs.send(
        this.emailServiceId, 
        'template_payment_reminder', 
        params, 
        this.emailUserId
      );
      // Pas de return explicite pour résoudre en Promise<void>
    } catch (error) {
      console.error('Erreur envoi rappel:', error);
      throw error; // Propage l'erreur si nécessaire
    }
  }

 }
