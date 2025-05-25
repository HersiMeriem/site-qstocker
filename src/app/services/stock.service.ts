import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { firstValueFrom } from 'rxjs';
import { SnapshotAction } from '@angular/fire/compat/database/interfaces';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ProductService } from './product.service';
import { NotificationService } from './notification.service';

export interface StockItem {
  originalPrice: number;
  editingPrice: any;
  idProduit: string;
  nomProduit: string;
  quantite: number;
  prixUnitaireHT: number;
  prixDeVente: number;
  seuil: number;
  demandPrevue?: number;
  dateMiseAJour: string;
  historiquePrix?: Array<{
    date: string;
    prix: number;
    quantiteAjoutee: number;
  }>;
  qrCode?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  status: 'active' | 'inactive' | 'promotion' | 'out-of-stock';
  promotion?: Promotion | null;
  category?: string;
}

export interface Promotion {
  startDate: string;
  endDate: string;
  discountPercentage: number;
}

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private stockPath = '/stock';
  private movementsPath = '/stock-movements';

  constructor(
    private db: AngularFireDatabase,
    private productService: ProductService,
    private notificationService: NotificationService
  ) {}

  async processSupplierOrder(order: any): Promise<void> {
    try {
      await this.ajouterAuStock({
        productId: order.productId,
        productName: order.productName,
        quantity: order.quantity,
        unitPrice: order.unitPrice
      });

      await this.db.list('/order-logs').push({
        ...order,
        type: 'approvisionnement',
        date: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erreur globale:', error);
      throw new Error('Échec du traitement de la commande');
    }
  }

  private async logStockMovement(movement: {
    productId: string;
    type: 'ajout' | 'retrait' | 'ajustement';
    quantity: number;
    previousQuantity: number;
    date: string;
    reason: string;
  }): Promise<void> {
    try {
      await this.db.list(this.movementsPath).push(movement);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du mouvement:', error);
    }
  }

  getStockMovements(): Observable<any[]> {
    return this.db.list(this.movementsPath)
      .valueChanges()
      .pipe(
        map((movements: any[]) =>
          movements.sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        )
      );
  }

  getStockReport(): Observable<any> {
    return this.getStock().pipe(
      map(stock => {
        const totalValue = stock.reduce((sum, item) =>
          sum + (item.quantite * item.prixUnitaireHT), 0);

        return {
          totalProducts: stock.length,
          totalItems: stock.reduce((sum, item) => sum + item.quantite, 0),
          totalValue,
          lowStock: stock.filter(item => item.quantite < (item.seuil || 10)).length,
          lastUpdated: new Date().toISOString()
        };
      })
    );
  }

  getStockHistoryReport(): Observable<any> {
    return this.getStockMovements().pipe(
      map(movements => {
        const today = new Date().toISOString().split('T')[0];
        const recent = movements.filter(m => m.date && m.date.toString().startsWith(today));

        return {
          todayMovements: recent.length,
          lastMovements: movements.slice(0, 10),
          movementTypes: {
            additions: movements.filter(m => m.type === 'ajout').length,
            removals: movements.filter(m => m.type === 'retrait').length
          }
        };
      })
    );
  }

  async updateStock(productId: string, updateData: Partial<StockItem>): Promise<void> {
    try {
      if (!productId) throw new Error('ID produit manquant');

      const ref = this.db.object<StockItem>(${this.stockPath}/${productId});
      const snapshot = await firstValueFrom(ref.valueChanges());

      if (!snapshot) {
        throw new Error('Produit non trouvé dans le stock');
      }

      await ref.update({
        ...updateData,
        dateMiseAJour: new Date().toISOString()
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur de mise à jour:', {
        productId,
        updateData,
        errorMessage
      });
      throw new Error(Échec de la mise à jour: ${errorMessage});
    }
  }

  getProductStockQuantity(productId: string): Observable<number> {
    return this.db.object<StockItem>(${this.stockPath}/${productId})
      .valueChanges()
      .pipe(
        map((stock: StockItem | null) => stock?.quantite || 0),
        catchError(() => of(0))
      );
  }

  async ajouterAuStock(commande: {
    productId: string;
    quantity: number;
    unitPrice: number;
    productName?: string;
    qrCode?: string | null;
    imageUrl?: string | null;
    description?: string | null;
  }): Promise<StockItem> {
    try {
      const stockRef = this.db.object<StockItem>(${this.stockPath}/${commande.productId});
      const snapshot = await firstValueFrom(stockRef.snapshotChanges()) as SnapshotAction<StockItem>;
      const currentData = snapshot.payload.val() || {
        idProduit: commande.productId,
        nomProduit: commande.productName || 'Nouveau produit',
        quantite: 0,
        prixUnitaireHT: 0,
        prixDeVente: commande.unitPrice * 1.2,
        dateMiseAJour: new Date().toISOString(),
        historiquePrix: [],
        qrCode: commande.qrCode || null,
        imageUrl: commande.imageUrl || null,
        description: commande.description || null,
        seuil: 10,
        status: 'active',
        originalPrice: commande.unitPrice * 1.2,
        editingPrice: false,
        promotion: undefined
      };

      // Calcul du nouveau prix moyen pondéré
      const ancienTotalValeur = currentData.prixUnitaireHT * currentData.quantite;
      const nouvelleValeurAjoutee = commande.unitPrice * commande.quantity;
      const nouvelleQuantiteTotale = currentData.quantite + commande.quantity;
      const nouveauPrixMoyen = nouvelleQuantiteTotale > 0
        ? (ancienTotalValeur + nouvelleValeurAjoutee) / nouvelleQuantiteTotale
        : commande.unitPrice;

      // Création de l'entrée historique
      const newEntry = {
        date: new Date().toISOString(),
        prix: commande.unitPrice,
        quantiteAjoutee: commande.quantity
      };

      // Mise à jour des données
      const updatedData: StockItem = {
        ...currentData,
        quantite: nouvelleQuantiteTotale,
        prixUnitaireHT: nouveauPrixMoyen,
        dateMiseAJour: new Date().toISOString(),
        historiquePrix: [...(currentData.historiquePrix || []), newEntry],
        status: nouvelleQuantiteTotale <= currentData.seuil ? 'out-of-stock' : 'active'
      };

      await stockRef.set(updatedData);

      // Log du mouvement de stock
      await this.logStockMovement({
        productId: commande.productId,
        type: 'ajout',
        quantity: commande.quantity,
        previousQuantity: currentData.quantite,
        date: new Date().toISOString(),
        reason: 'stock_replenishment'
      });

      return updatedData;
    } catch (error) {
      console.error('Erreur lors de l\'ajout au stock:', error);
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.db.object(${this.stockPath}/${productId}).remove();
    } catch (error) {
      console.error('Erreur suppression:', error);
      throw new Error('Échec de la suppression');
    }
  }

  getProduct(productId: string): Observable<StockItem | null> {
    return this.db.object<StockItem>(${this.stockPath}/${productId}).valueChanges().pipe(
      map(stockItem => {
        console.log('Stock Item:', stockItem);
        return stockItem;
      }),
      catchError(error => {
        console.error('Error loading stock item:', error);
        return of(null);
      })
    );
  }

  predictStockAnalysis(params: { period: number }): Promise<any> {
    return Promise.resolve({
      predictedStockouts: 0,
      trend: 0,
      optimizationPotential: 0,
      turnoverRate: 0,
      predictionData: []
    });
  }

  getStockHistory(productId: string): Observable<StockItem[]> {
    return this.db.list<StockItem>(${this.stockPath}/${productId}/historiquePrix)
      .valueChanges();
  }

  getStock(): Observable<StockItem[]> {
    return this.db.list<StockItem>(this.stockPath).valueChanges().pipe(
      map(items => items.map(item => {
        if (item.promotion && typeof item.promotion !== 'boolean') {
          return {
            ...item,
            promotion: {
              ...item.promotion,
              startDate: new Date(item.promotion.startDate).toISOString(),
              endDate: new Date(item.promotion.endDate).toISOString()
            }
          };
        }
        return item;
      })),
      catchError(error => {
        console.error('Erreur Firebase:', error);
        return of([]);
      })
    );
  }

  async updateStockStatusForPromotions(): Promise<void> {
    const stock = await firstValueFrom(this.getStock());
    const now = new Date();

    const updates = stock
      .filter(item => item.status === 'promotion' && item.promotion)
      .filter(item => {
        const endDate = new Date(item.promotion!.endDate);
        return now > endDate;
      })
      .map(async item => {
        const product = await firstValueFrom(
          this.productService.getProductById(item.idProduit)
        ).catch(() => null);

        const newStatus = product?.postPromoStatus || 'active';

        await this.updateStock(item.idProduit, {
          status: newStatus,
          promotion: null
        });

        return item.idProduit;
      });

    await Promise.all(updates);
  }

  getCurrentPrice(productId: string): Observable<number> {
    return this.getProduct(productId).pipe(
      map(product => {
        if (!product) return 0;

        if (product.status === 'promotion' && product.promotion && this.isPromotionActive(product)) {
          const discount = product.promotion.discountPercentage / 100;
          return product.prixDeVente * (1 - discount);
        }

        return product.prixDeVente;
      })
    );
  }

  isPromotionActive(product: StockItem): boolean {
    if (!product || !product.promotion) return false;

    const now = new Date();
    const start = new Date(product.promotion.startDate);
    const end = new Date(product.promotion.endDate);

    return now >= start && now <= end;
  }

  getRealTimeStock(): Observable<StockItem[]> {
    return this.db.list<StockItem>(this.stockPath).valueChanges().pipe(
      map(items => items.map(item => ({
        ...item,
        promotion: item.promotion ? {
          ...item.promotion,
          startDate: new Date(item.promotion.startDate).toISOString(),
          endDate: new Date(item.promotion.endDate).toISOString()
        } : null
      })))
    );
  }

  private async createOutOfStockNotification(product: StockItem): Promise<void> {
    const notification = {
      type: 'stock-out',
      productId: product.idProduit,
      productName: product.nomProduit,
      message: Rupture de stock - ${product.nomProduit},
      timestamp: new Date().toISOString(),
      read: false,
      priority: 'high'
    };

    await this.db.list('/notifications').push(notification);
  }

  async retirerDuStock(commande: {
    productId: string;
    quantity: number;
    reason: string;
  }): Promise<void> {
    try {
      const stockRef = this.db.object<StockItem>(${this.stockPath}/${commande.productId});
      const snapshot = await firstValueFrom(stockRef.snapshotChanges()) as SnapshotAction<StockItem>;
      const currentData = snapshot.payload.val();

      if (!currentData) {
        throw new Error('Produit non trouvé dans le stock');
      }

      const newQuantity = Math.max(currentData.quantite - commande.quantity, 0);
      const seuil = currentData.seuil || 10;

      const updatedStock: StockItem = {
        ...currentData,
        quantite: newQuantity,
        dateMiseAJour: new Date().toISOString(),
        status: newQuantity <= seuil ? 'out-of-stock' : currentData.status
      };

      await stockRef.update(updatedStock);

      // Log du mouvement de stock
      await this.logStockMovement({
        productId: commande.productId,
        type: 'retrait',
        quantity: commande.quantity,
        previousQuantity: currentData.quantite,
        date: new Date().toISOString(),
        reason: commande.reason
      });

      // Notification si nécessaire
      if (newQuantity <= 0) {
        await this.notificationService.createNotification({
          title: 'Rupture de stock totale',
          message: Le produit ${currentData.nomProduit} est complètement épuisé,
          type: 'stock-out',
          productId: currentData.idProduit,
          priority: 'high'
        });
      } else if (newQuantity <= seuil) {
        await this.notificationService.createNotification({
          title: 'Rupture de stock imminente',
          message: Le produit ${currentData.nomProduit} est en rupture (${newQuantity} restants),
          type: 'stock-out',
          productId: currentData.idProduit,
          priority: 'medium'
        });
      }
    } catch (error) {
      console.error('Erreur lors du retrait du stock:', error);
      throw error;
    }
  }

  private async checkStockLevels(productId: string, newQuantity: number): Promise<void> {
    const product = await firstValueFrom(
      this.db.object<StockItem>(${this.stockPath}/${productId}).valueChanges()
    );

    if (!product) return;

    const seuil = product.seuil || 10; // Seuil par défaut à 10

    if (newQuantity <= 0) {
      await this.notificationService.createNotification({
        title: 'Rupture de stock totale',
        message: Le produit ${product.nomProduit} est complètement épuisé,
        type: 'stock-out',
        productId: product.idProduit,
        priority: 'high'
      });
    } else if (newQuantity <= seuil) {
      await this.notificationService.createNotification({
        title: 'Rupture de stock imminente',
        message: Le produit ${product.nomProduit} est en rupture (${newQuantity} restants),
        type: 'stock-out',
        productId: product.idProduit,
        priority: 'medium'
      });
    }
  }

  async updateStockQuantity(productId: string, delta: number): Promise<void> {
    const ref = this.db.object<StockItem>(${this.stockPath}/${productId});
    const snapshot = await firstValueFrom(ref.valueChanges());

    if (!snapshot) throw new Error(Produit ${productId} non trouvé);

    const newQuantity = snapshot.quantite + delta;
    if (newQuantity < 0) throw new Error('Stock insuffisant');

    const seuil = snapshot.seuil || 10; // Utilise le seuil défini ou 10 par défaut
    const newStatus = newQuantity <= seuil ? 'out-of-stock' : 'active'; // Modifié pour inclure le seuil

    await ref.update({
      quantite: newQuantity,
      status: newStatus,
      dateMiseAJour: new Date().toISOString()
    });

    await this.checkStockLevels(productId, newQuantity);
  }
}