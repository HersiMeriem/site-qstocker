import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { EmailService } from 'src/app/services/email.service';
import { StockService } from 'src/app/services/stock.service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-historique-commandes',
  templateUrl: './historique-commandes.component.html',
  styleUrls: ['./historique-commandes.component.css']
})
export class HistoriqueCommandesComponent implements OnInit {
  commandes: any[] = [];
  loading = false;
  errorMessage: string | null = null;
  searchTerm: string = ''; 
  filteredCommandes: any[] = []; 
  private readonly primaryColor: [number, number, number] = [0, 102, 204];
  private readonly secondaryColor: [number, number, number] = [40, 40, 40];

  constructor(
    private emailService: EmailService,
    private stockService: StockService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCommandes();
    setInterval(() => this.verifierRetards(), 600000);
  }

  calculateRetardDays(deliveryDate: string): number {
    if (!deliveryDate) return 0;
    
    try {
      const livraison = new Date(deliveryDate);
      const maintenant = new Date();
      
      livraison.setHours(0, 0, 0, 0);
      maintenant.setHours(0, 0, 0, 0);
      
      const diffTemps = maintenant.getTime() - livraison.getTime();
      const diffJours = Math.floor(diffTemps / (1000 * 3600 * 24));
      
      return Math.max(diffJours, 0);
    } catch (error) {
      console.error('Erreur calcul retard:', error);
      return 0;
    }
  } 

  private verifierRetards() {
    const maintenant = new Date();
    this.commandes.forEach(commande => {
      if ((commande.status === 'En attente' || commande.status === 'Retard') && commande.deliveryDate) {
        const dateLivraison = new Date(commande.deliveryDate);
        const joursRetard = this.calculateRetardDays(commande.deliveryDate);
        
        if (joursRetard > 0) {
          const commandeUpdate = { 
            ...commande, 
            status: 'Retard',
            joursRetard: joursRetard
          };
          
          if (commande.status !== 'Retard' || commande.joursRetard !== joursRetard) {
            this.emailService.updateCommande(commande.key, { 
              status: 'Retard',
              joursRetard: joursRetard 
            }).catch(error => {
              console.error('Erreur mise à jour retard:', error);
            });
            
            this.miseAJourLocale(commandeUpdate);
            this.filterCommandes();
          }
        }
      }
    });
  }

  retour() {
    this.router.navigate(['/responsable/commande-fournisseur']);
  }

  private mettreAJourStatutSilencieux(commande: any) {
    const commandeUpdate = { 
      ...commande, 
      status: 'Retard',
      joursRetard: this.calculateRetardDays(commande.deliveryDate)
    };
    this.emailService.updateCommande(commandeUpdate.key, commandeUpdate)
      .then(() => this.miseAJourLocale(commandeUpdate))
      .catch(error => console.error('Erreur mise à jour:', error));
  }

  async updateStatus(commande: any, newStatus: string) {
    const ancienStatus = commande.status;
    const commandeKey = commande.key;
  
    if (!commandeKey) {
      this.showErrorNotification('Clé Firebase invalide');
      return;
    }
  
    this.loading = true;
    this.errorMessage = null;
  
    try {
      if (newStatus === 'Bien Reçu') {
        if (!commande.productId) {
          throw new Error('ID produit manquant');
        }
        if (!commande.quantity || isNaN(Number(commande.quantity))) {
          throw new Error('Quantité invalide');
        }
        if (!commande.unitPrice || isNaN(Number(commande.unitPrice))) {
          throw new Error('Prix unitaire invalide');
        }

        const stockData = {
          productId: commande.productId,
          productName: commande.productName || 'Produit sans nom',
          quantity: Number(commande.quantity),
          unitPrice: Number(commande.unitPrice),
          qrCode: commande.qrCode || null,
          imageUrl: commande.imageUrl || null,
          description: commande.description || null
        };

        await this.stockService.ajouterAuStock(stockData);
      }

      const updateData: any = {
        status: newStatus,
        lastUpdated: new Date().toISOString()
      };

      if (newStatus === 'Bien Reçu') {
        updateData.dateBienRecu = new Date().toISOString();
        updateData.joursRetard = 0;
      }

      await this.emailService.updateCommande(commandeKey, updateData);

      const updatedCommande = { 
        ...commande, 
        ...updateData
      };
      
      this.commandes = this.commandes.map(c => 
        c.key === commandeKey ? updatedCommande : c
      );

      this.showSuccessNotification(`Statut mis à jour : ${newStatus}`);
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      
      let errorMessage = 'Erreur lors de la mise à jour';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      this.showErrorNotification(errorMessage);
      this.miseAJourLocale({ ...commande, status: ancienStatus });
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }
  
  private async traiterReceptionStock(commande: any) {
    try {
      const currentStock = await firstValueFrom(
        this.stockService.getProduct(commande.productId)
      );
  
      const totalQuantite = (currentStock?.quantite || 0) + commande.quantity;
      const totalValeur = (currentStock?.prixUnitaireHT || 0) * (currentStock?.quantite || 0) 
                        + commande.unitPrice * commande.quantity;
      const prixMoyen = totalQuantite > 0 ? totalValeur / totalQuantite : commande.unitPrice;
  
      await this.stockService.ajouterAuStock({
        productId: commande.productId,
        productName: commande.productName,
        quantity: commande.quantity,
        unitPrice: prixMoyen
      });
  
    } catch (error) {
      console.error('Échec mise à jour stock:', error);
      throw new Error('Problème lors de la mise à jour du stock');
    }
  }

  private miseAJourLocale(commandeUpdate: any) {
    this.commandes = this.commandes.map(c => 
      c.key === commandeUpdate.key ? { ...c, ...commandeUpdate } : c
    );
    this.filterCommandes(); 
    this.changeDetector.detectChanges();
  }
 
  private handleUpdateError(error: unknown, commande: any, ancienStatus: string) {
    console.error('Erreur de mise à jour:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    this.showErrorNotification(`Échec de la mise à jour : ${message}`);
    this.miseAJourLocale({ ...commande, status: ancienStatus });
  }

  private showSuccessNotification(message: string) {
    console.log('Succès:', message);
  }

  private showErrorNotification(message: string) {
    console.error('Erreur:', message);
    this.errorMessage = message;
    setTimeout(() => this.errorMessage = null, 5000);
  }

  async supprimerCommande(commande: any) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette commande définitivement ?')) {
      try {
        this.loading = true;
        await this.emailService.deleteCommande(commande.key);
        this.commandes = this.commandes.filter(c => c.key !== commande.key);
        this.errorMessage = null;
      } catch (error) {
        console.error('Échec de la suppression:', error);
        this.errorMessage = 'Échec de la suppression de la commande';
        this.loadCommandes();
      } finally {
        this.loading = false;
      }
    }
  }

  loadCommandes() {
    this.loading = true;
    this.emailService.getCommandes().subscribe({
      next: (data: any[]) => {
        this.commandes = data.map(c => ({
          ...c,
          key: c.key,
          deliveryDate: c.deliveryDate || null
        }));
        this.filteredCommandes = [...this.commandes];
        this.verifierRetards();
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.loading = false;
      }
    });
  } 

  filterCommandes() {
    if (!this.searchTerm) {
      this.filteredCommandes = [...this.commandes];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredCommandes = this.commandes.filter(commande => {
      return (
        (commande.productName && commande.productName.toLowerCase().includes(term)) ||
        (commande.id && commande.id.toString().toLowerCase().includes(term)) ||
        (commande.productId && commande.productId.toString().toLowerCase().includes(term)) ||
        (commande.supplierName && commande.supplierName.toLowerCase().includes(term))
      );
    });
  }

  clearSearch() {
    this.searchTerm = '';
    this.filterCommandes();
  }

  imprimerPDF(commande: any) {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const safeCommande = {
        ...commande,
        idCommande: commande.idCommande || 'N/A',
        idProduit: commande.idProduit || 'N/A',
        supplierName: commande.supplierName || 'Non spécifié',
        supplierAddress: commande.supplierAddress || '',
        supplierEmail: commande.supplierEmail || '',
        productDescription: commande.productDescription || commande.productName || 'Produit non spécifié',
        quantity: commande.quantity || 0,
        unitPrice: commande.unitPrice || 0,
        totalHT: commande.totalHT || 0
      };

      this.generateHeader(doc, safeCommande);
      this.generateSupplierInfo(doc, safeCommande);
      this.generateProductTable(doc, safeCommande);
      this.generateTotals(doc, safeCommande);
      this.generateFooter(doc);

      doc.save(`commande-${this.sanitizeFilename(safeCommande.idCommande)}.pdf`);
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      this.errorMessage = 'Erreur lors de la génération du PDF';
    }
  }

  private generateHeader(doc: jsPDF, commande: any) {
    const margin = 15;
    doc.setProperties({
      title: `Commande ${commande.idCommande || 'N/A'}`,
      subject: 'Commande fournisseur',
      creator: 'SeeFar FSEG Mahdia'
    });

    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('COMMANDE FOURNISSEUR', margin, 20);

    doc.setFontSize(10);
    doc.text(`N°: ${this.sanitizeText(commande.idCommande) || 'N/A'}`, margin, 30);
    doc.text(`Date: ${this.formatDate(commande.dateCommande)}`, margin + 60, 30);
    doc.text(`Livraison: ${this.formatDate(commande.deliveryDate)}`, margin + 120, 30);
  }

  private generateSupplierInfo(doc: jsPDF, commande: any) {
    const margin = 15;
    let y = 40;
    
    doc.setFontSize(12);
    doc.setTextColor(0, 102, 204);
    doc.text('FOURNISSEUR', margin, y);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    y += 7;
    
    const supplierInfo = [
      this.sanitizeText(commande.supplierName),
      this.sanitizeText(commande.supplierAddress),
      `Email: ${this.sanitizeText(commande.supplierEmail)}`
    ].filter(Boolean);

    supplierInfo.forEach(line => {
      doc.text(line, margin, y);
      y += 5;
    });
  }

  private generateProductTable(doc: jsPDF, commande: any) {
    autoTable(doc, {
      startY: 65,
      head: [[
        'Référence', 
        'Description', 
        'Quantité', 
        'PU HT', 
        'Total HT'
      ]],
      body: [[
        this.sanitizeText(commande.idProduit) || 'N/A',
        this.sanitizeText(commande.productDescription),
        `${commande.quantity}`,
        `${this.formatCurrency(commande.unitPrice)} DT`,
        `${this.formatCurrency(commande.totalHT)} DT`
      ]],
      theme: 'grid',
      headStyles: { 
        fillColor: [0, 102, 204],
        textColor: 255,
        fontSize: 10
      },
      bodyStyles: { 
        fontSize: 10,
        minCellHeight: 8
      },
      margin: { left: 15 }
    });
  }

  private generateTotals(doc: jsPDF, commande: any) {
    const margin = 15;
    const totalHT = Number(commande.totalHT) || 0;
    const tva = totalHT * 0.19;
    const totalTTC = totalHT + tva;
    let y = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(12);
    doc.setTextColor(0, 102, 204);
    doc.text('DÉTAIL DES MONTANTS', margin, y);
    y += 7;

    const totals = [
      { label: 'TOTAL HT', value: totalHT },
      { label: 'TVA (19%)', value: tva },
      { label: 'NET À PAYER', value: totalTTC }
    ];

    totals.forEach((total, index) => {
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`${total.label}:`, margin + 120, y + (index * 7));
      
      doc.setTextColor(0, 102, 204);
      doc.text(
        `${this.formatCurrency(total.value)} DT`, 
        margin + 160, 
        y + (index * 7)
      );
    });
  }

  private generateFooter(doc: jsPDF) {
    const margin = 15;
    let y = 280;

    doc.setDrawColor(...this.primaryColor);
    doc.line(margin, y - 5, doc.internal.pageSize.width - margin, y - 5);
  
    doc.setFontSize(8);
    doc.setTextColor(...this.secondaryColor);
    doc.setFont("helvetica", "normal");
    const footerLines = [
      "QStocker - Zone touristique mahdia ",
      " +216 95 393 246 | contact.qstocker@gmail.com ",
      " www.qstocker.tn | Réseaux sociaux: @QStockerOfficiel"
    ];
    footerLines.forEach((line, index) => {
      doc.text(line, margin, y + (index * 4));
    });
    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Page ${i}/${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
    }
  }

  private sanitizeText(text: string): string {
    return this.sanitizer.sanitize(1, text) || '';
  }

  private sanitizeFilename(name: string): string {
    return (name || 'unknown').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  private formatDate(dateString: string): string {
    try {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date invalide';
      
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  }

  private formatCurrency(value: number): string {
    const numValue = Number(value) || 0;
    return numValue.toFixed(3)
      .replace('.', ',')
      .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ');
  }
 
}