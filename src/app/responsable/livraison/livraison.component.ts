import { Component, OnInit } from '@angular/core';
import { OrderService } from '../../services/order.service';
import { Order } from 'src/app/models/order';
import jsPDF from 'jspdf';

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

  statuses: ('pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled')[] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

  constructor(private orderService: OrderService) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders() {
    this.isLoading = true;
    this.orderService.getOrdersByStatus(this.selectedStatus).subscribe({
      next: (orders) => {
        console.log(`Loaded orders with status ${this.selectedStatus}:`, orders);
        this.orders = orders.map(order => ({
          ...order,
          customerName: order.customerName || 'Inconnu',
          customerPhone: order.customerPhone || 'Inconnu',
          items: order.items || [],
          totalAmount: order.totalAmount || 0,
          shippingFee: order.shippingFee || 0,
          grandTotal: order.grandTotal || 0,
          orderDate: order.orderDate || new Date().toISOString(),
          status: order.status || 'pending'
        }));
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur de chargement:', err);
        this.isLoading = false;
        this.showErrorAlert('Erreur de chargement des commandes');
      }
    });
  }

  onStatusChange(status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled') {
    this.selectedStatus = status;
    this.loadOrders();
  }

  selectOrder(order: Order) {
    this.selectedOrder = order;
  }

  updateOrderStatus(newStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled') {
    if (!this.selectedOrder?.id) {
      this.showErrorAlert('Aucune commande sélectionnée');
      return;
    }

    if (this.selectedOrder.status === newStatus) {
      this.showErrorAlert('La commande est déjà dans ce statut');
      return;
    }

    this.isLoading = true;
    this.orderService.updateOrderStatus(this.selectedOrder.id, newStatus)
      .then(() => {
        console.log(`Status updated to ${newStatus}`);
        this.showSuccessAlert(`Statut changé à "${this.getStatusText(newStatus)}"`);
        this.selectedOrder!.status = newStatus;
        this.selectedOrder = null;
        this.loadOrders();
      })
      .catch(err => {
        console.error('Erreur:', err);
        this.showErrorAlert(err.message || 'Échec de la mise à jour');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  updateOrderStatusDirect(orderId: string, newStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled') {
    this.isLoading = true;
    this.orderService.updateOrderStatus(orderId, newStatus)
      .then(() => {
        this.showSuccessAlert(`Statut changé à "${this.getStatusText(newStatus)}"`);
        this.loadOrders();
      })
      .catch(err => {
        console.error('Erreur:', err);
        this.showErrorAlert(err.message || 'Échec de la mise à jour');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  deleteOrder(orderId: string) {
    if (!orderId) return;

    if (confirm('Êtes-vous sûr de vouloir supprimer cette commande ?')) {
      this.isLoading = true;
      this.orderService.deleteOrder(orderId)
        .then(() => {
          this.showSuccessAlert('Commande supprimée');
          this.loadOrders(); // Rafraîchir les commandes après la suppression
          if (this.selectedOrder?.id === orderId) {
            this.selectedOrder = null;
          }
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

  filterByDate(event: Event) {
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

  searchQuery: string = '';

  filterBySearch() {
    if (this.searchQuery) {
      this.orders = this.orders.filter(order =>
        order.customerName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        order.id.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    } else {
      this.loadOrders();
    }
  }

  generateInvoice() {
    if (!this.selectedOrder) {
      this.showErrorAlert('Aucune commande sélectionnée');
      return;
    }

    const doc = new jsPDF();

    // Add title
    doc.setFontSize(20);
    doc.text('Facture', 105, 20, { align: 'center' });

    // Add order details
    doc.setFontSize(12);
    doc.text(`Commande #${this.selectedOrder.id.substring(0, 8)}`, 20, 40);
    doc.text(`Date: ${new Date(this.selectedOrder.orderDate).toLocaleDateString()}`, 20, 50);
    doc.text(`Client: ${this.selectedOrder.customerName}`, 20, 60);
    doc.text(`Téléphone: ${this.selectedOrder.customerPhone}`, 20, 70);

    // Add table headers
    doc.text('Article', 20, 90);
    doc.text('Prix unitaire', 70, 90);
    doc.text('Quantité', 120, 90);
    doc.text('Total', 170, 90);

    // Add table rows
    let y = 100;
    this.selectedOrder.items.forEach(item => {
      doc.text(item.productName, 20, y);
      doc.text(`${item.unitPrice} DT`, 70, y);
      doc.text(item.quantity.toString(), 120, y);
      doc.text(`${item.totalPrice} DT`, 170, y);
      y += 10;
    });

    // Add totals
    doc.text(`Sous-total: ${this.selectedOrder.totalAmount} DT`, 20, y + 20);
    doc.text(`Frais de livraison: ${this.selectedOrder.shippingFee} DT`, 20, y + 30);
    doc.text(`Total: ${this.selectedOrder.grandTotal} DT`, 20, y + 40);

    // Save the PDF
    doc.save(`facture-${this.selectedOrder.id}.pdf`);
  }

  private showSuccessAlert(message: string) {
    this.successMessage = message;
    this.showSuccess = true;
    setTimeout(() => this.showSuccess = false, 3000);
  }

  private showErrorAlert(message: string) {
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
