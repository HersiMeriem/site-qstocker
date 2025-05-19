import { Component, OnInit } from '@angular/core';
import { OrderService } from '../../services/order.service';
import { Order, CartItem } from 'src/app/models/order';
import jsPDF from 'jspdf';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-livraison',
  templateUrl: './livraison.component.html',
  styleUrls: ['./livraison.component.css']
})
export class LivraisonComponent implements OnInit {
  orders: Order[] = [];
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
        map(orders => orders.map(order => ({
          ...order,
          customerName: order.customerName || 'Non spécifié',
          customerPhone: order.customerPhone || 'Non spécifié',
          items: order.items || [],
          totalAmount: order.totalAmount || 0,
          shippingFee: order.shippingFee || 0,
          grandTotal: order.grandTotal || 0
        })))
      )
      .subscribe({
        next: (orders) => {
          this.orders = orders;
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

  generateInvoice(): void {
    if (!this.selectedOrder) {
      this.showErrorAlert('Aucune commande sélectionnée');
      return;
    }

    const doc = new jsPDF();
    
    // En-tête
    doc.setFontSize(20);
    doc.text('Facture', 105, 20, { align: 'center' });
    
    // Détails de la commande
    doc.setFontSize(12);
    doc.text(`Commande #${this.selectedOrder.id.substring(0, 8)}`, 20, 40);
    doc.text(`Date: ${new Date(this.selectedOrder.orderDate).toLocaleDateString()}`, 20, 50);
    doc.text(`Client: ${this.selectedOrder.customerName}`, 20, 60);
    doc.text(`Téléphone: ${this.selectedOrder.customerPhone}`, 20, 70);

    // Articles
    let y = 90;
    doc.text('Articles:', 20, y);
    y += 10;
    
    this.selectedOrder.items.forEach(item => {
      doc.text(`${item.productName} (x${item.quantity}) - ${item.totalPrice} DT`, 20, y);
      y += 10;
    });

    // Total
    y += 10;
    doc.text(`Sous-total: ${this.selectedOrder.totalAmount} DT`, 20, y);
    y += 10;
    doc.text(`Frais de livraison: ${this.selectedOrder.shippingFee} DT`, 20, y);
    y += 10;
    doc.text(`Total: ${this.selectedOrder.grandTotal} DT`, 20, y);

    doc.save(`facture-${this.selectedOrder.id}.pdf`);
  }

  filterBySearch(): void {
    if (this.searchQuery) {
      this.orders = this.orders.filter(order =>
        order.customerName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        order.id.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    } else {
      this.loadOrders();
    }
  }

  filterByDate(event: Event): void {
    const date = (event.target as HTMLInputElement).value;
    if (date) {
      this.orders = this.orders.filter(order => {
        const orderDate = new Date(order.orderDate).toISOString().split('T')[0];
        return orderDate === date;
      });
    } else {
      this.loadOrders();
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