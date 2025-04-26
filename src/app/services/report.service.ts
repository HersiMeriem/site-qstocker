import { Injectable } from '@angular/core';
import { Observable, combineLatest, map, switchMap, from } from 'rxjs';
import { Report, ReportCriteria, ReportData, ReportType } from '../models/report';
import { UserService } from './user.service';
import { StockService } from './stock.service';
import { SaleService } from './sale.service';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private dbPath = '/reports';

  constructor(
    private db: AngularFireDatabase,
    private userService: UserService,
    private stockService: StockService,
    private saleService: SaleService,
    private authService: AuthService
  ) {}

  generateReport(criteria: ReportCriteria): Observable<Report> {
    const currentUser = this.authService.currentUserValue;
    
    switch(criteria.type) {
      case 'users':
        return this.generateUserReport(criteria, currentUser);
      case 'inventory':
        return this.generateInventoryReport(criteria, currentUser);
      case 'sales':
        return this.generateSalesReport(criteria, currentUser);
      default:
        throw new Error('Type de rapport non supporté');
    }
  }

  getReports(): Observable<Report[]> {
    return this.db.list<Report>(this.dbPath)
      .snapshotChanges()
      .pipe(
        map(snapshots => 
          snapshots.map(s => ({
            ...(s.payload.val() as Report),
            id: s.key || this.generateId(),
            generatedDate: new Date(s.payload.val()?.generatedDate || new Date())
          }))
          .sort((a, b) => b.generatedDate.getTime() - a.generatedDate.getTime())
        )
      );
  }

  deleteReport(reportId: string): Observable<void> {
    return from(this.db.object(`${this.dbPath}/${reportId}`).remove());
  }

  private generateUserReport(criteria: ReportCriteria, user: any): Observable<Report> {
    return this.userService.getUserStats().pipe(
      switchMap(stats => this.saveReport({
        id: this.generateId(),
        name: criteria.name || `Rapport Utilisateurs ${new Date().toLocaleDateString()}`,
        type: 'users',
        generatedDate: new Date(),
        data: [
          { statut: 'Approuvés', count: stats.byStatus.approved },
          { statut: 'En attente', count: stats.byStatus.pending },
          { statut: 'Bloqués', count: stats.byStatus.blocked },
          { statut: 'Total', count: stats.total }
        ],
        metadata: {
          generatedBy: user?.displayName || 'Système',
          generationTime: Date.now(),
          recordsProcessed: stats.total,
          lastUpdated: stats.lastUpdated
        }
      }))
    );
  }

  private generateInventoryReport(criteria: ReportCriteria, user: any): Observable<Report> {
    return combineLatest([
      this.stockService.getStockReport(),
      this.stockService.getStockHistoryReport()
    ]).pipe(
      map(([stockReport, historyReport]) => {
        const reportData: ReportData[] = [
          { métrique: 'Produits', valeur: stockReport.totalProducts.toString() },
          { métrique: 'Articles', valeur: stockReport.totalItems.toString() },
          { métrique: 'Valeur totale', valeur: stockReport.totalValue.toString(), unité: 'DT' },
          { métrique: 'Stock bas', valeur: stockReport.lowStock.toString() },
          { métrique: 'Mouvements aujourd\'hui', valeur: historyReport.todayMovements.toString() }
        ];
  
        return {
          id: this.generateId(),
          name: criteria.name || `Rapport Stock ${new Date().toLocaleDateString()}`,
          type: 'inventory',
          generatedDate: new Date(),
          data: reportData,
          metadata: {
            generatedBy: user?.displayName || 'Système',
            generationTime: Date.now(),
            recordsProcessed: stockReport.totalProducts,
            lastUpdated: stockReport.lastUpdated
          }
        } as Report;
      }),
      switchMap(report => this.saveReport(report))
    );
  }
  
  private generateSalesReport(criteria: ReportCriteria, user: any): Observable<Report> {
    return this.saleService.getSalesByDateRange(criteria.startDate, criteria.endDate).pipe(
      map(sales => {
        const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const avgSale = sales.length > 0 ? totalRevenue / sales.length : 0;
        
        const paymentMethods = sales.reduce((acc, sale) => {
          acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
  
        const report: Report = {
          id: this.generateId(),
          name: criteria.name || `Rapport Ventes ${new Date().toLocaleDateString()}`,
          type: 'sales',
          generatedDate: new Date(),
          data: [
            { période: 'Total', ventes: sales.length, revenu: totalRevenue },
            { période: 'Moyenne/vente', ventes: 1, revenu: avgSale },
            ...Object.entries(paymentMethods).map(([method, count]) => ({
              méthode: this.getPaymentMethodLabel(method),
              count,
              pourcentage: (count / sales.length * 100).toFixed(1) + '%'
            }))
          ],
          metadata: {
            generatedBy: user?.displayName || 'Système',
            generationTime: Date.now(),
            recordsProcessed: sales.length,
            dateDébut: criteria.startDate,
            dateFin: criteria.endDate
          }
        };
  
        return report;
      }),
      switchMap(report => this.saveReport(report))
    );
  }

  private saveReport(report: Report): Observable<Report> {
    const reportToSave = {
      ...report,
      generatedDate: report.generatedDate.toISOString(),
      data: this.prepareDataForFirebase(report.data)
    };
    
    return new Observable<Report>(subscriber => {
      this.db.list(this.dbPath).push(reportToSave).then(ref => {
        const savedReport = {
          ...report,
          id: ref.key || report.id
        };
        subscriber.next(savedReport);
        subscriber.complete();
      }).catch(error => {
        subscriber.error(error);
      });
    });
  }

  private prepareDataForFirebase(data: ReportData[]): any[] {
    return data.map(item => {
      const preparedItem: any = {};
      Object.keys(item).forEach(key => {
        preparedItem[key] = item[key];
      });
      return preparedItem;
    });
  }

  private generateId(): string {
    return this.db.createPushId() || Math.random().toString(36).substring(2, 15);
  }

  private getPaymentMethodLabel(method: string): string {
    const methods: Record<string, string> = {
      'cash': 'Espèces',
      'card': 'Carte',
      'credit': 'Crédit'
    };
    return methods[method] || method;
  }
}