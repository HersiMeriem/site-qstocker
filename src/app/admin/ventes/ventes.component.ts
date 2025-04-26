import { Component, OnInit } from '@angular/core';
import { SaleService } from '../../services/sale.service';
import { Sale } from '../../models/sale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-ventes',
  templateUrl: './ventes.component.html',
  styleUrls: ['./ventes.component.css']
})
export class VentesComponent implements OnInit {
  salesHistory: Sale[] = [];
  filteredSales: Sale[] = [];
  loading = true;
  error: string | null = null;
  searchTerm = '';
  filterPeriod = 'today';

  constructor(private saleService: SaleService) {}

  ngOnInit(): void {
    this.loadSalesHistory();
  }

  loadSalesHistory(): void {
    this.loading = true;
    this.error = null;
    
    this.saleService.getSalesHistory(this.filterPeriod).subscribe({
      next: (sales) => {
        this.salesHistory = sales;
        this.filteredSales = [...sales];
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement historique:', err);
        this.error = 'Erreur lors du chargement des ventes';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    if (!this.searchTerm) {
      this.filteredSales = [...this.salesHistory];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredSales = this.salesHistory.filter(sale => 
      sale.invoiceNumber.toLowerCase().includes(term) ||
      sale.customerName.toLowerCase().includes(term) ||
      sale.items.some(item => item.name.toLowerCase().includes(term))
  )}

  printInvoice(sale: Sale): void {
    const doc = new jsPDF();
    
    // En-tête
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text(`Facture ${sale.invoiceNumber}`, 105, 20, { align: 'center' });
    
    // Détails client
    doc.setFontSize(12);
    doc.text(`Client: ${sale.customerName}`, 20, 40);
    doc.text(`Date: ${new Date(sale.date).toLocaleDateString()}`, 20, 50);
    
    // Tableau des articles
    autoTable(doc, {
      head: [['Produit', 'Prix', 'Qté', 'Total']],
      body: sale.items.map(item => [
        item.name,
        `${item.unitPrice.toFixed(2)} DT`,
        item.quantity,
        `${item.totalPrice.toFixed(2)} DT`
      ]),
      startY: 60,
    });
    
    // Total
    doc.text(`Total: ${sale.totalAmount.toFixed(2)} DT`, 140, (doc as any).lastAutoTable.finalY + 20);
    
    doc.save(`facture_${sale.invoiceNumber}.pdf`);
  }

  getPaymentMethodLabel(method: string): string {
    switch(method) {
      case 'cash': return 'Espèces';
      case 'card': return 'Carte';
      case 'credit': return 'Crédit';
      default: return method;
    }
  }
}