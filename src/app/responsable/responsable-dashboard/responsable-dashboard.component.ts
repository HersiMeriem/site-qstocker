import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SaleService } from '../../services/sale.service';
import { StockItem, StockService } from '../../services/stock.service';
import { ProductService } from '../../services/product.service';
import { ActivityService } from '../../services/activity.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Sale } from 'src/app/models/sale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TimeAgoPipe } from 'src/app/pipes/time-ago.pipe';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { EmailService } from 'src/app/services/email.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { map } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, Subscription } from 'rxjs';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';


Chart.register(...registerables);
interface AuthenticityStats {
  verified: number;
  suspicious: number;
  lastCheck: Date;
  verificationDetails: any;
}

interface StockMetrics {
  predictedStockouts: number;
  stockoutTrend: number;
  optimizationPotential: number;
  turnoverRate: number;
}
interface KpiCard {
  title: string;
  value: number;
  icon: string;
  trend?: number;
  comparisonValue?: number;
  description: string;
  color: string;
  isCurrency: boolean;
}

interface RecentSale {
  id: string;
  date: string;
  amount: number;
  paymentMethod: string;
  items: number;
}

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

interface LowStockProduct {
  id: string;
  name: string;
  imageUrl?: string;
  category: string;
  quantity: number;
  threshold: number;
  daysUntilStockout: number;
  lastSaleDate: Date;
  supplier?: {
    id: string;
    name: string;
    leadTime: number;
    contact: string;
  };
}

interface Activity {
  type: 'sales' | 'stock' | 'alerts' | 'system';
  icon: string;
  message: string;
  time: Date;
  user?: string;
  location?: string;
  product?: {
    idProduit: string;
    nomProduit: string; // Assurez-vous que cette propriété existe
    // autres propriétés si nécessaire
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
interface OrderStats {
  pending: number;
  overdue: number;
  delivered: number;
  canceled: number;
  monthlyTrend: number;
}

@Component({
  selector: 'app-responsable-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatGridListModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatTableModule,
    MatSortModule,
    MatTooltipModule,
    MatTabsModule,
    MatListModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatSelectModule,
    MatPaginatorModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    ZXingScannerModule
],
  templateUrl: './responsable-dashboard.component.html',
  styleUrls: ['./responsable-dashboard.component.css'],
  providers: [ DatePipe, ]
})
export class ResponsableDashboardComponent implements OnInit {
    @ViewChild(ZXingScannerComponent, { static: false }) scanner!: ZXingScannerComponent;
  showScanner = false;
  supportedFormats = [BarcodeFormat.QR_CODE];
  scanMode: 'edit' | 'delete' | 'view' | null = null;
  public caTrendChart?: Chart<'line'>;
  public expensesChart?: Chart<'doughnut'>;
  currentDate = new Date();
  loading = false;
  authenticityStats: AuthenticityStats = { 
    verified: 0, 
    suspicious: 0, 
    lastCheck: new Date(),
    verificationDetails: null
  };
    //scan 
    selectedDevice: MediaDeviceInfo | undefined;
    allowedFormats = [ BarcodeFormat.QR_CODE ];

  stockMetrics: StockMetrics = {
    predictedStockouts: 0,
    stockoutTrend: 0,
    optimizationPotential: 0,
    turnoverRate: 0
  };
  
  selectedPeriod = '30';
  authenticityChart: any;
  stockPredictionChart: any;

  // Statistiques commandes
pendingOrders = 0;
pendingOrdersMonthly = 0;
overdueOrders = 0;
overdueTrend = 0;

// Statistiques fournisseurs
suppliersCount = 0;
newSuppliers = 0;
totalProducts = 0;
totalStockItems = 0;


  // KPI Cards Data
  kpiCards: KpiCard[] = [
    {
      title: 'Ventes aujourd\'hui',
      value: 0,
      icon: 'shopping_cart',
      trend: 0,
      comparisonValue: 0,
      description: 'Nombre de transactions',
      color: 'primary',
      isCurrency: false
    },
    {
      title: 'Produits sortis',
      value: 0,
      icon: 'inventory',
      trend: 0,
      description: 'Total des sorties',
      color: 'accent',
      isCurrency: false
    },
    {
      title: 'Produits en faible stock',
      value: 0,
      icon: 'warning',
      description: 'Alertes de stock',
      color: 'warn',
      isCurrency: false
    },
    {
      title: 'Revenu total',
      value: 0,
      icon: 'attach_money',
      trend: 0,
      comparisonValue: 0,
      description: 'Chiffre d\'affaires',
      color: 'success',
      isCurrency: true
    },
    {
      title: 'Bénéfice',
      value: 0,
      icon: 'coins', 
      trend: 0,
      description: 'Marge bénéficiaire',
      color: 'success',
      isCurrency: true
    },
    {
      title: 'Clients',
      value: 0,
      icon: 'people',
      trend: 0,
      description: 'Nouveaux clients',
      color: 'primary',
      isCurrency: false,
      
    }
  ];
  // Charts
  salesTrendChart: any;
  productDistributionChart: any;
  categoryPerformanceChart: any;

  // Performance Metrics
  monthlyRevenue = 0;
  monthlySales = 0;
  averageTicket = 0;
  revenueTrend = 0;
  salesTrend = 0;
  ticketTrend = 0;
  // Recent Sales Table
  recentSales: RecentSale[] = [];
  displayedColumns: string[] = ['id', 'date', 'amount', 'paymentMethod', 'items'];

  // Low Stock Products
  lowStockProducts: any[] = [];

  // Quick Actions
  quickActions = [
    { icon: 'add', label: 'Nouvelle vente', action: 'newSale', color: 'primary' },
    { icon: 'exit_to_app', label: 'Nouvelle sortie', action: 'newExit', color: 'accent' },
    { icon: 'inventory_2', label: 'Réapprovisionner', action: 'replenish', color: 'warn' },
    { icon: 'notifications', label: 'Alertes', action: 'alerts', color: 'warn' },
    { icon: 'bar_chart', label: 'Rapports', action: 'reports', color: 'primary' }
  ];
  private stockSubscription: Subscription | undefined;
  // Recent Activities


   filteredActivities: Activity[] = [];
  recentActivities: Activity[] = [];
  activityStats = {
    sales: 0,
    stock: 0,
    alerts: 0,
    system: 0
  };
stockChart: any;
salesChart: any;
productChart: any;
  activitiesSubscription: Subscription | undefined;
  constructor(
    private saleService: SaleService,
    private stockService: StockService,
    private productService: ProductService,
    private activityService: ActivityService,
    private datePipe: DatePipe,
    private router: Router,
    private emailService: EmailService,
    private supplierService: SupplierService,
    private snackBar: MatSnackBar,
      private dialog: MatDialog
  ) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadRecentActivities();
    this.initFinancialCharts();
    this.loadFinancialData();
    this.filteredActivities = [...this.recentActivities];
       this.activitiesSubscription = this.activityService.getRecentActivities().subscribe(activities => {
      this.filteredActivities = activities;
    });
    this.stockSubscription = this.stockService.getStock().subscribe(stockItems => {
      console.log('Stock Items:', stockItems); // Log pour vérifier les données
      this.createStockChart(stockItems);
    });
        this.loadRecentActivities();
  }

    refreshData(): void {
    this.loading = true;
    this.loadSalesData();
    this.loadRecentActivities();
    
    setTimeout(() => {
      this.snackBar.open('Données actualisées', 'Fermer', { duration: 2000 });
      this.loading = false;
    }, 1000);
  }
private formatActivityTime(date: Date): string {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

  // Méthodes pour les activités
  loadRecentActivities(): void {
    this.activityService.getRecentActivities().subscribe({
      next: (activities) => {
        this.recentActivities = activities.map(activity => ({
          ...activity,
          time: new Date(activity.time),
          user: activity.user || 'Système',
          type: activity.type || 'system'
        }));
        this.filteredActivities = [...this.recentActivities];
        this.updateActivityStats();
      },
      error: (err) => {
        console.error('Erreur chargement activités:', err);
        this.filteredActivities = [];
      }
    });
  }

  filterActivities(type: string): void {
    if (type === 'alerts') {
      this.filteredActivities = this.recentActivities.filter(activity => 
        activity.type === 'alerts' || 
        (activity.message.includes('stock') && activity.message.includes('rupture'))
      );
    } else {
      this.filteredActivities = type === 'all' 
        ? [...this.recentActivities] 
        : this.recentActivities.filter(activity => activity.type === type);
    }
  }

  refreshActivities(): void {
    this.loading = true;
    this.loadRecentActivities();
    this.loading = false;
  }

  onActivityClick(activity: Activity): void {
    console.log('Activity clicked:', activity);
  }

  private updateActivityStats(): void {
    this.activityStats = {
      sales: this.recentActivities.filter(a => a.type === 'sales').length,
      stock: this.recentActivities.filter(a => a.type === 'stock').length,
      alerts: this.recentActivities.filter(a => a.type === 'alerts').length,
      system: this.recentActivities.filter(a => a.type === 'system').length
    };
  }









  ngAfterViewInit(): void {
    this.createSalesChart();
    this.createProductChart();
  }
  
  loadDashboardData(): void {
    this.loading = true;
    this.loadSalesData();
    this.loadStockData();
    this.loadProductData();
    this.loadPerformanceMetrics();
    this.loadFinancialData();
    this.loadOrderStats();
    this.loadSupplierStats();
    this.loadProductAndStockCounts();
    this.loadProducts();
    this.createCaTrendChart();
    this.createExpensesChart();
  }

  initFinancialCharts(): void {
    this.createCaTrendChart();
    this.createExpensesChart();
  }
  


   loadSalesData(): void {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();

    this.saleService.getSalesByDateRange(startOfDay, endOfDay).subscribe({
      next: (todaySales: Sale[]) => {
        let totalProductsSold = 0;
        const uniqueClientsToday = new Set<string>();

        todaySales.forEach(sale => {
          totalProductsSold += sale.items.reduce((sum, item) => sum + item.quantity, 0);
          if (sale.customerId) {
            uniqueClientsToday.add(sale.customerId);
          }
        });

        const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const todayProfit = todayRevenue * 0.3;

        this.kpiCards = this.kpiCards.map(card => {
          if (card.title === 'Ventes aujourd\'hui') {
            return { ...card, value: todaySales.length };
          }
          if (card.title === 'Produits sortis') {
            return { ...card, value: totalProductsSold };
          }
          if (card.title === 'Revenu total') {
            return { ...card, value: todayRevenue };
          }
          if (card.title === 'Bénéfice') {
            return { ...card, value: todayProfit };
          }
          if (card.title === 'Clients') {
            return {
              ...card,
              value: uniqueClientsToday.size,
              description: 'Clients acheteurs uniques'
            };
          }
          return card;
        });

        this.recentSales = todaySales.map(sale => ({
          id: sale.invoiceNumber,
          date: sale.date,
          amount: sale.totalAmount,
          paymentMethod: sale.paymentMethod,
          items: sale.items.reduce((sum, item) => sum + item.quantity, 0)
        })).slice(0, 5);

        this.saleService.getSalesByDateRange(startOfYesterday, endOfYesterday).subscribe({
          next: yesterdaySales => {
            const uniqueClientsYesterday = new Set<string>();
            yesterdaySales.forEach(sale => {
              if (sale.customerId) {
                uniqueClientsYesterday.add(sale.customerId);
              }
            });

            const trend = uniqueClientsYesterday.size > 0
              ? ((uniqueClientsToday.size - uniqueClientsYesterday.size) / uniqueClientsYesterday.size) * 100
              : 0;

            this.kpiCards = this.kpiCards.map(card => {
              if (card.title === 'Clients') {
                return { ...card, trend: Math.round(trend) };
              }
              return card;
            });
          },
          error: err => {
            console.error('Error loading yesterday sales:', err);
            this.calculateDailyTrends(todaySales, []);
          }
        });
      },
      error: err => {
        console.error('Error loading today sales:', err);
        this.loading = false;
      }
    });

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    this.saleService.getSalesByDateRange(startOfWeek.toISOString(), new Date().toISOString())
      .subscribe({
        next: (weeklySales: Sale[]) => {
          this.createSalesTrendChart(weeklySales);
        },
        error: err => {
          console.error('Error loading weekly sales:', err);
        }
      });
  }

  loadProductData(): void {
    this.productService.getProducts().subscribe({
      next: products => {
        this.createProductDistributionChart(products);
        this.createCategoryPerformanceChart(products);
      },
      error: err => {
        console.error('Error loading product data:', err);
        this.loading = false;
      }
    });
  }

  loadPerformanceMetrics(): void {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    this.saleService.getSalesByDateRange(startOfMonth.toISOString(), endOfMonth.toISOString())
      .subscribe(sales => {
        this.monthlySales = sales.length;
        this.monthlyRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        this.averageTicket = this.monthlySales > 0 ? this.monthlyRevenue / this.monthlySales : 0;
        this.calculateMonthlyTrends();
        this.loading = false;
      });
  }

 ngOnDestroy(): void {
    if (this.activitiesSubscription) {
      this.activitiesSubscription.unsubscribe();
    }
  if (this.stockSubscription) {
      this.stockSubscription.unsubscribe();
    }
  }

 private calculateDailyTrends(todaySales: Sale[], yesterdaySales: Sale[]): void {
    const todayRevenue = todaySales.reduce((sum: number, sale: Sale) => sum + sale.totalAmount, 0);
    const todayProductsSold = todaySales.reduce((sum: number, sale: Sale) =>
      sum + sale.items.reduce((itemSum: number, item: { quantity: number }) => itemSum + item.quantity, 0), 0);
    const todayClients = new Set(todaySales
      .filter((s: Sale) => s.clientId)
      .map((s: Sale) => s.clientId as string)).size;

    const yesterdayRevenue = yesterdaySales.reduce((sum: number, sale: Sale) => sum + sale.totalAmount, 0);
    const yesterdayProductsSold = yesterdaySales.reduce((sum: number, sale: Sale) =>
      sum + sale.items.reduce((itemSum: number, item: { quantity: number }) => itemSum + item.quantity, 0), 0);
    const yesterdayClients = new Set(yesterdaySales
      .filter((s: Sale) => s.clientId)
      .map((s: Sale) => s.clientId as string)).size;

    this.kpiCards = this.kpiCards.map(card => {
      if (card.title === 'Ventes aujourd\'hui') {
        const trend = yesterdaySales.length > 0 ?
          ((todaySales.length - yesterdaySales.length) / yesterdaySales.length) * 100 : 0;
        return { ...card, trend: Math.round(trend), comparisonValue: yesterdaySales.length };
      }
      if (card.title === 'Produits sortis') {
        const trend = yesterdayProductsSold > 0 ?
          ((todayProductsSold - yesterdayProductsSold) / yesterdayProductsSold) * 100 : 0;
        return { ...card, trend: Math.round(trend) };
      }
      if (card.title === 'Revenu total') {
        const trend = yesterdayRevenue > 0 ?
          ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
        return { ...card, trend: Math.round(trend), comparisonValue: yesterdayRevenue };
      }
      if (card.title === 'Clients') {
        const trend = yesterdayClients > 0 ?
          ((todayClients - yesterdayClients) / yesterdayClients) * 100 : 0;
        return { ...card, trend: Math.round(trend) };
      }
      return card;
    });
  }

  calculateMonthlyTrends(): void {
    this.revenueTrend = this.getRandomTrend();
    this.salesTrend = this.getRandomTrend();
    this.ticketTrend = this.getRandomTrend();
  }

  getRandomTrend(): number {
    return Math.floor(Math.random() * 30) - 15;
  }

  createSalesTrendChart(sales: any[]): void {
    const salesByDay = sales.reduce((acc, sale) => {
      const date = new Date(sale.date).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += sale.totalAmount;
      return acc;
    }, {});

    const labels = Object.keys(salesByDay);
    const data = Object.values(salesByDay);

    if (this.salesTrendChart) {
      this.salesTrendChart.destroy();
    }

    this.salesTrendChart = new Chart('salesTrendChart', {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ventes (DT)',
          data: data,
          fill: false,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Tendance des Ventes (7 derniers jours)'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.parsed.y + ' DT';
              }
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: function(value) {
                return value + ' DT';
              }
            }
          }
        }
      }
    });
  }

  createCategoryPerformanceChart(products: any[]): void {
    const categories = [...new Set(products.map(p => p.category))];
    const performanceData = categories.map(category => {
      const categoryProducts = products.filter(p => p.category === category);
      return categoryProducts.length * 100;
    });

    if (this.categoryPerformanceChart) {
      this.categoryPerformanceChart.destroy();
    }

    this.categoryPerformanceChart = new Chart('categoryPerformanceChart', {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [{
          label: 'Performance par Catégorie',
          data: performanceData,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Performance par Catégorie'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  onKpiClick(title: string): void {
    console.log(KPI clicked: ${title});
  }

  onTabChange(event: any): void {
    console.log('Tab changed to:', event.tab.textLabel);
  }

  viewAllSales(): void {
    console.log('View all sales');
  }

  viewAllLowStock(): void {
    console.log('View all low stock items');
  }

  exportDashboardData(): void {
    this.loading = true;

    try {
      const doc = new jsPDF('landscape');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.setTextColor(40, 53, 147);
      doc.text('QStocker', 15, 20);

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(15, 37, doc.internal.pageSize.width - 15, 37);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text('Rapport Journalier - Tableau de Bord',
             doc.internal.pageSize.width / 2, 45, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(Généré le: ${this.datePipe.transform(new Date(), 'dd/MM/yyyy à HH:mm', 'fr-FR')},
             doc.internal.pageSize.width - 15, 45, { align: 'right' });

      autoTable(doc, {
        head: [['Indicateur', 'Valeur', 'Description', 'Tendance']],
        body: this.kpiCards.map(card => [
          card.title,
          card.isCurrency ? ${card.value.toFixed(2)} DT : card.value,
          card.description,
          card.trend !== undefined ? ${card.trend > 0 ? '+' : ''}${card.trend}% : 'N/A'
        ]),
        startY: 50,
        headStyles: {
          fillColor: [63, 81, 181],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      });

      autoTable(doc, {
        head: [['N° Facture', 'Date', 'Montant', 'Paiement', 'Articles']],
        body: this.recentSales.map(sale => [
          sale.id,
          this.datePipe.transform(sale.date, 'dd/MM/yy HH:mm'),
          ${sale.amount.toFixed(2)} DT,
          this.getPaymentMethodLabel(sale.paymentMethod),
          sale.items
        ]),
        startY: (doc as any).lastAutoTable.finalY + 15,
        headStyles: {
          fillColor: [56, 142, 60],
          textColor: 255,
          fontStyle: 'bold'
        }
      });

      if (this.lowStockProducts.length > 0) {
        autoTable(doc, {
          head: [['Produit', 'Stock', 'Seuil', 'Prix Unitaire']],
          body: this.lowStockProducts.map(product => [
            product.nomProduit || 'Inconnu',
            product.quantite,
            product.seuil || 5,
            ${(product.prixUnitaireHT || 0).toFixed(2)} DT
          ]),
          startY: (doc as any).lastAutoTable.finalY + 15,
          headStyles: {
            fillColor: [198, 40, 40],
            textColor: 255,
            fontStyle: 'bold'
          },
          willDrawCell: (data: any) => {
            if (data.column.index === 1 && data.cell.raw < data.row.raw[2]) {
              doc.setTextColor(198, 40, 40);
              doc.setFont('helvetica', 'bold');
            }
          }
        });
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(
          QStocker - Zone touristique Mahdia - contact.qstocker@gmail.com - Page ${i}/${pageCount},
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      doc.save(QStocker_Rapport_${this.datePipe.transform(new Date(), 'yyyyMMdd', 'fr-FR')}.pdf);

    } catch (error) {
      console.error('Erreur génération PDF:', error);
    } finally {
      this.loading = false;
    }
    
  }

  
    private getPaymentMethodLabel(method: string): string {
    const methods: Record<string, string> = {
      'cash': 'Espèces',
      'card': 'Carte',
      'credit': 'Crédit'
    };
    return methods[method] || method;
  }

  refreshDashboard(): void {
    this.loading = true;
    if (this.salesTrendChart) this.salesTrendChart.destroy();
    if (this.productDistributionChart) this.productDistributionChart.destroy();

    this.kpiCards.forEach(card => card.value = 0);
    this.recentSales = [];
    this.lowStockProducts = [];

    this.loadDashboardData();
  }

async runAuthenticityCheck(): Promise<void> {
    this.loading = true;
    try {
      const result = await this.productService.checkProductsAuthenticity();
      this.authenticityStats = {
        verified: result.verifiedCount,
        suspicious: result.suspiciousCount,
        lastCheck: new Date(),
        verificationDetails: result.details
      };
      this.createAuthenticityChart(result.details);
    } catch (error) {
      console.error('Erreur de vérification:', error);
      this.activityService.logActivity('Échec de la vérification d\'authenticité');
    }
    this.loading = false;
  }


 private createAuthenticityChart(details: any): void {
    const ctx = document.getElementById('authenticityChart') as HTMLCanvasElement;
    if (!ctx) return;

    const chartCtx = ctx.getContext('2d');
    if (!chartCtx) return;

    if (this.authenticityChart) {
      this.authenticityChart.destroy();
    }
    this.authenticityChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['QR Code Valide', 'Consistance ML', 'Historique Stock', 'Localisation'],
        datasets: [{
          label: 'Scores d\'Authenticité',
          data: [
            details.qrValidationScore,
            details.mlConsistency,
            details.stockHistoryScore,
            details.locationScore
          ],
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgb(54, 162, 235)',
          pointBackgroundColor: 'rgb(54, 162, 235)',
        }]
      },
      options: {
        scales: {
          r: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  }

  async updateStockAnalysis(): Promise<void> {
    this.loading = true;
    try {
      const analysis = await this.stockService.predictStockAnalysis({
        period: parseInt(this.selectedPeriod)
      });

      this.stockMetrics = {
        predictedStockouts: analysis.predictedStockouts,
        stockoutTrend: analysis.trend,
        optimizationPotential: analysis.optimizationPotential,
        turnoverRate: analysis.turnoverRate
      };

      this.createStockPredictionChart(analysis.predictionData);
    } catch (error) {
      console.error('Erreur d\'analyse:', error);
    }
    this.loading = false;
  }

  private createStockPredictionChart(data: any[]): void {
    const canvas = document.getElementById('stockPredictionChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.stockPredictionChart) {
      this.stockPredictionChart.destroy();
    }
    this.stockPredictionChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map(d => new Date(d.date).toLocaleDateString()),
        datasets: [{
          label: 'Niveau de Stock Prédit',
          data: data.map(d => d.predictedStock),
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1
        }, {
          label: 'Demande Prévue',
          data: data.map(d => d.predictedDemand),
          borderColor: 'rgb(54, 162, 235)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  private calculateTurnoverRate(stock: any[]): number {
    const totalValue = stock.reduce((sum, item) => sum + (item.quantite * item.prixUnitaireHT), 0);
    const monthlySales = this.monthlyRevenue;
    return monthlySales > 0 ? Math.round((totalValue / monthlySales) * 30) : 0;
  }

  private calculateOptimizationPotential(stock: any[]): number {
    return stock.reduce((sum, item) => {
      const idealStock = item.demandPrevue * 1.2;
      return sum + Math.max(0, item.quantite - idealStock) * item.prixUnitaireHT;
    }, 0);
  }

  viewSuspiciousProducts(): void {
    console.log('Afficher les produits suspects');
  }



  getStockProgressColor(product: any): string {
    const percentage = (product.quantite / product.seuil) * 100;
    if (percentage <= 15) return 'warn';
    if (percentage <= 30) return 'accent';
    return 'primary';
  }

  
contactSupplier(supplier: any) {
  // Logique de contact
}

quickReplenish(product: any) {
  // Réapprovisionnement rapide
}

adjustSafetyStock(product: any) {
  // Ajustement du seuil
}
navigateToSupplierOrder() {
  this.router.navigate(['/responsable/commandes-fournisseur']);
}

//financiere 
 private createCaTrendChart(): void {
    const ctx = document.getElementById('caTrendChart') as HTMLCanvasElement;

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
        datasets: [{
          label: 'Chiffre d\'Affaires (DT)',
          data: [65000, 59000, 80000, 81000, 56000, 75000],
          borderColor: '#4CAF50',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false
          }
        }
      }
    };

    if (this.caTrendChart) {
      this.caTrendChart.destroy();
    }
    this.caTrendChart = new Chart(ctx, config);
  }

  private createExpensesChart(): void {
    const ctx = document.getElementById('expensesChart') as HTMLCanvasElement;

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: ['Fournitures', 'Transport', 'Salaires', 'Marketing'],
        datasets: [{
          data: [30000, 15000, 45000, 20000],
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
          }
        },
        cutout: '70%'
      }
    };

    if (this.expensesChart) {
      this.expensesChart.destroy();
    }
    this.expensesChart = new Chart(ctx, config);
  }

  loadFinancialData(): void {
    console.log('Chargement des données financières...');
    this.loading = true;

    this.saleService.getFinancialMetrics().subscribe({
      next: (data) => {
        console.log('Données reçues:', data);
        if (!data || !data.caHistory || !data.expensesBreakdown) {
          console.warn('Données financières incomplètes:', data);
          return;
        }
        this.updateChartsWithRealData(data);
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur API:', err);
        this.loading = false;
      }
    });
  }

  private updateChartsWithRealData(data: {caHistory: number[], expensesBreakdown: number[]}): void {
    if (this.caTrendChart) {
      this.caTrendChart.data.datasets[0].data = data.caHistory;
      this.caTrendChart.update();
    }

    if (this.expensesChart) {
      this.expensesChart.data.datasets[0].data = data.expensesBreakdown;
      this.expensesChart.update();
    }
  }

 openScanner() {
    this.showScanner = true;
    this.requestCameraPermissions();
  }

  closeScanner() {
    this.showScanner = false;
    this.selectedDevice = undefined;
  }

  async requestCameraPermissions() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      this.selectedDevice = videoDevices[0] || undefined;
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Veuillez autoriser l\'accès à la caméra');
      this.selectedDevice = undefined;
    }
  }

  handleQrCodeResult(resultString: string) {
    this.closeScanner();
    const productId = this.extractProductId(resultString);

    if (productId) {
      this.router.navigate(['/responsable/product-details', productId]);
    } else {
      alert('QR Code non reconnu');
    }
  }

  goToSupplierOrder() {
    this.router.navigate(['/responsable/commande-fournisseur']);
  }

 loadOrderStats(): void {
    this.emailService.getCommandes().subscribe(commandes => {
      const now = new Date();
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      let pending = 0;
      let overdue = 0;
      let pendingMonthly = 0;

      commandes.forEach(cmd => {
        const cmdDate = new Date(cmd.dateCommande);

        if (cmd.status === 'En attente' || cmd.paymentStatus === 'En attente') {
          pending++;
          if (cmdDate >= lastMonth) pendingMonthly++;
        }
        if (cmd.status === 'Retard' || cmd.paymentStatus === 'Retard') {
          overdue++;
        }
      });

      this.pendingOrders = pending;
      this.pendingOrdersMonthly = pendingMonthly;
      this.overdueOrders = overdue;

      this.calculateOrderTrends();
    });
  }

    loadSupplierStats(): void {
    this.supplierService.getAll().pipe(
      map(suppliers => {
        const now = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        this.suppliersCount = suppliers.length;

        this.newSuppliers = suppliers.filter(s => {
          const creationDate = (s as any).creationDate;
          return creationDate && new Date(creationDate) >= lastMonth;
        }).length;
      })
    ).subscribe();
  }


 private calculateTrend(previousValue: number, currentValue: number): number {
    if (previousValue === 0) {
      return currentValue === 0 ? 0 : 100;
    }
    return ((currentValue - previousValue) / previousValue) * 100;
  }

  private calculateOrderTrends(): void {
    const lastMonthOverdue = 10;
    this.overdueTrend = this.calculateTrend(
      lastMonthOverdue,
      this.overdueOrders
    );
  }

loadProductAndStockCounts(): void {
    combineLatest([
      this.productService.getProducts(),
      this.stockService.getStock()
    ]).subscribe({
      next: ([products, stockItems]) => {
        this.totalProducts = products.length;
        this.totalStockItems = stockItems.reduce((sum, item) => sum + item.quantite, 0);

        this.activityService.logActivity(
          Stock mis à jour: ${this.totalProducts} produits, ${this.totalStockItems} unités en stock,
          'stock'
        );
      },
      error: (err) => {
        console.error('Erreur de chargement des comptes produits/stock:', err);
      }
    });
  }



 
  handleActivityAction(event: Event, activity: Activity, action: any): void {
    event.stopPropagation();

    switch(action.action) {
      case 'viewSaleDetails':
        this.viewSaleDetails(activity);
        break;
      case 'viewStockHistory':
        this.viewStockHistory(activity);
        break;
      default:
        console.log('Action non gérée:', action);
    }
  }

 private viewSaleDetails(activity: Activity): void {
    if (!activity.product) return;
    this.router.navigate(['/sales', activity.product.idProduit]);
  }

  private viewStockHistory(activity: Activity): void {
    if (!activity.product) return;
    this.router.navigate(['/stock', activity.product.idProduit, 'history']);
  }



private getActivityIcon(type: string): string {
  const icons: Record<string, string> = {
    'sales': 'shopping_cart',
    'stock': 'inventory',
    'alerts': 'warning',
    'system': 'settings'
  };
  return icons[type] || 'info';
}



  handleImageError(product: any): void {
    console.error('Erreur de chargement de l\'image pour le produit:', product.nomProduit, 'URL:', product.imageUrl);
    product.imageUrl = 'assets/default-product.png';
  }


 

    devices$: BehaviorSubject<MediaDeviceInfo[]> = new BehaviorSubject<MediaDeviceInfo[]>([]);
scannerActive = false;
hasPermission = false;
currentDevice: MediaDeviceInfo | undefined;
  availableDevices: MediaDeviceInfo[] = [];


toggleScanner(): void {
    this.showScanner = !this.showScanner;
    if (this.showScanner) {
      this.checkCameraPermissions();
    }
  }

  async checkCameraPermissions(): Promise<void> {
    try {
      if (!this.scanner) {
        console.warn('Scanner component not initialized');
        return;
      }

      this.scanner.camerasFound.subscribe((devices: MediaDeviceInfo[]) => {
        this.availableDevices = devices;
        this.hasPermission = devices.length > 0;
        if (devices.length > 0) {
          this.currentDevice = devices[0];
        }
      });

      this.scanner.camerasNotFound.subscribe(() => {
        console.warn('No cameras found');
        this.hasPermission = false;
      });

      this.scanner.permissionResponse.subscribe((perm: boolean) => {
        this.hasPermission = perm;
      });

    } catch (err) {
      console.error('Camera access error:', err);
      this.hasPermission = false;
    }
  }

  onScanSuccess(result: string): void {
    this.showScanner = false;

    try {
      const productId = this.extractProductId(result);
      if (!productId) {
        throw new Error('ID produit non trouvé');
      }

      switch (this.scanMode) {
        case 'edit':
          this.editProduct(productId);
          break;
        case 'delete':
          this.confirmDeleteScannedProduct(productId);
          break;
        case 'view':
          this.viewDetails(productId);
          break;
        default:
          this.lookupProduct(productId);
          break;
      }
    } catch (err) {
      this.snackBar.open('QR code non reconnu', 'Fermer', { duration: 3000 });
    }
  }

  private extractProductId(data: string): string | null {
    try {
      const parsed = JSON.parse(data);
      return parsed.id || null;
    } catch {
      return data.startsWith('PRD-') ? data : null;
    }
  }

  onScanError(error: any): void {
    console.error('Scan error:', error);
    this.snackBar.open('Erreur de scan - Vérifiez les permissions de la caméra', 'Fermer', {
      duration: 5000,
      panelClass: 'error-snackbar'
    });
  }

  private lookupProduct(productId: string): void {
    this.productService.getProductById(productId).subscribe({
      next: (product) => {
        if (product) {
          this.snackBar.open(Produit ${product.name} sélectionné, 'Fermer', {
            duration: 2000
          });
        } else {
          this.snackBar.open('Produit non trouvé', 'Fermer', {
            duration: 3000,
            panelClass: 'error-snackbar'
          });
        }
      },
      error: () => {
        this.snackBar.open('Erreur de recherche du produit', 'Fermer', {
          duration: 3000,
          panelClass: 'error-snackbar'
        });
      }
    });
  }

  private confirmDeleteScannedProduct(productId: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirmer la suppression',
        message: 'Voulez-vous vraiment supprimer ce produit scanné ?',
        cancelText: 'Annuler',
        confirmText: 'Supprimer'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.deleteProduct(productId);
      }
    });
  }

  deleteProduct(id: string): void {
    this.productService.deleteProduct(id)
      .then(() => {
        this.snackBar.open('Produit supprimé avec succès', 'Fermer', {
          duration: 3000,
          panelClass: 'success-snackbar'
        });
        this.loadProducts(); // Rafraîchit la liste des produits
      })
      .catch(error => {
        console.error('Erreur:', error);
        this.snackBar.open('Une erreur est survenue lors de la suppression du produit', 'Fermer', {
          duration: 3000,
          panelClass: 'error-snackbar'
        });
      });
  }

  editProduct(id: string): void {
    this.router.navigate(['/responsable/edit-product', id]);
  }

  viewDetails(id: string): void {
    this.router.navigate(['/responsable/product-details', id]);
  }





  // meriem
loadStockData(): void {
  combineLatest([
    this.stockService.getStock(),
    this.productService.getProducts()
  ]).subscribe({
    next: ([stockItems, products]) => {
      // Fusionner les données de stock et de produits
      this.lowStockProducts = stockItems.map(stockItem => {
        const product = products.find(p => p.id === stockItem.idProduit);
        return {
          ...stockItem,
          ...product,
          nomProduit: product?.name || stockItem.nomProduit,
          category: product?.category || 'Non classé',
          imageUrl: product?.imageUrl || 'assets/default-product.png'
        };
      }).filter(item => item.quantite <= item.seuil); // Filtrer les produits en rupture de stock

      // Mettre à jour la carte KPI
      this.kpiCards = this.kpiCards.map(card =>
        card.title === 'Produits en faible stock'
          ? { ...card, value: this.lowStockProducts.length }
          : card
      );

      // Calculer les jours jusqu'à la rupture de stock
      this.calculateDaysUntilStockout();
    },
    error: err => {
      console.error('Erreur de chargement du stock:', err);
      this.snackBar.open('Erreur de chargement des données de stock', 'Fermer', {
        duration: 3000,
        panelClass: 'error-snackbar'
      });
    }
  });
}


// Ajoutez cette méthode pour calculer les jours jusqu'à la rupture
private calculateDaysUntilStockout(): void {
  this.saleService.getSalesHistory('week').subscribe(sales => {
    // Calculer la demande moyenne par produit
    const demandMap = new Map<string, number>();

    sales.forEach(sale => {
      sale.items.forEach((item: any) => {
        const current = demandMap.get(item.productId) || 0;
        demandMap.set(item.productId, current + item.quantity);
      });
    });

    // Mettre à jour les produits avec les jours estimés jusqu'à rupture
    this.lowStockProducts = this.lowStockProducts.map(product => {
      const weeklyDemand = demandMap.get(product.idProduit) || 1;
      const dailyDemand = weeklyDemand / 7;
      const daysLeft = dailyDemand > 0 ? Math.floor(product.quantite / dailyDemand) : 0;

      return {
        ...product,
        daysUntilStockout: daysLeft,
        lastSaleDate: this.getLastSaleDate(product.idProduit, sales)
      };
    });
  });
}

private getLastSaleDate(productId: string, sales: any[]): string {
  const productSales = sales.filter(sale =>
    sale.items.some((item: any) => item.productId === productId)
  );

  if (productSales.length > 0) {
    const lastSale = productSales.reduce((latest, sale) =>
      new Date(sale.date) > new Date(latest.date) ? sale : latest
    );
    return lastSale.date;
  }

  return new Date().toISOString();
}

// Modifiez votre méthode loadProducts() comme suit :
loadProducts(): void {
  this.productService.getProducts().subscribe({
    next: (products) => {
      // Cette méthode est maintenant principalement gérée par loadStockData()
      console.log('Produits chargés:', products.length);
    },
    error: (err) => {
      console.error('Erreur de chargement des produits:', err);
      this.snackBar.open('Erreur de chargement des produits', 'Fermer', {
        duration: 3000,
        panelClass: 'error-snackbar'
      });
    }
  });
}

viewProductDetails(productId: string): void {
  this.router.navigate(['/responsable/product-details', productId]);
}
// meriem
createProductDistributionChart(products: any[]): void {
    if (!products || products.length === 0) {
      console.error('No products data available');
      return;
    }

    const productsByCategory = products.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = 0;
      }
      acc[product.category]++;
      return acc;
    }, {});

    const labels = Object.keys(productsByCategory);
    const data = Object.values(productsByCategory);

    if (this.productDistributionChart) {
      this.productDistributionChart.destroy();
    }

    this.productDistributionChart = new Chart('productDistributionChart', {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          label: 'Produits par Catégorie',
          data: data,
          backgroundColor: [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Répartition des Produits'
          }
        }
      }
    });
  }



 createStockChart(stockItems: StockItem[]): void {
    // Filtrer les catégories "Non classé"
    const filteredStockItems = stockItems.filter(item => item.category !== 'Non classé');

    // Vérifiez que les données de catégorie sont disponibles
    const categories = [...new Set(filteredStockItems.map(item => item.category || 'Non classé'))];
    const stockData = categories.map(category => {
      return filteredStockItems
        .filter(item => (item.category || 'Non classé') === category)
        .reduce((sum, item) => sum + item.quantite, 0);
    });

    console.log('Categories:', categories); // Log pour vérifier les catégories
    console.log('Stock Data:', stockData); // Log pour vérifier les données de stock

    const ctx = document.getElementById('stockChart') as HTMLCanvasElement;
    if (!ctx) {
      console.error('Canvas element not found');
      return;
    }

    if (this.stockChart) {
      this.stockChart.destroy();
    }

    this.stockChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [{
          label: 'Quantité en stock',
          data: stockData,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Stock par catégorie',
            font: {
              size: 14
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
  createSalesChart(): void {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);

    this.saleService.getSalesByDateRange(
      startOfWeek.toISOString(),
      today.toISOString()
    ).subscribe(sales => {
      const salesByDay = sales.reduce((acc, sale) => {
        const date = new Date(sale.date).toLocaleDateString();
        acc[date] = (acc[date] || 0) + sale.totalAmount;
        return acc;
      }, {} as Record<string, number>);

      const labels = Object.keys(salesByDay);
      const data = Object.values(salesByDay);

      const ctx = document.getElementById('salesChart') as HTMLCanvasElement;
      if (this.salesChart) {
        this.salesChart.destroy();
      }

      this.salesChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Ventes (DT)',
            data: data,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.1,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: 'Ventes des 7 derniers jours',
              font: {
                size: 14
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    });
  }

  createProductChart(): void {
    this.productService.getProducts().subscribe(products => {
      const categories = [...new Set(products.map(p => p.category || 'Non classé'))];
      const productCount = categories.map(category =>
        products.filter(p => p.category === category).length
      );

      const ctx = document.getElementById('productChart') as HTMLCanvasElement;
      if (this.productChart) {
        this.productChart.destroy();
      }

      this.productChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: categories,
          datasets: [{
            data: productCount,
            backgroundColor: [
              'rgba(255, 99, 132, 0.7)',
              'rgba(54, 162, 235, 0.7)',
              'rgba(255, 206, 86, 0.7)',
              'rgba(75, 192, 192, 0.7)',
              'rgba(153, 102, 255, 0.7)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
            },
            title: {
              display: true,
              text: 'Répartition des produits',
              font: {
                size: 14
              }
            }
          },
          cutout: '60%'
        }
      });
    });
  }

  

}