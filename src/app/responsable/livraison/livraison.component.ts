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

async generateInvoice(): Promise<void> {
  if (!this.selectedOrder) {
    this.showErrorAlert('Aucune commande sélectionnée');
    return;
  }

  const doc = new jsPDF();
  const logoUrl = await this.getDataUrlFromImage('assets/images/qstocker.png');

  // Dimensions utiles
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 20;
  const rightMargin = 190;

  // === En-tête ===
  if (logoUrl) {
    doc.addImage(logoUrl, 'PNG', leftMargin, 15, 20, 12);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor('#1e4868');
  doc.text('Q', leftMargin, 30);
  doc.setTextColor('#548CB8');
  doc.text('Stocker', leftMargin + 4, 30);

  // Coordonnées magasin à droite
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor('#000000');
  doc.text('Email: contact.qstocker@gmail.com', rightMargin - 70, 20);
  doc.text('Téléphone: +1234567890', rightMargin - 70, 28);
  doc.text('Adresse: Sfax', rightMargin - 70, 36);

  // Titre "FACTURE"
  doc.setFontSize(24);
  doc.setTextColor('#1e4868');
  doc.text('FACTURE', pageWidth / 2, 55, { align: 'center' });

  // Ligne de séparation
  doc.setDrawColor('#548CB8');
  doc.setLineWidth(1);
  doc.line(leftMargin, 60, rightMargin, 60);

  // Informations de commande
  doc.setFontSize(12);
  doc.setTextColor('#000');
  doc.text(`Commande #: ${this.selectedOrder.id.substring(0, 8)}`, leftMargin, 70);
  doc.text(`Date: ${new Date(this.selectedOrder.orderDate).toLocaleDateString()}`, leftMargin, 80);
  doc.text(`Client: ${this.selectedOrder.customerName}`, leftMargin, 90);
  doc.text(`Téléphone: ${this.selectedOrder.customerPhone}`, leftMargin, 100);

  // Ligne de séparation
  doc.setDrawColor('#eeeeee');
  doc.line(leftMargin, 105, rightMargin, 105);

  // En-tête tableau produits
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor('#1e4868');
  doc.text('Articles', leftMargin, 115);

  // Tableau entête
  doc.setFillColor('#f0f7fc');
  doc.rect(leftMargin, 120, 170, 8, 'F');
  doc.setDrawColor('#cccccc');
  doc.rect(leftMargin, 120, 170, 8, 'D');

  doc.setFontSize(11);
  doc.setTextColor('#000000');
  doc.text('Produit', leftMargin + 2, 126);
  doc.text('Qté', 90, 126);
  doc.text('Prix', 120, 126);
  doc.text('Total', 160, 126);

  let y = 135;

  // Liste des articles
  this.selectedOrder.items.forEach((item, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    // Alternance de couleur pour chaque ligne
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(leftMargin, y - 5, 170, 8, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#000');
    doc.text(item.productName, leftMargin + 2, y);
    doc.text(`${item.quantity}`, 90, y);
    doc.text(`${(item.totalPrice / item.quantity).toFixed(2)} DT`, 120, y);
    doc.text(`${item.totalPrice.toFixed(2)} DT`, 160, y);

    y += 10;
  });

  // Ligne de séparation avant les totaux
  doc.setDrawColor('#dddddd');
  doc.line(leftMargin, y, rightMargin, y);
  y += 10;

  // Totaux
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor('#000');
  doc.text(`Sous-total:`, rightMargin - 60, y);
  doc.text(`${this.selectedOrder.totalAmount.toFixed(2)} DT`, rightMargin - 10, y, { align: 'right' });
  y += 10;

  doc.text(`Frais de livraison:`, rightMargin - 60, y);
  doc.text(`${this.selectedOrder.shippingFee.toFixed(2)} DT`, rightMargin - 10, y, { align: 'right' });
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor('#1e4868');
  doc.text(`Total:`, rightMargin - 60, y);
  doc.text(`${this.selectedOrder.grandTotal.toFixed(2)} DT`, rightMargin - 10, y, { align: 'right' });
  y += 20;

  // Message final
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor('#548CB8');
  doc.text('Merci pour votre confiance !', pageWidth / 2, y, { align: 'center' });

  // Sauvegarder le PDF
  doc.save(`facture-${this.selectedOrder.id}.pdf`);
}


  private getDataUrlFromImage(imagePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fetch(imagePath)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          console.error('Erreur lors du chargement de l\'image:', error);
          reject(error);
        });
    });
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
