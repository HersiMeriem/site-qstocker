import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { SaleService } from './sale.service';
import { StockService } from './stock.service';
import { NotificationService, NotificationType } from './notification.service';
import { map, catchError, take } from 'rxjs/operators';
import { combineLatest, Observable, of } from 'rxjs';
import { StockItem } from '../models/stock-items';

interface Activity {
  type: 'sales' | 'stock' | 'alerts' | 'system';
  icon: string;
  message: string;
  time: Date;
  user?: string;
  location?: string;
  product?: {
    idProduit: string;
    nomProduit: string;
  };
  amount?: number;
  stockData?: {
    totalProducts: number;
    totalStock: number;
  };
  actions?: Array<{
    label: string;
    action: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  constructor(
    private db: AngularFireDatabase,
    private saleService: SaleService,
    private stockService: StockService,
    private notificationService: NotificationService
  ) {}

  getRecentActivities(): Observable<Activity[]> {
    return combineLatest([
      this.saleService.getRecentSales().pipe(take(1)), // Limite à une seule émission
      this.stockService.getStockMovements().pipe(take(1)), // Limite à une seule émission
      this.getNotificationActivities().pipe(take(1)) // Limite à une seule émission
    ]).pipe(
      map(([sales, movements, notifications]) => {
        // Convertir les ventes en activités
        const salesActivities = sales.map(sale => ({
          type: 'sales' as const,
          icon: 'shopping_cart',
          message: Vente #${sale.invoiceNumber},
          time: new Date(sale.date),
          amount: sale.totalAmount,
          user: sale.customerName || 'Anonyme',
          product: sale.items[0] ? {
            idProduit: sale.items[0].productId,
            nomProduit: sale.items[0].name
          } : undefined,
          actions: [
            { label: 'Voir détails', action: 'viewSaleDetails' }
          ]
        }));

        // Convertir les mouvements de stock en activités
        const stockActivities = movements.map((movement: any) => ({
          type: 'stock' as const,
          icon: this.getStockMovementIcon(movement.type),
          message: this.getStockMovementMessage(movement),
          time: new Date(movement.date || new Date().toISOString()),
          amount: movement.quantity * (movement.unitPrice || 0),
          product: {
            idProduit: movement.productId,
            nomProduit: movement.productName || movement.product?.nomProduit || 'Produit'
          },
          actions: [
            { label: 'Historique', action: 'viewStockHistory' }
          ]
        }));

        // Combiner toutes les activités
        const allActivities = [...salesActivities, ...stockActivities, ...notifications];

        return allActivities
          .sort((a, b) => b.time.getTime() - a.time.getTime())
          .slice(0, 50); // Augmentez la limite si nécessaire
      }),
      catchError(error => {
        console.error('Error in activity service:', error);
        return of([]);
      })
    );
  }

  getNotificationActivities(): Observable<Activity[]> {
    return this.notificationService.getNotifications().pipe(
      map((notifications: any[]) => {
        return notifications.map(notification => ({
          type: 'alerts' as const,
          icon: this.getNotificationIcon(notification.type),
          message: ${notification.title}: ${notification.message},
          time: new Date(notification.timestamp),
          product: notification.productId ? {
            idProduit: notification.productId,
            nomProduit: notification.productName || notification.message.split(' ')[2] || 'Produit'
          } : undefined,
          actions: [
            { label: 'Voir détails', action: 'viewDetails' }
          ]
        }));
      })
    );
  }

  private addActivity(activity: Activity): void {
    // Ajouter l'activité à la base de données
    this.db.list('/activities').push(activity);
  }

  logActivity(
    message: string,
    type: 'sales' | 'stock' | 'alerts' | 'system' = 'system',
    user?: string,
    product?: any,
    amount?: number,
    stockData?: {
      totalProducts: number;
      totalStock: number;
    }
  ) {
    const newActivity: Activity = {
      type,
      icon: this.getIconForType(type),
      message,
      time: new Date(),
      user: user || 'Système',
      product,
      amount,
      stockData
    };
    this.addActivity(newActivity);
    return of(newActivity);
  }

  private getIconForType(type: string): string {
    const icons = {
      'sales': 'shopping_cart',
      'stock': 'inventory',
      'alerts': 'warning',
      'system': 'info'
    };
    return icons[type] || 'info';
  }

  private getStockMovementIcon(type: string): string {
    const icons: {[key: string]: string} = {
      'ajout': 'add_circle',
      'retrait': 'remove_circle',
      'ajustement': 'build',
      'inventory': 'inventory_2',
      'transfer': 'swap_horiz'
    };
    return icons[type] || 'info';
  }

  private getStockMovementMessage(movement: any): string {
    const actions: {[key: string]: string} = {
      'ajout': 'Réapprovisionnement',
      'retrait': 'Sortie de stock',
      'ajustement': 'Ajustement de stock',
      'inventory': 'Inventaire',
      'transfer': 'Transfert'
    };

    const productName = movement.productName || 'Produit';
    const quantity = movement.quantity || 0;
    const unit = quantity > 1 ? 'unités' : 'unité';

    return ${actions[movement.type] || 'Mouvement'} - ${productName} (${quantity} ${unit});
  }

  logStockOutActivity(product: StockItem) {
    const activity: Activity = {
      type: 'alerts',
      icon: 'warning',
      message: 'Produit en rupture de stock',
      time: new Date(),
      product: {
        idProduit: product.idProduit,
        nomProduit: product.nomProduit
      }
    };
    this.addActivity(activity);
  }

  private getNotificationIcon(type: NotificationType): string {
    const icons = {
      'stock-out': 'warning',
      'low-stock': 'warning',
      'sale': 'shopping_cart',
      'system': 'info',
      'success': 'check_circle',
      'error': 'error',
      'info': 'info',
      'product-sold': 'attach_money'
    };
    return icons[type] || 'notifications';
  }
}