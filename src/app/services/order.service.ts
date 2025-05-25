import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { map } from 'rxjs/operators';
import { CartItem, Order } from '../models/order';
import { StockService } from './stock.service';
import { NotificationService } from './notification.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(
    private db: AngularFireDatabase,
    private stockService: StockService,
    private notificationService: NotificationService
  ) {}

 getOrdersByStatus(status: string): Observable<Order[]> {
    return this.db.list<Order>('orders', ref =>
      ref.orderByChild('status').equalTo(status)
    ).valueChanges().pipe(
      map(orders => orders.map(order => ({
        ...order,
        orderDate: order.orderDate || new Date().toISOString()
      })))
    );
  }

  async updateOrderStatus(orderId: string, newStatus: string): Promise<void> {
    if (!orderId) {
      throw new Error('ID de commande invalide');
    }

    try {
      const snapshot = await this.db.object(`orders/${orderId}`).query.once('value');
      const order = snapshot.val();

      if (!order) {
        throw new Error('Commande non trouvée');
      }

      const previousStatus = order.status;

      // Diminuer le stock seulement quand le statut passe à "livré"
      if (newStatus === 'delivered' && previousStatus !== 'delivered') {
        for (const item of order.items) {
          await this.stockService.retirerDuStock({
            productId: item.productId,
            quantity: item.quantity,
            reason: 'order_delivery'
          });
        }

        // Envoyer une notification de livraison
        await this.notificationService.createNotification({
          title: 'Commande livrée',
          message: `La commande #${orderId.substring(0, 8)} a été livrée avec succès au client ${order.customerName}`,
          type: 'success',
          priority: 'high'
        });
      }

      // Si la commande était livrée et est annulée, remettre le stock
      if (newStatus === 'cancelled' && previousStatus === 'delivered') {
        for (const item of order.items) {
          await this.stockService.ajouterAuStock({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          });
        }
      }

      if (newStatus !== previousStatus) {
        const statusText = this.getStatusText(newStatus);
        await this.notificationService.createNotification({
          title: `Statut de commande mis à jour`,
          message: `La commande #${orderId.substring(0, 8)} est maintenant "${statusText}"`,
          type: 'info',
          priority: 'medium'
        });
      }

      // Mise à jour du statut
      await this.db.object(`orders/${orderId}/status`).set(newStatus);
      await this.db.object(`orders/${orderId}/lastUpdated`).set(new Date().toISOString());
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      throw error;
    }
  }

  deleteOrder(orderId: string): Promise<void> {
    return this.db.object(`orders/${orderId}`).remove();
  }

  private getStatusText(status: string): string {
    switch(status) {
      case 'pending': return 'En attente';
      case 'processing': return 'En traitement';
      case 'shipped': return 'Expédiée';
      case 'delivered': return 'Livrée';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  }
}
