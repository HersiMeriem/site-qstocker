import { Component, OnInit } from '@angular/core';
import { EmailService } from 'src/app/services/email.service';
import { Router } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Commande } from 'src/app/models/commande';
import { HttpClient } from '@angular/common/http';
import { from, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SharedCommandService } from 'src/app/services/shared-command.service';

@Component({
  selector: 'app-facturation-commandes',
  templateUrl: './facturation-commandes.component.html',
  styleUrls: ['./facturation-commandes.component.css']
})
export class FacturationCommandesComponent implements OnInit {
  commandes: Commande[] = [];
  filteredCommandes: Commande[] = [];  
  paidCount = 0;
  pendingCount = 0;
  overdueCount = 0;
  searchTerm: string = '';

  constructor(
    private emailService: EmailService,
    private router: Router,
    private http: HttpClient,
    private sharedCommandService: SharedCommandService
  ) {}

   ngOnInit(): void {
    this.sharedCommandService.currentCommands.subscribe(commands => {
      this.commandes = commands;
      this.filteredCommandes = [...commands];
      this.updateCounts();
    });

    this.sharedCommandService.refreshCommands();
  }

  async loadCommandes(): Promise<void> {
    try {
        this.emailService.getCommandes().subscribe(commandes => {
            this.commandes = commandes.map(c => {
                // Normalisation des données
                const normalized = {
                    ...c,
                    // Si les données sont dans items[0], les copier au niveau racine
                    quantite: c.quantite ?? c.items?.[0]?.quantity,
                    prixUnitaire: c.prixUnitaire ?? c.items?.[0]?.unitPrice,
                    productId: c.productId ?? c.items?.[0]?.productId,
                    productName: c.productName ?? c.items?.[0]?.productName,
                    paymentStatus: this.calculatePaymentStatus(c),
                    dueDate: c.dueDate || this.calculateDueDate(c.dateCommande)
                };
                return normalized;
            });
            this.updateCounts();
            this.filteredCommandes = [...this.commandes];
        });
    } catch (error) {
        console.error('Erreur chargement commandes:', error);
    }
}


  getProductId(commande: Commande): string {
    return commande.productId || commande.items?.[0]?.productId || 'N/A';
  }

  getProductName(commande: Commande): string {
    return commande.productName || commande.items?.[0]?.productName || 'N/A';
  }

  getQuantity(commande: Commande): number {
    // Vérifier d'abord quantite sur la commande principale
    if (commande.quantite !== undefined && commande.quantite !== null) {
        return Number(commande.quantite);
    }
    
    // Vérifier items[0].quantity
    if (commande.items && commande.items.length > 0) {
        return Number(commande.items[0].quantity) || 0;
    }
    
    // Vérifier quantity (propriété directe alternative)
    if (commande.quantity !== undefined && commande.quantity !== null) {
        return Number(commande.quantity);
    }
    
    return 0;
}

getUnitPrice(commande: Commande): number {
    // Vérifier d'abord prixUnitaire sur la commande principale
    if (commande.prixUnitaire !== undefined && commande.prixUnitaire !== null) {
        return Number(commande.prixUnitaire);
    }
    
    // Vérifier items[0].unitPrice
    if (commande.items && commande.items.length > 0) {
        return Number(commande.items[0].unitPrice) || 0;
    }
    
    // Vérifier unitPrice (propriété directe alternative)
    if (commande.unitPrice !== undefined && commande.unitPrice !== null) {
        return Number(commande.unitPrice);
    }
    
    return 0;
}

logCommandeStructure(commande: Commande): void {
  console.log('Structure de la commande:', {
      id: commande.id,
      hasQuantite: 'quantite' in commande,
      hasPrixUnitaire: 'prixUnitaire' in commande,
      hasItems: 'items' in commande,
      itemsLength: commande.items?.length || 0,
      fullData: commande
  });
}

  
  getTotalHT(commande: Commande): number {
    // Ajout d'une validation renforcée
    if (commande.totalHT !== undefined && !isNaN(commande.totalHT)) {
      return commande.totalHT;
    }
    
    return this.getQuantity(commande) * this.getUnitPrice(commande);
  }


  getTotalTTC(commande: Commande): number {
    return this.getTotalHT(commande) * 1.19;
  }

  private calculatePaymentStatus(commande: Commande): 'En attente' | 'Payé' | 'En retard' {
    if (commande.paymentStatus === 'Payé') return 'Payé';
    if (!commande.dueDate) return 'En attente';
    
    const today = new Date();
    const dueDate = new Date(commande.dueDate);
    return today > dueDate ? 'En retard' : 'En attente';
  }

  private calculateDueDate(orderDate: string): string {
    const date = new Date(orderDate);
    date.setDate(date.getDate() + 30);
    return date.toISOString();
  }

  private updateCounts(): void {
    this.paidCount = this.commandes.filter(c => c.paymentStatus === 'Payé').length;
    this.pendingCount = this.commandes.filter(c => c.paymentStatus === 'En attente').length;
    this.overdueCount = this.commandes.filter(c => c.paymentStatus === 'En retard').length;
  }

  calculateDaysLate(dueDate: string | undefined): number {
    if (!dueDate) return 0;
    
    const due = new Date(dueDate);
    const today = new Date();
    return Math.max(Math.floor((today.getTime() - due.getTime()) / (1000 * 3600 * 24)), 0);
  }

  async markAsPaid(commande: Commande): Promise<void> {
    if (confirm(`Marquer la commande ${commande.id} comme payée ?`)) {
      try {
        await this.emailService.updateCommande(commande.key || '', {
          paymentStatus: 'Payé',
          paymentDate: new Date().toISOString()
        });
        this.loadCommandes();
      } catch (error) {
        console.error('Erreur mise à jour paiement:', error);
      }
    }
  }
  
  generateInvoice(commande: Commande): void {
    const doc = new jsPDF();
  
    // Charger l'image en base64
    this.getImageBase64('assets/images/qstockerlogo.PNG').subscribe({
      next: (base64Image) => {
        // Ajouter l'image encodée en base64
        doc.addImage(base64Image, 'PNG', 15, 10, 40, 20);
  
        // En-tête du document
        doc.setFontSize(18);
        doc.text('FACTURE FOURNISSEUR', 60, 20); // Titre principal
        doc.setFontSize(12);
        doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 170, 30, { align: 'right' }); // Date
        doc.text(`N° de commande: ${commande.id || 'N/A'}`, 170, 35, { align: 'right' }); // Numéro de commande
        doc.text(`N° Facture: ${commande.invoiceNumber || 'N/A'}`, 170, 40, { align: 'right' }); // Numéro de facture
  
        // Informations du fournisseur
        doc.setFontSize(10);
        doc.text(
          `Fournisseur: ${commande.supplierName || 'N/A'}\nAdresse: ${commande.supplierAddress || 'N/A'}`,
          15, 45
        );
  
        // Données des produits
        const items = commande.items || [{
          productId: this.getProductId(commande) || 'N/A',
          productName: this.getProductName(commande) || 'N/A',
          quantity: this.getQuantity(commande) || 0,
          unitPrice: this.getUnitPrice(commande) || 0
        }];
  
        // Tableau des produits
        autoTable(doc, {
          startY: 60,
          head: [['ID Produit', 'Nom Produit', 'Quantité', 'Prix Unitaire HT (DT)', 'Total HT (DT)']],
          body: items.map(item => [
            item.productId || 'N/A',
            item.productName || 'N/A',
            (item.quantity || 0).toString(),
            `${(item.unitPrice || 0).toFixed(3).replace('.', ',')} DT`,
            `${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(3).replace('.', ',')} DT`
          ]),
          theme: 'grid',
          headStyles: {
            fillColor: [245, 246, 250],
            textColor: 0,
            fontStyle: 'bold'
          },
          columnStyles: {
            3: { halign: 'right' },
            4: { halign: 'right' }
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index >= 3) {
              if (typeof data.cell.text === 'string') {
                data.cell.text = data.cell.text.replace('.', ',');
              }
            }
          }
        });
  
        // Calcul des totaux
        const totalHT = items.reduce((acc, item) => acc + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
        const tva = totalHT * 0.19;
        const totalTTC = totalHT + tva;
  
        // Ajout des totaux
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        autoTable(doc, {
          startY: finalY,
          body: [
            ['Total HT', `${totalHT.toFixed(3).replace('.', ',')} DT`],
            ['TVA (19%)', `${tva.toFixed(3).replace('.', ',')} DT`],
            ['Total TTC', `${totalTTC.toFixed(3).replace('.', ',')} DT`]
          ],
          theme: 'plain',
          columnStyles: {
            0: { fontStyle: 'bold', halign: 'right' },
            1: { halign: 'right' }
          }
        });
  
        // Ajout des informations de l'entreprise au pied de la page
        const footerY = doc.internal.pageSize.height - 20;
        doc.setFontSize(10);
        doc.setTextColor('#555');
        doc.text(
          'QStocker - Adresse : Mahdia, zone touristique | Tél : +216 70 123 456 | Email : contact.qstocker@gmail.com',
          15, footerY
        );
  
        // Sauvegarde du fichier PDF
        doc.save(`facture-${commande.invoiceNumber || commande.id}.pdf`);
      },
      error: (err) => {
        console.error('Erreur lors du chargement de l\'image:', err);
      }
    });
  }
 // Méthode pour obtenir l'image en base64
getImageBase64(imagePath: string): Observable<string> {
  return this.http.get(imagePath, { responseType: 'blob' }).pipe(
    switchMap((blob: Blob) => {
      return new Observable<string>((observer) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          observer.next(reader.result as string); // Renvoie le résultat en tant que string
          observer.complete();
        };
        reader.onerror = (error) => {
          observer.error(error);
        };
        reader.readAsDataURL(blob); // Convertit le blob en base64
      });
    })
  );
}

  retour() {
    this.router.navigate(['/responsable/historique-commandes']);
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredCommandes = [...this.commandes];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredCommandes = this.commandes.filter(commande => 
      commande.id.toLowerCase().includes(term) ||
      (commande.invoiceNumber?.toLowerCase() || '').includes(term) ||
      this.getProductName(commande).toLowerCase().includes(term) ||
      commande.supplierName.toLowerCase().includes(term)
    );
  }
  
}