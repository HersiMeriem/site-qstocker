import { Component, OnInit } from '@angular/core';
import { SaleService } from '../../services/sale.service';
import { Sale } from '../../models/sale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
@Component({
  selector: 'app-ventes',
  templateUrl: './ventes.component.html',
  styleUrls: ['./ventes.component.css']
})
export class VentesComponent implements OnInit {
  salesHistory: Sale[] = [];
  filteredSalesHistory: Sale[] = [];
  loadingHistory = true;
  historyError: string | null = null;
  searchTerm = '';
  historyFilter = 'today';
  dailyRevenue = 0;
  dailySalesCount = 0;
  isFaLoaded = false;
  isMaterialLoaded = false;
periodRevenue = 0;
  periodLabel = '';


  paymentMethods = [
    { value: 'cash', label: 'Espèces', icon: 'fas fa-money-bill-wave' },
    { value: 'card', label: 'Carte', icon: 'fas fa-credit-card' },
    { value: 'credit', label: 'Crédit', icon: 'fas fa-hand-holding-usd' }
  ];

  constructor(private saleService: SaleService) {}

  ngOnInit(): void {
    this.checkIconLibraries();
    this.loadSalesHistory();
    this.loadDailyStats();
  }

  checkIconLibraries() {
    // Vérifie Font Awesome
    this.isFaLoaded = Array.from(document.styleSheets).some(sheet => 
      sheet.href?.includes('fontawesome')
    );
    
    // Vérifie Material Icons
    this.isMaterialLoaded = Array.from(document.styleSheets).some(sheet => 
      sheet.href?.includes('material-icons')
    );
    
    // Ajoute les classes nécessaires au body
    if (!this.isFaLoaded) {
      document.body.classList.add('no-fa');
    }
    if (!this.isMaterialLoaded) {
      document.body.classList.add('no-material');
    }
  }

    loadSalesHistory(): void {
    this.loadingHistory = true;
    this.historyError = null;
    
    this.saleService.getSalesHistory(this.historyFilter).subscribe({
      next: (sales: Sale[]) => {
        this.salesHistory = sales
          .filter(s => s.items && s.items.length > 0)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        this.filteredSalesHistory = [...this.salesHistory];
        this.calculatePeriodRevenue();
        this.loadingHistory = false;
      },
      error: (err: any) => {
        this.historyError = 'Erreur de chargement: ' + err.message;
        this.loadingHistory = false;
      }
    });
  }

  calculatePeriodRevenue(): void {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date();
    
    switch(this.historyFilter) {
      case 'today':
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        this.periodLabel = "Aujourd'hui";
        break;
      case 'week':
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        this.periodLabel = "Cette semaine";
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        this.periodLabel = "Ce mois";
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        this.periodLabel = "Cette année";
        break;
      default:
        this.periodRevenue = this.salesHistory.reduce((sum, sale) => sum + sale.totalAmount, 0);
        this.periodLabel = "Total général";
        return;
    }

    this.periodRevenue = this.salesHistory
      .filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= startDate && saleDate <= endDate;
      })
      .reduce((sum, sale) => sum + sale.totalAmount, 0);
  }


  loadDailyStats(): void {
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();
    
    this.saleService.getSalesByDateRange(todayStart, todayEnd).subscribe({
      next: (sales: Sale[]) => {
        this.dailySalesCount = sales.length;
        this.dailyRevenue = sales.reduce((sum: number, sale: Sale) => sum + sale.totalAmount, 0);
      },
      error: (err: any) => {
        console.error('Erreur stats quotidiennes:', err);
      }
    });
  }

  applySearchFilter(): void {
    const search = this.searchTerm.toLowerCase().trim();
    
    if (!search) {
      this.filteredSalesHistory = [...this.salesHistory];
      return;
    }

    this.filteredSalesHistory = this.salesHistory.filter(sale => 
      sale.invoiceNumber.toLowerCase().includes(search) ||
      sale.customerName.toLowerCase().includes(search) ||
      (sale.customerId && sale.customerId.toLowerCase().includes(search)) ||
      sale.items.some(item => item.name.toLowerCase().includes(search))
  )}


  getPaymentMethodLabel(method: string): string {
    return this.paymentMethods.find(m => m.value === method)?.label || method;
  }

  getPaymentMethodIcon(method: string): string {
    return this.paymentMethods.find(m => m.value === method)?.icon || 'fas fa-question-circle';
  }

  showSaleDetails(sale: Sale): void {
    const itemsList = sale.items.map(item => 
      `${item.name} (x${item.quantity}) - ${item.totalPrice.toFixed(2)} DT`
    ).join('\n');
    
    alert(
      `Détails de la vente #${sale.invoiceNumber}\n\n` +
      `Client: ${sale.customerName}\n` +
      `Date: ${new Date(sale.date).toLocaleString()}\n` +
      `Méthode de paiement: ${this.getPaymentMethodLabel(sale.paymentMethod)}\n` +
      `Total: ${sale.totalAmount.toFixed(2)} DT\n\n` +
      `Articles:\n${itemsList}`
    );
  }
  
 printInvoice(sale: Sale): void {
  try {
    // Validation des données de base
    if (!sale || !sale.items || sale.items.length === 0) {
      throw new Error("La vente ne contient aucun article");
    }

    // Vérification et correction des données
    sale.items.forEach(item => {
      if (!item.unitPrice || isNaN(item.unitPrice)) {
        item.unitPrice = item.originalPrice || 0;
      }
      if (!item.quantity || isNaN(item.quantity)) {
        item.quantity = 1;
      }
      if (!item.totalPrice || isNaN(item.totalPrice)) {
        item.totalPrice = item.unitPrice * item.quantity;
      }
    });

    // Calcul des totaux si manquants
    if (!sale.subTotal || isNaN(sale.subTotal)) {
      sale.subTotal = sale.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    }
    if (!sale.totalAmount || isNaN(sale.totalAmount)) {
      sale.totalAmount = sale.subTotal - (sale.discountAmount || 0);
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Configuration des styles
    const styles = {
      primaryColor: [41, 128, 185] as [number, number, number],
      secondaryColor: [236, 240, 241] as [number, number, number],
      dangerColor: [220, 53, 69] as [number, number, number],
      font: 'helvetica',
      headerHeight: 50,
      margin: 20,
      footerHeight: 20
    };

    // En-tête avec gestion d'erreur pour le logo
    try {
      const logoUrl = 'assets/images/qstockerlogo.PNG';
      const img = new Image();
      img.src = logoUrl;
      if (img.complete) {
        doc.addImage(img.src, 'PNG', styles.margin, 15, 40, 20);
      } else {
        throw new Error("Logo non chargé");
      }
    } catch (logoError) {
      console.warn("Erreur de chargement du logo:", logoError);
      doc.setFontSize(16);
      doc.setTextColor(...styles.primaryColor);
      doc.setFont(styles.font, 'bold');
      doc.text('QStocker', styles.margin, 25);
    }

    // Coordonnées entreprise
    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.setFont(styles.font, 'normal');
    const companyInfo = [
      'Mahdia, Zone touristique',
      'Tél: +216 70 123 456',
      'Email: contact.qstocker@gmail.com',
      'R.C. : 12345678A | TVA: 12345678'
    ];
    companyInfo.forEach((line, index) => {
      doc.text(line, 130, 25 + (index * 5));
    });

    // Ligne de séparation
    doc.setDrawColor(...styles.primaryColor);
    doc.setLineWidth(0.5);
    doc.line(styles.margin, 45, doc.internal.pageSize.width - styles.margin, 45);

    // Informations facture avec date sécurisée
    const saleDate = sale.date ? new Date(sale.date) : new Date();
    const invoiceNumber = sale.invoiceNumber || `INV-${saleDate.getTime().toString().slice(-6)}`;
    
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.setFont(styles.font, 'bold');
    doc.text(`Facture N°: ${invoiceNumber}`, styles.margin, 55);
    doc.setFont(styles.font, 'normal');
    doc.text(`Date: ${saleDate.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })}`, styles.margin, 60);

    // Section client améliorée
    autoTable(doc, {
      startY: 65,
      margin: { left: styles.margin },
      head: [[{ 
        content: 'INFORMATIONS CLIENT', 
        colSpan: 2, 
        styles: { 
          fillColor: styles.primaryColor,
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        } 
      }]],
      body: [
        ['Nom', sale.customerName || 'Non spécifié'],
        ['ID Client', sale.customerId || 'N/A'],
        ['Date de vente', saleDate.toLocaleString('fr-FR')],
        ['Méthode de paiement', this.getPaymentMethodLabel(sale.paymentMethod)]
      ],
      styles: {
        fontSize: 10,
        cellPadding: 4,
        lineColor: styles.primaryColor,
        textColor: 40
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 'auto' }
      }
    });

    // Section articles avec meilleure mise en page
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [
        [
          { content: 'Produit', styles: { fontStyle: 'bold' } },
          { content: 'Prix unitaire', styles: { halign: 'right', fontStyle: 'bold' } },
          { content: 'Quantité', styles: { halign: 'center', fontStyle: 'bold' } },
          { content: 'Total', styles: { halign: 'right', fontStyle: 'bold' } }
        ]
      ],
      body: sale.items.map(item => [
        item.name || 'Produit non nommé',
        { 
          content: item.unitPrice !== item.originalPrice 
            ? `${item.unitPrice.toFixed(2)} DT\n(orig. ${item.originalPrice?.toFixed(2) ?? item.unitPrice.toFixed(2)} DT)` 
            : `${item.unitPrice.toFixed(2)} DT`,
          styles: { halign: 'right' } 
        },
        { content: (item.quantity || 0).toString(), styles: { halign: 'center' } },
        { content: `${(item.totalPrice || 0).toFixed(2)} DT`, styles: { halign: 'right' } }
      ]),
      margin: { left: styles.margin, right: styles.margin },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: 40,
        lineColor: [200, 200, 200]
      },
      headStyles: {
        fillColor: styles.primaryColor,
        textColor: 255
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 80 },  // Produit
        1: { cellWidth: 45 },  // Prix
        2: { cellWidth: 25 },  // Quantité
        3: { cellWidth: 35 }   // Total
      },
      didDrawPage: (data) => {
        // Pied de page numéroté
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(
          `Page ${data.pageNumber}`,
          doc.internal.pageSize.width - styles.margin,
          doc.internal.pageSize.height - 10,
          { align: 'right' }
        );
      }
    });

    // Calcul des totaux sécurisé
    const totals = {
      subTotal: sale.subTotal,
      discount: sale.discount || 0,
      get discountAmount() { return this.subTotal * (this.discount / 100) },
      get total() { return this.subTotal - this.discountAmount }
    };

    // Section totaux améliorée
    const totalsStartY = (doc as any).lastAutoTable.finalY + 15;
    const totalsWidth = 70;
    const totalsX = doc.internal.pageSize.width - styles.margin - totalsWidth;

    // Encadré des totaux
    doc.setDrawColor(...styles.primaryColor);
    doc.setFillColor(...styles.secondaryColor);
    doc.rect(totalsX - 5, totalsStartY - 5, totalsWidth + 10, totals.discount ? 60 : 45, 'FD');

    // Formatage monétaire
    const formatMoney = (amount: number) => amount.toFixed(2).replace('.', ',') + ' DT';

    // Affichage des totaux
    let currentY = totalsStartY;
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.setFont(styles.font, 'bold');
    
    doc.text('Sous-total:', totalsX, currentY);
    doc.text(formatMoney(totals.subTotal), totalsX + totalsWidth - 5, currentY, { align: 'right' });
    currentY += 8;

    if (totals.discount > 0) {
      doc.text(`Remise (${totals.discount}%):`, totalsX, currentY);
      doc.text(`-${formatMoney(totals.discountAmount)}`, totalsX + totalsWidth - 5, currentY, { align: 'right' });
      currentY += 8;
      
      // Ligne de séparation
      doc.setDrawColor(200);
      doc.setLineWidth(0.3);
      doc.line(totalsX, currentY, totalsX + totalsWidth, currentY);
      currentY += 5;
    }

    // Total final
    doc.setFontSize(12);
    doc.setTextColor(...styles.primaryColor);
    doc.text('Total à payer:', totalsX, currentY);
    doc.text(formatMoney(totals.total), totalsX + totalsWidth - 5, currentY, { align: 'right' });

    // Pied de page complet
    doc.setFontSize(8);
    doc.setTextColor(100);
    const footerLines = [
      'Merci pour votre confiance !',
      'Contact : contact.qstocker@gmail.com | Tél: +216 70 123 456',
      'Conditions de paiement : 30 jours net'
    ];
    footerLines.forEach((line, index) => {
      doc.text(
        line,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 15 + (index * 4),
        { align: 'center' }
      );
    });

    // Génération du nom de fichier sécurisé
    const cleanName = (sale.customerName || 'client')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Supprime les accents
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .substring(0, 30);
    
    const fileName = `Facture_${invoiceNumber}_${cleanName}.pdf`;
    
    // Sauvegarde du PDF
    doc.save(fileName);

} catch (error) {
    console.error("Erreur lors de la génération de la facture:", error);
    let errorMessage = "Une erreur inconnue est survenue";
    
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    
    alert(`Erreur lors de la génération du PDF: ${errorMessage}`);
  }}
}