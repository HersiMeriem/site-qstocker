import { Injectable } from '@angular/core';
import { SaleService } from './sale.service';
import { map, catchError } from 'rxjs/operators';
import { StockService } from './stock.service';
import { combineLatest, Observable, of } from 'rxjs';

interface Activity {
  type: 'sales' | 'stock' | 'alerts' | 'system';
  icon: string;
  message: string;
  time: Date | string;
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
    private saleService: SaleService,
    private stockService: StockService
  ) {}

  getRecentActivities(): Observable<Activity[]> {
    return combineLatest([
      this.saleService.getRecentSales(),
      this.stockService.getStockMovements().pipe(
        catchError(error => {
          console.error('Error loading stock movements:', error);
          return of([]);
        })
      )
    ]).pipe(
      map(([sales, movements]) => {
        // Convertir les ventes en activités
        const salesActivities = sales.map(sale => ({
          type: 'sales' as const,
          icon: 'shopping_cart',
          message: `Vente #${sale.invoiceNumber}`,
          time: sale.date,
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
          time: movement.date || new Date().toISOString(),
          amount: movement.quantity * (movement.unitPrice || 0),
          product: {
            idProduit: movement.productId,
            nomProduit: movement.productName || 'Produit inconnu'
          },
          actions: [
            { label: 'Historique', action: 'viewStockHistory' }
          ]
        }));

        // Combiner et trier les activités
        const allActivities = [...salesActivities, ...stockActivities];
        
        return allActivities
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
          .slice(0, 20);
      }),
      catchError(error => {
        console.error('Error in activity service:', error);
        return of([]);
      })
    );
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
    
    return `${actions[movement.type] || 'Mouvement'} - ${productName} (${quantity} ${unit})`;
  }
}