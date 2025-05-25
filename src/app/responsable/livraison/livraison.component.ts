import { Component, OnInit } from '@angular/core';
import { OrderService } from '../../services/order.service';
import { Order, CartItem } from 'src/app/models/order';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
@Component({
  selector: 'app-livraison',
  templateUrl: './livraison.component.html',
  styleUrls: ['./livraison.component.css']
})
export class LivraisonComponent implements OnInit {
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  selectedOrder: Order | null = null;
  selectedStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' = 'pending';
  isLoading: boolean = false;
  showSuccess: boolean = false;
  showError: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  searchQuery: string = '';

  statuses: ('pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled')[] = [
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
      map((orders: Order[]) => orders.map(order => ({
        ...order,
        customerName: order.customerName || 'Non spécifié',
        customerPhone: order.customerPhone || 'Non spécifié',
        items: order.items || [],
        totalAmount: order.totalAmount || 0,
        shippingFee: order.shippingFee || 0,
        grandTotal: order.grandTotal || 0,
        orderDate: order.orderDate || new Date().toISOString()
      })))
    )
    .subscribe({
      next: (orders: Order[]) => {
        this.orders = orders;
        this.filteredOrders = [...orders];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur de chargement:', err);
        this.isLoading = false;
        this.showErrorAlert('Erreur de chargement des commandes');
      }
    });
}

  onStatusChange(status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'): void {
    this.selectedStatus = status;
    this.loadOrders();
  }

  selectOrder(order: Order): void {
    this.selectedOrder = order;
  }

  updateOrderStatus(newStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'): void {
    if (!this.selectedOrder?.id) {
      this.showErrorAlert('Aucune commande sélectionnée');
      return;
    }

    this.isLoading = true;
    this.orderService.updateOrderStatus(this.selectedOrder.id, newStatus)
      .then(() => {
        this.showSuccessAlert(`Statut changé à "${this.getStatusText(newStatus)}"`);
        if (this.selectedOrder) {
          this.selectedOrder.status = newStatus;
        }
        this.loadOrders();
      })
      .catch(err => {
        console.error('Erreur:', err);
        this.showErrorAlert('Échec de la mise à jour');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  updateOrderStatusDirect(orderId: string, newStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'): void {
    this.isLoading = true;
    this.orderService.updateOrderStatus(orderId, newStatus)
      .then(() => {
        this.showSuccessAlert(`Statut changé à "${this.getStatusText(newStatus)}"`);
        this.loadOrders();
      })
      .catch(err => {
        console.error('Erreur:', err);
        this.showErrorAlert('Échec de la mise à jour');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  deleteOrder(orderId: string): void {
    if (!orderId) return;

    if (confirm('Êtes-vous sûr de vouloir supprimer cette commande ?')) {
      this.isLoading = true;
      this.orderService.deleteOrder(orderId)
        .then(() => {
          this.showSuccessAlert('Commande supprimée');
          if (this.selectedOrder?.id === orderId) {
            this.selectedOrder = null;
          }
          this.loadOrders();
        })
        .catch(err => {
          console.error('Erreur:', err);
          this.showErrorAlert('Échec de la suppression');
        })
        .finally(() => {
          this.isLoading = false;
        });
    }
  }

  async generateInvoice(): Promise<void> {
    if (!this.selectedOrder) {
      this.showErrorAlert('Aucune commande sélectionnée');
      return;
    }

    const doc = new jsPDF();
    
    // En-tête
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor('#1e4868');
    doc.text('QStocker', 15, 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Facture', 15, 30);
    doc.text(`N°: ${this.selectedOrder.id.substring(0, 8)}`, 15, 35);
    doc.text(`Date: ${new Date(this.selectedOrder.orderDate).toLocaleDateString()}`, 15, 40);
    
    // Informations client
    doc.setFontSize(14);
    doc.text('Client:', 15, 55);
    doc.setFontSize(12);
    doc.text(`Nom: ${this.selectedOrder.customerName}`, 15, 60);
    doc.text(`Téléphone: ${this.selectedOrder.customerPhone}`, 15, 65);
    if (this.selectedOrder.customerAddress) {
      doc.text(`Adresse: ${this.selectedOrder.customerAddress}`, 15, 70);
    }
    
    // Tableau des articles
    const headers = [['Article', 'Qté', 'Prix unitaire', 'Total']];
    const data = this.selectedOrder.items.map(item => [
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
      headStyles: {
        fillColor: '#1e4868',
        textColor: '#ffffff'
      }
    });
    
    // Totaux
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`Sous-total: ${this.selectedOrder.totalAmount.toFixed(3)} DT`, 140, finalY);
    doc.text(`Frais de livraison: ${this.selectedOrder.shippingFee.toFixed(3)} DT`, 140, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${this.selectedOrder.grandTotal.toFixed(3)} DT`, 140, finalY + 10);
    
    // Pied de page
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor('#666666');
    doc.text('Merci pour votre confiance !', 105, finalY + 20, { align: 'center' });
    
    doc.save(`facture-${this.selectedOrder.id}.pdf`);
  }

  private getDataUrlFromImage(imagePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imagePath;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          reject(new Error('Could not get canvas context'));
        }
      };
      img.onerror = () => reject(new Error('Image loading error'));
    });
  }

  filterBySearch(): void {
    if (this.searchQuery) {
      this.filteredOrders = this.orders.filter(order =>
        order.customerName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        order.id.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    } else {
      this.filteredOrders = [...this.orders];
    }
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

  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'En attente';
      case 'processing': return 'En traitement';
      case 'shipped': return 'Expédiée';
      case 'delivered': return 'Livrée';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  }
}