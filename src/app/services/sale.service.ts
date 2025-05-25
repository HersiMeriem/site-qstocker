import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { firstValueFrom, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Sale, SaleItem } from '../models/sale';
import { StockService } from './stock.service';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class SaleService {
 private dbPath = '/sales';
  private lastInvoiceNumber = 0;
  selectedProduct: any;
  selectedQuantity!: number;
  
  constructor(
    private db: AngularFireDatabase,
    private stockService: StockService,
    private http: HttpClient,
    private notificationService: NotificationService
  ) {}





  getSalesHistory(filter: string = 'today'): Observable<Sale[]> {
    let startDate: Date;
    const endDate = new Date();

    switch(filter) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        return this.getAllSales();
    }

    return this.getSalesByDateRange(startDate.toISOString(), endDate.toISOString());
  }

  getAllSales(): Observable<Sale[]> {
    return this.db.list<Sale>(this.dbPath).valueChanges().pipe(
      map(sales => sales.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()))
    );
  }

  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `INV-${year}${month}${day}-${random}`;
  }

  getSalesReport(): Observable<any> {
    return this.getAllSales().pipe(
      map(sales => {
        const todaySales = sales.filter(s =>
          new Date(s.date).toDateString() === new Date().toDateString());

        return {
          totalSales: sales.length,
          totalRevenue: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
          todaySales: todaySales.length,
          todayRevenue: todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0),
          avgSale: sales.length > 0 ?
            sales.reduce((sum, sale) => sum + sale.totalAmount, 0) / sales.length : 0,
          paymentMethods: sales.reduce((acc, sale) => {
            acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        };
      })
    );
  }

  getSalesByDateRange(startDate: string, endDate: string): Observable<Sale[]> {
    return this.db.list<Sale>(this.dbPath, ref =>
      ref.orderByChild('date')
         .startAt(startDate)
         .endAt(endDate)
    ).valueChanges().pipe(
      map(sales => sales.filter(sale =>
        sale.date &&
        new Date(sale.date) >= new Date(startDate) &&
        new Date(sale.date) <= new Date(endDate)
      )
    ));
  }

  getFinancialMetrics(): Observable<{caHistory: number[], expensesBreakdown: number[]}> {
    return this.http.get<{caHistory: number[], expensesBreakdown: number[]}>(
      'votre-api/financial-metrics'
    );
  }

  getRecentSales(limit: number = 5): Observable<Sale[]> {
    return this.db.list<Sale>(this.dbPath, ref =>
      ref.orderByChild('date')
         .limitToLast(limit)
    ).valueChanges().pipe(
      map(sales => sales.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ))
    );
  }

  get canAddToCart(): boolean {
    return !!this.selectedProduct && 
           this.selectedQuantity > 0 &&
           this.selectedProduct.status !== 'out-of-stock' &&
           this.selectedQuantity <= (this.selectedProduct.quantite || 0);
  } 





  // meriem
  async createSale(saleData: Omit<Sale, 'id' | 'invoiceNumber'>): Promise<Sale> {
    try {
      // Validation préalable
      const validation = await this.validateSaleItems(saleData.items);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      const invoiceNumber = this.generateInvoiceNumber();
      const newSale: Sale = {
        ...saleData,
        id: this.db.createPushId() || '',
        invoiceNumber,
        date: new Date().toISOString()
      };

      // Mise à jour du stock
      await this.updateStockQuantities(newSale.items);
      
      // Enregistrement de la vente
      const saleRef = await this.db.list(this.dbPath).push(newSale);
      const createdSale = { ...newSale, id: saleRef.key || '' };

      return createdSale;

    } catch (error) {
      console.error('Erreur lors de la vente:', error);
      throw error;
    }
  }

   private async validateSaleItems(items: SaleItem[]): Promise<{valid: boolean, message?: string}> {
    for (const item of items) {
      try {
        const product = await firstValueFrom(this.stockService.getProduct(item.productId));
        
        if (!product) {
          return {
            valid: false,
            message: `Produit ${item.productId} non trouvé`
          };
        }
        
        if (product.quantite < 0) {
          return {
            valid: false,
            message: `Stock insuffisant pour ${product.nomProduit}`
          };
        }
      } catch (error) {
        console.error('Erreur validation produit:', error);
        return {
          valid: false,
          message: 'Erreur lors de la vérification du stock'
        };
      }
    }
    
    return { valid: true };
  }


private async updateStockQuantities(items: SaleItem[]): Promise<void> {
  try {
    const updates = items.map(async item => {
      try {
        // Mettre à jour le stock
        await this.stockService.updateStockQuantity(item.productId, -item.quantity);
        
        // Récupérer les infos du produit
        const product = await firstValueFrom(this.stockService.getProduct(item.productId));
        
        // Vérifier que le produit existe
        if (!product) {
          console.warn(`Produit ${item.productId} non trouvé après mise à jour du stock`);
          return;
        }

        // Notification de vente
        await this.notificationService.createNotification({
          title: 'Produit vendu',
          message: `${item.quantity} × ${item.name} vendu(s) pour ${item.totalPrice} DT`,
          type: 'product-sold',
          productId: item.productId, // On utilise item.productId car on est sûr qu'il existe
          priority: 'low'
        });

        // Notification si stock faible
        if (product.quantite <= 10) {
          await this.notificationService.createNotification({
            title: 'Stock faible',
            message: `Il reste ${product.quantite} unités de ${product.nomProduit}`,
            type: 'low-stock',
            productId: product.idProduit,
            priority: 'medium'
          });
        }

        // Notification si rupture de stock
        if (product.quantite <= 0) {
          await this.notificationService.createNotification({
            title: 'Rupture de stock',
            message: `${product.nomProduit} est en rupture de stock`,
            type: 'stock-out',
            productId: product.idProduit,
            priority: 'high'
          });
        }
      } catch (error) {
        console.error(`Erreur mise à jour stock produit ${item.productId}:`, error);
        throw error;
      }
    });
    
    await Promise.all(updates);
  } catch (error) {
    console.error('Erreur globale mise à jour stock:', error);
    throw error;
  }
}



}