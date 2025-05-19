import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { map } from 'rxjs/operators';
import { Order } from '../models/order';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(private db: AngularFireDatabase) {}

getOrdersByStatus(status: string) {
    return this.db.list<Order>('orders', ref =>
      ref.orderByChild('status').equalTo(status)
    ).snapshotChanges().pipe(
      map(changes =>
        changes
          .filter(c => c.payload.key !== null && c.payload.val() !== null)
          .map(c => {
            const val = c.payload.val()!; // ! pour indiquer que val n'est pas null
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
      // Récupère la commande existante
      const snapshot = await this.db.object(`orders/${orderId}`).query.once('value');
      const order = snapshot.val();

      if (!order) {
        throw new Error('Commande non trouvée');
      }

      // Met à jour seulement le statut
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