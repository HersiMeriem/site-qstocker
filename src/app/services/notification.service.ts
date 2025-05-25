import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable, of, Subject } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { StockService } from './stock.service';
import { SaleService } from './sale.service';


export type NotificationType = 'stock-out' | 'low-stock' | 'sale' | 'system' | 'success' | 'error' | 'info' | 'product-sold';
export interface AppNotification {
  id?: string;
  title: string;
  message: string;
  type: NotificationType;  
  productId?: string;
  productName?: string;
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
  notification$!: Observable<AppNotification>;
  error: any;
  success: any;
  stockService: any;
  private notificationsPath = '/notifications';  
  notificationsSubject: any;

constructor(
    private db: AngularFireDatabase,
    private afAuth: AngularFireAuth
  ) {
    this.afAuth.authState.subscribe(user => {
      if (user) this.updateUnreadCount();
    });
  }


    private initNotifications(): void {
    this.afAuth.authState.pipe(
      switchMap(user => {
        if (!user) return of([]);
        return this.db.list<AppNotification>(this.notificationsPath, ref => 
          ref.orderByChild('timestamp')
        ).valueChanges().pipe(
          tap(notifs => {
            this.notificationsSubject.next(notifs);
            this.updateUnreadCount(notifs);
          })
        );
      })
    ).subscribe();
  }

  

async createNotification(notification: {
  title: string;
  message: string;
  type: NotificationType;
  productId?: string;
  productName?: string;
  priority?: 'low' | 'medium' | 'high';
}): Promise<void> {
  const user = await this.afAuth.currentUser;
  if (!user) return;

  const newNotif: AppNotification = {
    ...notification,
    read: false,
    timestamp: new Date().toISOString()
  };

  await this.db.list('notifications').push(newNotif);
  this.updateUnreadCount();
}


  private async updateUnreadCount(notifs?: AppNotification[]): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) return;

    const snapshot = await this.db.database.ref('notifications')
      .orderByChild('read')
      .equalTo(false)
      .once('value');

    const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    console.log('Nombre de notifications non lues:', count); // ← Log de vérification
    this.unreadCountSubject.next(count);
  }



  // Surveillance automatique du stock
  private monitorStockChanges(): void {
    this.stockService.getRealTimeStock().subscribe(products => {
      products.forEach(product => {
        if (product.quantite <= 0) {
          this.checkAndCreateStockNotification(
            product, 
            'stock-out', 
            'Rupture de stock', 
            `Le produit ${product.nomProduit} est en rupture de stock`
          );
        } else if (product.quantite <= (product.seuil || 5)) {
          this.checkAndCreateStockNotification(
            product, 
            'low-stock', 
            'Stock faible', 
            `Le produit ${product.nomProduit} est presque en rupture (${product.quantite} restants)`
          );
        }
      });
    });
  }

 

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


  async markAsRead(notificationId: string): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) return;

      // Correction importante: utilisation de la bonne référence
      await this.db.object(`notifications/${notificationId}`).update({ read: true });
      this.updateUnreadCount();
    } catch (err) {
      console.error('Error marking notification as read:', err);
      throw err;
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) return;

      // Correction importante: suppression par le bon ID
      await this.db.object(`notifications/${notificationId}`).remove();
      this.updateUnreadCount();
    } catch (err) {
      console.error('Error deleting notification:', err);
      throw err;
    }
  }

  getNotifications(): Observable<any[]> {
    return this.afAuth.authState.pipe(
      switchMap(user => {
        if (!user) return of([]);
        
        return this.db.list('notifications', ref => 
          ref.orderByChild('timestamp')
        ).snapshotChanges().pipe(
          map(changes => 
            changes.map(c => ({ 
              id: c.key, // IMPORTANT: On récupère bien l'ID Firebase
              ...c.payload.val() as any 
            }))
          ),
          map(notifs => notifs.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        ));
      })
    );
  }

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

  async clearAll(): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user) return;

    await this.db.list('notifications').remove();
    this.updateUnreadCount();
  }
}
