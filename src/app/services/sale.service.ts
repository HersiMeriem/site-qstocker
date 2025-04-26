import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Sale, SaleItem } from '../models/sale';
import { StockService } from './stock.service';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class SaleService {
  private dbPath = '/sales';
  private lastInvoiceNumber = 0;

  constructor(
    private db: AngularFireDatabase,
    private stockService: StockService
  ) {}

  async createSale(saleData: Omit<Sale, 'id' | 'invoiceNumber'>): Promise<Sale> {
    const invoiceNumber = this.generateInvoiceNumber();
    const newSale: Sale = {
      ...saleData,
      id: this.db.createPushId() || '', // Gestion du cas undefined
      invoiceNumber,
      date: new Date().toISOString()
    };

    await this.updateStockQuantities(newSale.items);
    const saleRef = await this.db.list(this.dbPath).push(newSale);
    return { ...newSale, id: saleRef.key || '' };
  }

  private async updateStockQuantities(items: SaleItem[]): Promise<void> {
    const updates = items.map(item => 
      this.stockService.updateStockQuantity(item.productId, -item.quantity)
    );
    await Promise.all(updates);
  }

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

  // sale.service.ts
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
    ))
  );
}


}