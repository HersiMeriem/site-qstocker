import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { map } from 'rxjs/operators';
import { Order } from '../models/order';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(private db: AngularFireDatabase) {}

  runAllChecks() {
    // Implémentez cette méthode
    console.log('Running all checks...');
  }
  
  getOrdersByStatus(status: string) {
    return this.db.list<Order>('orders', ref =>
      ref.orderByChild('status').equalTo(status)
    ).snapshotChanges().pipe(
      map(changes =>
        changes.map(c => ({
          id: c.payload.key!,
          ...c.payload.val() as Omit<Order, 'id'>
        }))
      )
    );
  }


updateOrderStatus(orderId: string, newStatus: string): Promise<void> {
  console.log(`Updating order ${orderId} to status ${newStatus}`);
  return this.db.object(`orders/${orderId}`).update({ status: newStatus })
    .then(() => {
      console.log(`Successfully updated order ${orderId} to status ${newStatus}`);
    })
    .catch(err => {
      console.error(`Failed to update order ${orderId}:`, err);
      throw err;
    });
}

deleteOrder(orderId: string): Promise<void> {
  if (!orderId) {
    return Promise.reject('ID de commande invalide');
  }
  console.log(`Deleting order ${orderId}`);
  return this.db.object(`orders/${orderId}`).remove()
    .then(() => {
      console.log(`Successfully deleted order ${orderId}`);
    })
    .catch(err => {
      console.error(`Failed to delete order ${orderId}:`, err);
      throw err;
    });
}




}