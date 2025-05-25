import { Component, OnInit } from '@angular/core';
import { OrderService } from '../../services/order.service';
import { Order, CartItem } from 'src/app/models/order';
import { map } from 'rxjs/operators';
import { jsPDF } from 'jspdf';
import autoTable, { CellInput, RowInput, Styles } from 'jspdf-autotable';


interface TableHeader {
  content: string;
  styles: Partial<Styles>;
}
@Component({
  selector: 'app-livraison-view',
  templateUrl: './livraison-view.component.html',
  styleUrls: ['./livraison-view.component.css']
})
export class LivraisonViewComponent implements OnInit {
  // Propriétés
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  selectedOrder: Order | null = null;
  selectedStatus: OrderStatus = 'pending';
  isLoading: boolean = false;
  showSuccess: boolean = false;
  showError: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  searchQuery: string = '';

  statuses: OrderStatus[] = [
    'pending', 'processing', 'shipped', 'delivered', 'cancelled'
  ];

  constructor(private orderService: OrderService) {}

  ngOnInit(): void {
    this.loadOrders();
  }

loadOrders(): void {
  this.isLoading = true;
  this.orderService.getOrdersByStatus(this.selectedStatus)
    .pipe(
      map((orders: Order[]) => orders.map(this.formatOrder)) // Ajout du typage explicite
    )
    .subscribe({
      next: (orders: Order[]) => {
        this.orders = orders;
        this.filteredOrders = [...orders];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur:', err);
        this.showErrorAlert('Erreur de chargement');
        this.isLoading = false;
      }
    }); // Parenthèse fermante déplacée
}

  private formatOrder(order: Order): Order {
    return {
      ...order,
      customerName: order.customerName || 'Non spécifié',
      customerPhone: order.customerPhone || 'Non spécifié',
      items: order.items || [],
      totalAmount: order.totalAmount || 0,
      shippingFee: order.shippingFee || 0,
      grandTotal: order.grandTotal || 0,
      orderDate: order.orderDate || new Date().toISOString()
    };
  }

  // Méthodes d'interface
  onStatusChange(status: OrderStatus): void {
    this.selectedStatus = status;
    this.loadOrders();
  }

  selectOrder(order: Order): void {
    this.selectedOrder = order;
  }

  filterBySearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredOrders = [...this.orders];
      return;
    }
    
    const query = this.searchQuery.toLowerCase();
    this.filteredOrders = this.orders.filter(order =>
      order.customerName.toLowerCase().includes(query) ||
      order.id.toLowerCase().includes(query)
    );
  }

  // Génération PDF
async generateInvoice(): Promise<void> {
  if (!this.selectedOrder) {
    this.showErrorAlert('Aucune commande sélectionnée');
    return;
  }

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Couleurs de l'entreprise
    const primaryColor = '#1e4868';
    const secondaryColor = '#6c757d';
    const accentColor = '#198754';

    // ========== EN-TÊTE ==========
    // Logo - version sécurisée
    try {
      const logoUrl = 'assets/images/qstockerlogo.PNG';
      const logoData = await this.getBase64Image(logoUrl);
      doc.addImage(logoData, 'PNG', 15, 15, 40, 15);
      doc.setFontSize(16);
      doc.setTextColor(primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.text('FACTURE', 160, 25, { align: 'right' });
    } catch {
      doc.setFontSize(20);
      doc.setTextColor(primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.text('QStocker', 15, 20);
      doc.setFontSize(16);
      doc.text('FACTURE', 160, 20, { align: 'right' });
    }

    // Informations entreprise
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor);
    doc.setFont('helvetica', 'normal');
    doc.text('QStocker', 15, 30);
    doc.text('Zone touristique', 15, 35);
    doc.text('Mahdia, Tunisie', 15, 40);
    doc.text('Tél: +216 70 123 456', 15, 45);
    doc.text('Email: contact.qstocker@gmail.com', 15, 50);

    // Informations facture
    doc.text(`N° Facture: ${this.selectedOrder.id.substring(0, 8)}`, 160, 30, { align: 'right' });
    doc.text(`Date: ${new Date(this.selectedOrder.orderDate).toLocaleDateString('fr-FR')}`, 160, 35, { align: 'right' });
    doc.text(`Client ID: ${this.selectedOrder.userId?.substring(0, 6) || 'N/A'}`, 160, 40, { align: 'right' });

    // ========== TABLEAU DES ARTICLES ==========
    const headers: TableHeader[] = [
      { 
        content: 'Article', 
        styles: { 
          fillColor: primaryColor, 
          textColor: '#fff', 
          fontStyle: 'bold' as const,
          halign: 'left'
        } 
      },
      { 
        content: 'Prix unitaire', 
        styles: { 
          fillColor: primaryColor, 
          textColor: '#fff', 
          fontStyle: 'bold' as const,
          halign: 'right' as const
        } 
      },
      { 
        content: 'Qté', 
        styles: { 
          fillColor: primaryColor, 
          textColor: '#fff', 
          fontStyle: 'bold' as const,
          halign: 'center' as const
        } 
      },
      { 
        content: 'Total', 
        styles: { 
          fillColor: primaryColor, 
          textColor: '#fff', 
          fontStyle: 'bold' as const,
          halign: 'right' as const
        } 
      }
    ];

    const data: CellInput[][] = this.selectedOrder.items.map(item => [
      { 
        content: item.productName, 
        styles: { 
          fontStyle: 'bold' as const,
          halign: 'left' as const
        } 
      },
      { 
        content: `${item.unitPrice.toFixed(3)} DT`, 
        styles: { 
          halign: 'right' as const
        } 
      },
      { 
        content: item.quantity.toString(), 
        styles: { 
          halign: 'center' as const
        } 
      },
      { 
        content: `${item.totalPrice.toFixed(3)} DT`, 
        styles: { 
          halign: 'right' as const
        } 
      }
    ]);

    autoTable(doc, {
      startY: 90,
      head: [headers.map(h => h.content)],
      body: data,
      headStyles: {
        fillColor: primaryColor,
        textColor: '#fff',
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 30 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'right', cellWidth: 30 }
      },
      alternateRowStyles: {
        fillColor: '#f8f9fa'
      },
      margin: { top: 90 },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak'
      },
      didDrawPage: (data) => {
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(secondaryColor);
        doc.text(
          `Page ${data.pageNumber}`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        );
      }
    });

    // ========== TOTAUX ==========
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Cadre des totaux
    doc.setDrawColor(primaryColor);
    doc.setFillColor('#f8f9fa');
    doc.roundedRect(120, finalY, 80, 35, 2, 2, 'FD');

    // Détails des totaux
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor);
    doc.text('Sous-total:', 125, finalY + 8);
    doc.text(`${this.selectedOrder.totalAmount.toFixed(3)} DT`, 185, finalY + 8, { align: 'right' });

    doc.text('Frais de livraison:', 125, finalY + 15);
    doc.text(`${this.selectedOrder.shippingFee.toFixed(3)} DT`, 185, finalY + 15, { align: 'right' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor);
    doc.text('Total TTC:', 125, finalY + 25);
    doc.text(`${this.selectedOrder.grandTotal.toFixed(3)} DT`, 185, finalY + 25, { align: 'right' });

    // ========== PIED DE PAGE ==========
    const footerY = finalY + 40;

    doc.setFontSize(15);
    doc.setTextColor(secondaryColor);
    doc.setFont('helvetica', 'italic');
    doc.text('Merci pour votre confiance!', 125, footerY + 20);


    // ========== ENREGISTREMENT ==========
    const fileName = `Facture_${this.selectedOrder.id.substring(0, 8)}_${this.selectedOrder.customerName.replace(' ', '_')}.pdf`;
    doc.save(fileName);

    this.showSuccessAlert('Facture générée avec succès');
  } catch (err) {
    console.error('Erreur génération facture:', err);
    this.showErrorAlert('Erreur lors de la génération');
  }
}

private async addCompanyLogo(doc: jsPDF): Promise<boolean> {
  try {
    // Remplacer par l'URL de votre logo
    const logoUrl = 'assets/images/qstockerlogo.png';
    const logoData = await this.getBase64Image(logoUrl);
    
    doc.addImage(logoData, 'PNG', 15, 15, 40, 15);
    return true;
  } catch (err) {
    console.warn('Logo non chargé, continuation sans logo');
    return false;
  }
}

private getBase64Image(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Contexte canvas non disponible'));
      }
    };
    img.onerror = () => reject(new Error('Erreur chargement image'));
  });
}

  private addHeader(doc: jsPDF): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor('#1e4868');
    doc.text('Votre Entreprise', 15, 20);
    
    doc.setFontSize(12);
    doc.text('Facture', 15, 30);
    doc.text(`N°: ${this.selectedOrder!.id.substring(0, 8)}`, 15, 35);
    doc.text(`Date: ${new Date(this.selectedOrder!.orderDate).toLocaleDateString()}`, 15, 40);
  }

  private addClientInfo(doc: jsPDF): void {
    doc.setFontSize(14);
    doc.text('Client:', 15, 55);
    doc.setFontSize(12);
    doc.text(`Nom: ${this.selectedOrder!.customerName}`, 15, 60);
    doc.text(`Téléphone: ${this.selectedOrder!.customerPhone}`, 15, 65);
    if (this.selectedOrder!.customerAddress) {
      doc.text(`Adresse: ${this.selectedOrder!.customerAddress}`, 15, 70);
    }
  }

  private async addProductsTable(doc: jsPDF): Promise<void> {
    const headers = [['Article', 'Qté', 'Prix unitaire', 'Total']];
    const data = this.selectedOrder!.items.map(item => [
      item.productName,
      item.quantity.toString(),
      `${(item.totalPrice / item.quantity).toFixed(3)} DT`,
      `${item.totalPrice.toFixed(3)} DT`
    ]);
    
    autoTable(doc, {
      startY: 80,
      head: headers,
      body: data,
      theme: 'grid',
      headStyles: { fillColor: '#1e4868', textColor: '#fff' }
    });
  }

private addTotals(doc: jsPDF): void {
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text(`Sous-total: ${this.selectedOrder!.totalAmount.toFixed(3)} DT`, 140, finalY);
  doc.text(`Livraison: ${this.selectedOrder!.shippingFee.toFixed(3)} DT`, 140, finalY + 5); // Correction: shippingFee au lieu de shhippingFee
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${this.selectedOrder!.grandTotal.toFixed(3)} DT`, 140, finalY + 10);
  doc.setFont('helvetica', 'italic');
  doc.text('Merci pour votre confiance !', 105, finalY + 20, { align: 'center' });
}
  // Helpers UI
  getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'En attente',
      'processing': 'En traitement',
      'shipped': 'Expédiée',
      'delivered': 'Livrée',
      'cancelled': 'Annulée'
    };
    return statusMap[status] || status;
  }

  getStatusClass(status: string): any {
    return {
      'list-group-item-warning': status === 'pending',
      'list-group-item-info': status === 'processing',
      'list-group-item-primary': status === 'shipped',
      'list-group-item-success': status === 'delivered',
      'list-group-item-danger': status === 'cancelled'
    };
  }

  getBadgeClass(status: string): any {
    return {
      'bg-warning': status === 'pending',
      'bg-info': status === 'processing',
      'bg-primary': status === 'shipped',
      'bg-success': status === 'delivered',
      'bg-danger': status === 'cancelled'
    };
  }

  private showSuccessAlert(message: string): void {
    this.successMessage = message;
    this.showSuccess = true;
    setTimeout(() => this.showSuccess = false, 3000);
  }

  private showErrorAlert(message: string): void {
    this.errorMessage = message;
    this.showError = true;
    setTimeout(() => this.showError = false, 3000);
  }
}

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';