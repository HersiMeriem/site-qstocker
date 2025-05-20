import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { map } from 'rxjs/operators';
import { CartItem, Order } from '../models/order';
import { StockService } from './stock.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(private db: AngularFireDatabase ,     private stockService: StockService) {}

 getOrdersByStatus(status: string) {
    return this.db.list<Order>('orders', ref =>
      ref.orderByChild('status').equalTo(status)
    ).snapshotChanges().pipe(
      map(changes =>
        changes
          .filter(c => c.payload.key !== null && c.payload.val() !== null)
          .map(c => {
            const val = c.payload.val()!;
            return {
              id: c.payload.key!,
              customerName: val.customerName || '',
              customerPhone: val.customerPhone || '',
              customerAddress: val.customerAddress,
              customerNotes: val.customerNotes,
              items: val.items || [],
              totalAmount: val.totalAmount || 0,
              shippingFee: val.shippingFee || 0,
              grandTotal: val.grandTotal || 0,
              orderDate: val.orderDate || new Date().toISOString(),
              status: val.status || 'pending',
              paymentMethod: val.paymentMethod || 'on_delivery',
              userId: val.userId || ''
            };
          })
      )
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

        // Si la commande passe à "livré", on diminue le stock
        if (newStatus === 'delivered' && previousStatus !== 'delivered') {
            for (const item of order.items) {
                await this.stockService.updateStockQuantity(item.productId, -item.quantity);
            }
        }
        // Si une commande livrée est annulée, on réajoute le stock
        else if (newStatus === 'cancelled' && previousStatus === 'delivered') {
            for (const item of order.items) {
                await this.stockService.updateStockQuantity(item.productId, item.quantity);
            }
        }
        // Si une commande annulée est relivrée (cas rare), on diminue à nouveau le stock
        else if (newStatus === 'delivered' && previousStatus === 'cancelled') {
            for (const item of order.items) {
                await this.stockService.updateStockQuantity(item.productId, -item.quantity);
            }
        }

        // Mise à jour du statut de la commande
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
}