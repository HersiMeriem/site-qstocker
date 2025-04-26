import { Component, Inject, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Chart, ChartType, ChartConfiguration, registerables } from 'chart.js';
import { Sale } from '../../models/sale';
import { MatTableDataSource } from '@angular/material/table';

Chart.register(...registerables);

type ReportType = 'daily' | 'weekly' | 'monthly';
type PaymentMethod = 'cash' | 'card' | 'credit';

interface PaymentColors {
  cash: string;
  card: string;
  credit: string;
  [key: string]: string;
}

@Component({
  selector: 'app-sales-reports',
  templateUrl: './sales-reports.component.html',
  styleUrls: ['./sales-reports.component.css']
})
export class SalesReportsComponent implements OnInit, AfterViewInit {
  @ViewChild('salesChart') salesChartRef: any;
  @ViewChild('paymentChart') paymentChartRef: any;
  
  salesChart!: Chart<'bar'>;
  paymentChart!: Chart<'doughnut'>;
  
  reportType: ReportType = 'daily';
  startDate: Date;
  endDate: Date;
  
  salesHistory: Sale[] = [];
  filteredSales = new MatTableDataSource<Sale>();
  displayedColumns: string[] = ['date', 'invoice', 'amount', 'payment'];
  
  totalSales = 0;
  totalTransactions = 0;
  averageSale = 0;

  private paymentColors: PaymentColors = {
    cash: '#4caf50',
    card: '#2196f3',
    credit: '#ff9800'
  };

  constructor(
    public dialogRef: MatDialogRef<SalesReportsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { salesHistory: Sale[] }
  ) {
    const today = new Date();
    this.endDate = new Date(today);
    this.startDate = new Date(today);
    this.startDate.setDate(today.getDate() - 30);
  }
  
  ngOnInit(): void {
    this.salesHistory = this.data.salesHistory || [];
    this.filteredSales.data = this.salesHistory;
    this.calculateStats(this.salesHistory);
  }
  
  ngAfterViewInit(): void {
    this.initCharts();
    this.generateReport();
  }
  
  private initCharts(): void {
    if (!this.salesChartRef || !this.paymentChartRef) return;

    const salesChartConfig: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    };

    const paymentChartConfig: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' }
        }
      }
    };

    this.salesChart = new Chart(this.salesChartRef.nativeElement, salesChartConfig);
    this.paymentChart = new Chart(this.paymentChartRef.nativeElement, paymentChartConfig);
  }
  
  generateReport(): void {
    if (!this.salesHistory.length) return;

    const filtered = this.salesHistory.filter(s => {
      const saleDate = new Date(s.date);
      return saleDate >= this.startDate && saleDate <= this.endDate;
    });
    
    this.calculateStats(filtered);
    this.updateCharts(filtered);
    this.filteredSales.data = filtered;
  }
  
  private calculateStats(sales: Sale[]): void {
    this.totalSales = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    this.totalTransactions = sales.length;
    this.averageSale = this.totalTransactions > 0 ? 
      this.totalSales / this.totalTransactions : 0;
  }
  
  private updateCharts(sales: Sale[]): void {
    if (!this.salesChart || !this.paymentChart) return;

    this.updateSalesChart(sales);
    this.updatePaymentChart(sales);
  }
  
  private updateSalesChart(sales: Sale[]): void {
    const labels = this.getDateLabels();
    const data = this.groupSalesByPeriod(sales);
    
    this.salesChart.data = {
      labels,
      datasets: [{
        label: 'Chiffre d\'affaires',
        data,
        backgroundColor: '#3f51b5',
        borderColor: '#3f51b5',
        borderWidth: 1
      }]
    };
    this.salesChart.update();
  }
  
  private updatePaymentChart(sales: Sale[]): void {
    const methods = sales.reduce((acc, sale) => {
      const method = (sale.paymentMethod || 'cash') as PaymentMethod;
      acc[method] = (acc[method] || 0) + (sale.totalAmount || 0);
      return acc;
    }, {} as Record<PaymentMethod, number>);
    
    const paymentMethods = Object.keys(methods) as PaymentMethod[];
    
    this.paymentChart.data = {
      labels: paymentMethods.map(m => this.getPaymentMethodLabel(m)),
      datasets: [{
        data: paymentMethods.map(m => methods[m]),
        backgroundColor: paymentMethods.map(m => this.paymentColors[m])
      }]
    };
    this.paymentChart.update();
  }
  
  private getDateLabels(): string[] {
    const labels: string[] = [];
    const currentDate = new Date(this.startDate);
    
    while (currentDate <= this.endDate) {
      const dateCopy = new Date(currentDate); // Créer une copie pour éviter les effets de bord
      
      switch (this.reportType) {
        case 'daily':
          labels.push(dateCopy.toLocaleDateString('fr-FR'));
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          labels.push(`Semaine ${this.getWeekNumber(dateCopy)}`);
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'monthly':
          labels.push(dateCopy.toLocaleDateString('fr-FR', { month: 'long' }));
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
      }
    }
    
    return labels;
  }
  
  private groupSalesByPeriod(sales: Sale[]): number[] {
    const result: number[] = [];
    const currentDate = new Date(this.startDate);
    
    while (currentDate <= this.endDate) {
      let periodSales = 0;
      const nextDate = new Date(currentDate);
      
      switch (this.reportType) {
        case 'daily':
          nextDate.setDate(currentDate.getDate() + 1);
          periodSales = this.getSalesForPeriod(sales, new Date(currentDate), new Date(nextDate));
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          nextDate.setDate(currentDate.getDate() + 7);
          periodSales = this.getSalesForPeriod(sales, new Date(currentDate), new Date(nextDate));
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'monthly':
          nextDate.setMonth(currentDate.getMonth() + 1);
          periodSales = this.getSalesForPeriod(sales, new Date(currentDate), new Date(nextDate));
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
      }
      
      result.push(periodSales);
    }
    
    return result;
  }
  
  private getSalesForPeriod(sales: Sale[], start: Date, end: Date): number {
    return sales
      .filter(s => {
        const saleDate = new Date(s.date);
        return saleDate >= start && saleDate < end;
      })
      .reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  }
  
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
  
  getChartTitle(): string {
    const titles: Record<ReportType, string> = {
      daily: 'Évolution quotidienne',
      weekly: 'Évolution hebdomadaire',
      monthly: 'Évolution mensuelle'
    };
    return titles[this.reportType] || 'Performance des ventes';
  }
  
  getPaymentMethodLabel(method: string): string {
    const labels: Record<PaymentMethod, string> = {
      cash: 'Espèces',
      card: 'Carte',
      credit: 'Crédit'
    };
    return labels[method as PaymentMethod] || method;
  }
  
  close(): void {
    this.dialogRef.close();
  }
}