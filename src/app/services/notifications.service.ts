import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable, of, Subject } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { StockService } from './stock.service';
import { SaleService } from './sale.service';

export interface AppNotification {
  id?: string;
  title: string;
  message: string;
  type: 'stock-out' | 'low-stock' | 'sale' | 'system';
  productId?: string;
  read: boolean;
  timestamp: string;
  priority?: 'low' | 'medium' | 'high';
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private unreadCountSubject = new Subject<number>();
  unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(
    private db: AngularFireDatabase,
    private afAuth: AngularFireAuth,
    private stockService: StockService,
    private saleService: SaleService
  ) {
    this.monitorStockChanges();
    this.monitorSales();
  }

  // Surveiller les changements de stock pour générer des notifications
  private monitorStockChanges(): void {
    this.stockService.getRealTimeStock().subscribe(products => {
      products.forEach(product => {
        if (product.quantite <= 0) {
          this.checkAndCreateStockNotification(product, 'stock-out', 'Rupture de stock', 
            `Le produit ${product.nomProduit} est en rupture de stock`);
        } else if (product.quantite <= (product.seuil || 5)) {
          this.checkAndCreateStockNotification(product, 'low-stock', 'Stock faible', 
            `Le produit ${product.nomProduit} est presque en rupture (${product.quantite} restants)`);
        }
      });
    });
  }

  // Surveiller les ventes pour les notifications
  private monitorSales(): void {
    this.saleService.getRecentSales(10).subscribe(sales => {
      // Vous pourriez ajouter ici une logique pour notifier des ventes importantes
    });
  }

  // Créer une notification de stock si elle n'existe pas déjà
  private async checkAndCreateStockNotification(
    product: any, 
    type: 'stock-out' | 'low-stock',
    title: string,
    message: string
  ): Promise<void> {
    const existing = await this.db.database.ref('notifications')
      .orderByChild('productId')
      .equalTo(product.idProduit)
      .once('value');

    if (!existing.exists() || 
        (existing.exists() && 
         Object.values(existing.val()).some((n: any) => n.type !== type))) {
      this.createNotification({
        title,
        message,
        type,
        productId: product.idProduit,
        priority: type === 'stock-out' ? 'high' : 'medium'
      });
    }
  }

  // Créer une notification générique
  async createNotification(notification: Omit<AppNotification, 'id' | 'read' | 'timestamp'>): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) return;

    const newNotification: AppNotification = {
      ...notification,
      read: false,
      timestamp: new Date().toISOString()
    };

    await this.db.list('notifications').push(newNotification);
    this.updateUnreadCount();
  }

  // Récupérer toutes les notifications de l'utilisateur
  getNotifications(): Observable<AppNotification[]> {
    return this.afAuth.authState.pipe(
      switchMap(user => {
        if (!user) return of([]);
        
        return this.db.list<AppNotification>('notifications', ref => 
          ref.orderByChild('timestamp')
        ).valueChanges().pipe(
          map(notifs => notifs
            .filter(n => !n.read)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          )
        );
      })
    );
  }

  // Marquer une notification comme lue
  async markAsRead(notificationId: string): Promise<void> {
    await this.db.object(`notifications/${notificationId}/read`).set(true);
    this.updateUnreadCount();
  }

  // Marquer toutes les notifications comme lues
  async markAllAsRead(): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) return;

    const snapshot = await this.db.database.ref('notifications')
      .orderByChild('read')
      .equalTo(false)
      .once('value');

    if (snapshot.exists()) {
      const updates: any = {};
      Object.keys(snapshot.val()).forEach(key => {
        updates[`notifications/${key}/read`] = true;
      });
      await this.db.database.ref().update(updates);
      this.updateUnreadCount();
    }
  }

  // Supprimer toutes les notifications
  async clearAll(): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) return;

    await this.db.list('notifications').remove();
    this.updateUnreadCount();
  }

  // Mettre à jour le compteur de notifications non lues
  private async updateUnreadCount(): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) return;

    const snapshot = await this.db.database.ref('notifications')
      .orderByChild('read')
      .equalTo(false)
      .once('value');

    this.unreadCountSubject.next(snapshot.exists() ? Object.keys(snapshot.val()).length : 0);
  }

  // Écouter les changements de statut de stock pour les notifications
  listenForStockChanges(): void {
    this.stockService.getRealTimeStock().pipe(
      take(1)
    ).subscribe(products => {
      products.forEach(product => {
        if (product.quantite <= 0) {
          this.createNotification({
            title: 'Rupture de stock',
            message: `Le produit ${product.nomProduit} est en rupture de stock`,
            type: 'stock-out',
            productId: product.idProduit,
            priority: 'high'
          });
        }
      });
    });
  }
}