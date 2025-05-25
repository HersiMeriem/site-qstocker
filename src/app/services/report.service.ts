import { Injectable } from '@angular/core';
import { Observable, combineLatest, from, map, switchMap } from 'rxjs';
import { Report, ReportCriteria, ReportData, ReportType } from '../models/report';
import { UserService } from './user.service';
import { StockService } from './stock.service';
import { SaleService } from './sale.service';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AuthService } from './auth.service';
import { Sale } from '../models/sale';

interface PeriodData {
  label: string;
  count: number;
  amount: number;
}

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

    switch (criteria.type) {
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
          { métrique: 'Produits', valeur: stockReport.totalProducts },
          { métrique: 'Articles', valeur: stockReport.totalItems },
          { métrique: 'Valeur totale', valeur: stockReport.totalValue, unité: 'DT' },
          { métrique: 'Stock bas', valeur: stockReport.lowStock }
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

        const periodData = this.groupSalesByPeriod(sales, criteria.startDate, criteria.endDate);

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
            ...periodData.map(period => ({
              période: period.label,
              ventes: period.count,
              revenu: period.amount
            })),
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

  private groupSalesByPeriod(sales: Sale[], startDate: string, endDate: string): PeriodData[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) {
      const days: Record<string, { count: number; amount: number }> = {};

      sales.forEach(sale => {
        const date = new Date(sale.date).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit'
        });
        if (!days[date]) {
          days[date] = { count: 0, amount: 0 };
        }
        days[date].count++;
        days[date].amount += sale.totalAmount;
      });

      const result: PeriodData[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit'
        });
        result.push({
          label: dateKey,
          count: days[dateKey]?.count || 0,
          amount: days[dateKey]?.amount || 0
        });
      }

      return result;
    } else if (diffDays <= 31) {
      const days: Record<string, { count: number; amount: number }> = {};

      sales.forEach(sale => {
        const date = new Date(sale.date).toLocaleDateString('fr-FR', {
          day: '2-digit'
        });
        if (!days[date]) {
          days[date] = { count: 0, amount: 0 };
        }
        days[date].count++;
        days[date].amount += sale.totalAmount;
      });

      const result: PeriodData[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toLocaleDateString('fr-FR', {
          day: '2-digit'
        });
        result.push({
          label: dateKey,
          count: days[dateKey]?.count || 0,
          amount: days[dateKey]?.amount || 0
        });
      }

      return result;
    } else if (diffDays <= 93) {
      const weeks = {};
      sales.forEach(sale => {
        const saleDate = new Date(sale.date);
        const weekStart = new Date(saleDate);
        weekStart.setDate(saleDate.getDate() - saleDate.getDay());

        const weekKey = `S${this.getWeekNumber(weekStart)} (${weekStart.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit'
        })})`;

        if (!weeks[weekKey]) {
          weeks[weekKey] = { count: 0, amount: 0 };
        }
        weeks[weekKey].count++;
        weeks[weekKey].amount += sale.totalAmount;
      });

      return Object.entries(weeks).map(([week, data]: [string, any]) => ({
        label: week,
        count: data.count,
        amount: data.amount
      }));
    } else if (diffDays <= 365) {
      const months = {};
      sales.forEach(sale => {
        const monthKey = new Date(sale.date).toLocaleDateString('fr-FR', {
          month: 'long',
          year: 'numeric'
        });
        if (!months[monthKey]) {
          months[monthKey] = { count: 0, amount: 0 };
        }
        months[monthKey].count++;
        months[monthKey].amount += sale.totalAmount;
      });

      return Object.entries(months).map(([month, data]: [string, any]) => ({
        label: month,
        count: data.count,
        amount: data.amount
      }));
    } else {
      const quarters = {};
      sales.forEach(sale => {
        const saleDate = new Date(sale.date);
        const quarter = `T${Math.floor(saleDate.getMonth() / 3) + 1} ${saleDate.getFullYear()}`;

        if (!quarters[quarter]) {
          quarters[quarter] = { count: 0, amount: 0 };
        }
        quarters[quarter].count++;
        quarters[quarter].amount += sale.totalAmount;
      });

      return Object.entries(quarters).map(([quarter, data]: [string, any]) => ({
        label: quarter,
        count: data.count,
        amount: data.amount
      }));
    }
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
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
