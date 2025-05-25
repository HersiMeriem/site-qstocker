import { Component, OnInit, ViewChild, ElementRef, OnDestroy, Inject } from '@angular/core';
import { Chart, ChartType, ChartDataset, registerables } from 'chart.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import { debounceTime, Subject, Subscription, Observable, combineLatest } from 'rxjs';
import { AppNotification } from 'src/app/services/notification.service';
import { Report, ReportType, ReportData } from 'src/app/models/report';
import { ReportService } from '../../services/report.service';
import { NotificationService } from '../../services/notification.service';
import { UserService } from 'src/app/services/user.service';
import { StockService } from '../../services/stock.service';
import { SaleService } from '../../services/sale.service';
Chart.register(...registerables);

@Component({
  selector: 'app-analytics-report-management',
  templateUrl: './analytics-report-management.component.html',
  styleUrls: ['./analytics-report-management.component.css'],
})
export class AnalyticsReportManagementComponent implements OnInit, OnDestroy {
  @ViewChild('reportChart') chartCanvas!: ElementRef<HTMLCanvasElement>;

  reports: Report[] = [];
  filteredReports: Report[] = [];
  selectedReport: Report | null = null;
  reportCriteria = {
    type: 'sales' as ReportType,
    startDate: this.getFormattedDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    endDate: this.getFormattedDate(new Date()),
    name: '',
  };
  chartInstance: Chart | null = null;
  reportData: any = {};
  searchQuery = '';
  private searchSubject = new Subject<string>();
  filterType: 'all' | ReportType = 'all';
  activeTab: 'chart' | 'table' = 'chart';
  isLoading = false;
  generationProgress = 0;
  currentChartType: ChartType = 'bar';
  tableHeaders: string[] = [];
  tableData: (string | number)[][] = [];
  errors: { [key: string]: string } = {};
  paymentMethods = ['cash', 'card', 'credit'];

  kpiData: {
    title: string;
    mainValue: string;
    mainLabel: string;
    warning?: boolean;
    items: {
      value: any;
      label: string;
      warning?: boolean;
    }[];
  } | null = null;

public notification$: Observable<AppNotification>;

  private subscriptions = new Subscription();

  constructor(
    @Inject(ReportService) private reportService: ReportService,
    private notificationService: NotificationService,
    private userService: UserService,
    private stockService: StockService,
    private saleService: SaleService
  ) {
    this.notification$ = this.notificationService.notification$;
  }

  ngOnInit(): void {
    this.loadReports();
    this.setupSearchDebounce();
    this.setupRealTimeUpdates();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  }

renderChart(report: Report): void {
  if (this.chartInstance) {
    this.chartInstance.destroy();
  }

  const ctx = this.chartCanvas?.nativeElement.getContext('2d');
  if (!ctx) return;

  const chartData = this.prepareChartData(report);

  this.chartInstance = new Chart(ctx, {
    type: this.currentChartType,
    data: chartData,
    options: this.getChartOptions(report.type)
  });
}

  private prepareChartData(report: Report): { labels: string[]; datasets: ChartDataset[] } {
    switch (report.type) {
      case 'sales':
        return this.prepareSalesChartData(report.data);
      case 'inventory':
        return this.prepareInventoryChartData(report.data);
      case 'users':
        return this.prepareUsersChartData(report.data);
      default:
        return { labels: [], datasets: [] };
    }
  }

 private prepareSalesChartData(data: ReportData[]): { labels: string[]; datasets: ChartDataset[] } {
  // Données pour les graphiques barres/ligne
  if (this.currentChartType === 'bar' || this.currentChartType === 'line') {
    // Filtrer les données pour n'avoir que les périodes (exclure Totaux et Moyennes)
    const periodData = data.filter(item => 
      item['période'] && 
      item['période'] !== 'Total' && 
      item['période'] !== 'Moyenne/vente'
    );

    if (periodData.length > 0) {
      // Cas normal avec données par période
      return {
        labels: periodData.map(item => String(item['période'])),
        datasets: [
          {
            label: 'Nombre de ventes',
            data: periodData.map(item => Number(item['ventes'] || 0)),
            backgroundColor: '#36A2EB',
            borderColor: '#2980B9',
            yAxisID: 'y'
          },
          {
            label: 'Revenu (DT)',
            data: periodData.map(item => Number(item['revenu'] || 0)),
            backgroundColor: '#2ECC71',
            borderColor: '#27AE60',
            yAxisID: 'y1'
          }
        ]
      };
    } else {
      // Fallback si pas de données par période
      const totalItem = data.find(item => item['période'] === 'Total');
      const avgItem = data.find(item => item['période'] === 'Moyenne/vente');
      
      return {
        labels: ['Total', 'Moyenne'],
        datasets: [
          {
            label: 'Ventes',
            data: [
              totalItem ? Number(totalItem['ventes'] || 0) : 0,
              avgItem ? Number(avgItem['ventes'] || 0) : 0
            ],
            backgroundColor: '#36A2EB',
            borderColor: '#2980B9',
            yAxisID: 'y'
          },
          {
            label: 'Revenu (DT)',
            data: [
              totalItem ? Number(totalItem['revenu'] || 0) : 0,
              avgItem ? Number(avgItem['revenu'] || 0) : 0
            ],
            backgroundColor: '#2ECC71',
            borderColor: '#27AE60',
            yAxisID: 'y1'
          }
        ]
      };
    }
  }

  // Données pour les graphiques camembert/anneau
  const paymentData = data.filter(item => item['méthode']);
  if (paymentData.length > 0) {
    // Utiliser les méthodes de paiement si disponibles
    return {
      labels: paymentData.map(item => String(item['méthode'])),
      datasets: [{
        label: 'Méthodes de paiement',
        data: paymentData.map(item => Number(item['count'] || 0)),
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', 
          '#4BC0C0', '#9966FF', '#FF9F40'
        ]
      }]
    };
  } else {
    // Fallback: utiliser Total vs Moyenne
    const totalItem = data.find(item => item['période'] === 'Total');
    const avgItem = data.find(item => item['période'] === 'Moyenne/vente');
    
    return {
      labels: ['Total', 'Moyenne'],
      datasets: [{
        label: 'Comparaison',
        data: [
          totalItem ? Number(totalItem['ventes'] || 0) : 0,
          avgItem ? Number(avgItem['ventes'] || 0) : 0
        ],
        backgroundColor: ['#36A2EB', '#FFCE56']
      }]
    };
  }
}
  
  private prepareInventoryChartData(data: ReportData[]): { labels: string[]; datasets: ChartDataset[] } {
    const labels = data.map(item => String(item['métrique']));
    const values = data.map(item => Number(item['valeur']));
  
    return {
      labels,
      datasets: [{
        label: 'Valeur',
        data: values,
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF'
        ]
      }]
    };
  }
  
  private prepareUsersChartData(data: ReportData[]): { labels: string[]; datasets: ChartDataset[] } {
    // Filtrer pour n'inclure que les statuts pertinents (exclure 'Total')
    const filteredData = data.filter(item => 
      item['statut'] !== 'Total' && item['count'] !== undefined
    );
  
    const labels = filteredData.map(item => String(item['statut']));
    const counts = filteredData.map(item => Number(item['count']));
  
    // Pour les graphiques pie/doughnut, nous n'avons besoin que d'un seul dataset
    return {
      labels,
      datasets: [{
        label: 'Nombre d\'utilisateurs',
        data: counts,
        backgroundColor: [
          '#36A2EB', // Approuvés
          '#FFCE56', // En attente
          '#FF6384'  // Bloqués
        ],
        borderWidth: 1
      }]
    };
  }
  
  private getChartOptions(reportType: ReportType): any {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          position: 'top',
          // Pour les graphiques circulaires, afficher la légende à droite
          ...(this.currentChartType === 'pie' || this.currentChartType === 'doughnut' ? {
            position: 'right'
          } : {})
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed !== null && context.parsed !== undefined) {
                label += context.parsed;
                // Ajouter le pourcentage pour les graphiques circulaires
                if (this.currentChartType === 'pie' || this.currentChartType === 'doughnut') {
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  const percentage = Math.round((context.parsed / total) * 100);
                  label += ` (${percentage}%)`;
                }
              }
              return label;
            }
          }
        }
      }
    };
  
  
    if (reportType === 'sales') {
      return {
        ...baseOptions,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Nombre de ventes' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Revenu (DT)' },
            grid: { drawOnChartArea: false }
          }
        }
      };
    }
  
    return baseOptions;
  }

  loadReportData(type: ReportType) {
    this.isLoading = true;
    
    switch(type) {
      case 'users':
        this.userService.getUserStats().subscribe(data => {
          this.reportData = data;
          this.prepareUserCharts();
          this.isLoading = false;
        });
        break;
        
      case 'inventory':
        this.stockService.getStockReport().subscribe(data => {
          this.reportData = data;
          this.prepareInventoryCharts();
          this.isLoading = false;
        });
        break;
        
      case 'sales':
        this.saleService.getSalesReport().subscribe(data => {
          this.reportData = data;
          this.prepareSalesCharts();
          this.isLoading = false;
        });
        break;
    }
  }

  private prepareUserCharts() {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  
    this.chartInstance = new Chart(ctx, {
      type: this.currentChartType || 'pie',
      data: {
        labels: ['Approuvés', 'En attente', 'Bloqués'],
        datasets: [{
          data: [
            this.reportData.byStatus.approved,
            this.reportData.byStatus.pending,
            this.reportData.byStatus.blocked
          ],
          backgroundColor: [
            '#36A2EB',
            '#FFCE56',
            '#FF6384'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Répartition des Utilisateurs par Statut'
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  
    // Préparer les données pour le tableau
    this.tableHeaders = ['Statut', 'Nombre', 'Pourcentage'];
    this.tableData = [
      ['Approuvés', this.reportData.byStatus.approved, 
       ((this.reportData.byStatus.approved / this.reportData.total) * 100).toFixed(2) + '%'],
      ['En attente', this.reportData.byStatus.pending, 
       ((this.reportData.byStatus.pending / this.reportData.total) * 100).toFixed(2) + '%'],
      ['Bloqués', this.reportData.byStatus.blocked, 
       ((this.reportData.byStatus.blocked / this.reportData.total) * 100).toFixed(2) + '%'],
      ['Total', this.reportData.total, '100%']
    ];
  }

// Modifiez la méthode loadReports()
loadReports(): void {
  this.isLoading = true;
  this.reportService.getReports().subscribe({
    next: (reports) => {
      // Filtrer pour supprimer le rapport "users" par défaut
      this.reports = reports.filter(report => 
        !(report.type === 'users' && report.name.includes('Rapport Utilisateurs'))
      );
      this.applyFilters();
      this.isLoading = false;
    },
    error: (err) => {
      console.error('Error loading reports:', err);
      this.isLoading = false;
    }
  });
}

deleteReport(report: Report): void {
  if (!report || !report.id) return;

  if (confirm(`Êtes-vous sûr de vouloir supprimer le rapport "${report.name}" ?`)) {
    this.isLoading = true;
    this.reportService.deleteReport(report.id).subscribe({
      next: () => {
        this.reports = this.reports.filter(r => r.id !== report.id);
        this.applyFilters();
        this.selectedReport = null;
        this.notificationService.success('Rapport supprimé avec succès');
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error deleting report:', err);
        this.notificationService.error('Erreur lors de la suppression du rapport');
        this.isLoading = false;
      }
    });
  }
}

  private prepareInventoryCharts() {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  
    this.chartInstance = new Chart(ctx, {
      type: this.currentChartType === 'pie' ? 'bar' : this.currentChartType,
      data: {
        labels: ['Produits', 'Articles', 'Valeur Totale', 'Stock Bas'],
        datasets: [{
          label: 'Statistiques du Stock',
          data: [
            this.reportData.totalProducts,
            this.reportData.totalItems,
            this.reportData.totalValue / 1000,
            this.reportData.lowStock
          ],
          backgroundColor: [
            '#4BC0C0',
            '#9966FF',
            '#FF9F40',
            '#FF6384'
          ]
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: this.currentChartType === 'pie' ? '' : 'Quantité'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Analyse du Stock'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  if (context.dataIndex === 2) {
                    label += (context.parsed.y * 1000).toFixed(2) + ' DT';
                  } else {
                    label += context.parsed.y;
                  }
                }
                return label;
              }
            }
          }
        }
      }
    });
  
    // Préparer les données pour le tableau
    this.tableHeaders = ['Métrique', 'Valeur'];
    this.tableData = [
      ['Nombre de produits', this.reportData.totalProducts],
      ['Nombre total d\'articles', this.reportData.totalItems],
      ['Valeur totale du stock', this.reportData.totalValue.toFixed(2) + ' DT'],
      ['Produits en stock bas', this.reportData.lowStock],
      ['Dernière mise à jour', new Date(this.reportData.lastUpdated).toLocaleString()]
    ];
  }

  private prepareSalesCharts() {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  
    this.chartInstance = new Chart(ctx, {
      type: this.currentChartType || 'bar',
      data: {
        labels: ['Ventes Total', 'Ventes Aujourd\'hui', 'CA Total', 'CA Aujourd\'hui', 'Moyenne/vente'],
        datasets: [{
          label: 'Statistiques de Ventes',
          data: [
            this.reportData.totalSales,
            this.reportData.todaySales,
            this.reportData.totalRevenue / 1000,
            this.reportData.todayRevenue / 1000,
            this.reportData.avgSale / 100
          ],
          backgroundColor: '#36A2EB'
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Performances Commerciales'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  if ([2, 3, 4].includes(context.dataIndex)) {
                    const multiplier = context.dataIndex === 4 ? 100 : 1000;
                    label += (context.parsed.y * multiplier).toFixed(2) + ' DT';
                  } else {
                    label += context.parsed.y;
                  }
                }
                return label;
              }
            }
          }
        }
      }
    });
  
    // Préparer les données pour le tableau
    this.tableHeaders = ['Métrique', 'Valeur'];
    this.tableData = [
      ['Total des ventes', this.reportData.totalSales],
      ['Ventes aujourd\'hui', this.reportData.todaySales],
      ['Chiffre d\'affaires total', this.reportData.totalRevenue.toFixed(2) + ' DT'],
      ['CA aujourd\'hui', this.reportData.todayRevenue.toFixed(2) + ' DT'],
      ['Moyenne par vente', this.reportData.avgSale.toFixed(2) + ' DT']
    ];
  
    // Ajouter les méthodes de paiement
    this.paymentMethods.forEach(method => {
      this.tableData.push([
        `Paiements par ${this.getPaymentMethodLabel(method)}`,
        this.reportData.paymentMethods[method]
      ]);
    });
  }
  
  private getPaymentMethodLabel(method: string): string {
    switch(method) {
      case 'cash': return 'Espèces';
      case 'card': return 'Carte';
      case 'credit': return 'Crédit';
      default: return method;
    }
  }

  generateReport(): void {
    if (!this.validateReportCriteria()) return;
  
    this.isLoading = true;
    this.generationProgress = 0;
    
    const progressInterval = setInterval(() => {
      this.generationProgress += 5;
      if (this.generationProgress >= 100) {
        clearInterval(progressInterval);
      }
    }, 100);
  
    // Ajouter un filtre pour éviter les doublons
    const sub = this.reportService.generateReport(this.reportCriteria).subscribe({
      next: (report) => {
        // Vérifier si le rapport existe déjà
        const existingIndex = this.reports.findIndex(r => 
          r.name === report.name && 
          r.generatedDate.getTime() === report.generatedDate.getTime()
        );
        
        if (existingIndex === -1) {
          this.reports = [report, ...this.reports]; // Utiliser spread operator pour immutabilité
        }
        
        this.applyFilters();
        this.previewReport(report);
        this.isLoading = false;
        this.generationProgress = 100;
        this.notificationService.success('Rapport généré et sauvegardé');
        sub.unsubscribe(); // Nettoyer la souscription
      },
      error: (err) => {
        console.error('Error generating report:', err);
        this.isLoading = false;
        this.generationProgress = 0;
        this.notificationService.error('Erreur de génération du rapport');
        sub.unsubscribe(); // Nettoyer la souscription
      }
    });
  }

  private validateReportCriteria(): boolean {
    this.errors = {};
    let isValid = true;

    if (!this.reportCriteria.type) {
      this.errors['type'] = 'Le type de rapport est requis';
      isValid = false;
    }

    if (!this.reportCriteria.startDate) {
      this.errors['startDate'] = 'La date de début est requise';
      isValid = false;
    }

    if (!this.reportCriteria.endDate) {
      this.errors['endDate'] = 'La date de fin est requise';
      isValid = false;
    }

    if (this.reportCriteria.startDate && this.reportCriteria.endDate) {
      const start = new Date(this.reportCriteria.startDate);
      const end = new Date(this.reportCriteria.endDate);
      
      if (start > end) {
        this.errors['dateRange'] = 'La date de début doit être antérieure à la date de fin';
        isValid = false;
      }
    }

    return isValid;
  }

  private setupRealTimeUpdates(): void {
    this.subscriptions.add(
      combineLatest([
        this.userService.getUserStats(),
        this.stockService.getStockReport(),
        this.saleService.getSalesHistory('today')
      ]).pipe(
        debounceTime(1000)
      ).subscribe(([userStats, stockReport, sales]) => {
        this.reports = this.reports.map(report => {
          const metadata = report.metadata || {
            generatedBy: '',
            generationTime: 0,
            recordsProcessed: 0,
            lastUpdated: '',
            dateDébut: '',
            dateFin: ''
          };
          
          switch(report.type) {
            case 'users':
              return {
                ...report,
                data: [
                  { statut: 'Approuvés', count: userStats.byStatus.approved },
                  { statut: 'En attente', count: userStats.byStatus.pending },
                  { statut: 'Bloqués', count: userStats.byStatus.blocked },
                  { statut: 'Total', count: userStats.total }
                ] as ReportData[],
                metadata: {
                  ...metadata,
                  lastUpdated: userStats.lastUpdated,
                  generatedBy: metadata.generatedBy || 'Système',
                  generationTime: metadata.generationTime || 0,
                  recordsProcessed: metadata.recordsProcessed || userStats.total
                }
              };
            case 'inventory':
              return {
                ...report,
                data: [
                  { métrique: 'Produits', valeur: stockReport.totalProducts, unité: '' },
                  { métrique: 'Articles', valeur: stockReport.totalItems, unité: '' },
                  { métrique: 'Valeur totale', valeur: stockReport.totalValue, unité: 'DT' },
                  { métrique: 'Stock bas', valeur: stockReport.lowStock, unité: '' }
                ] as ReportData[],
                metadata: {
                  ...metadata,
                  lastUpdated: stockReport.lastUpdated,
                  generatedBy: metadata.generatedBy || 'Système',
                  generationTime: metadata.generationTime || 0,
                  recordsProcessed: metadata.recordsProcessed || stockReport.totalProducts
                }
              };
            default:
              return report;
          }
        });
        
        if (this.selectedReport) {
          this.previewReport(this.selectedReport);
        }
      })
    );
  }

  previewReport(report: Report): void {
  this.selectedReport = report;
  this.prepareTableData(report);
  this.renderChart(report);
  this.prepareKPIData(report.data, report.type);
    switch(report.type) {
      case 'sales':
        this.prepareSalesKPIData(report.data);
        break;
      case 'inventory':
        this.prepareInventoryKPIData(report.data);
        break;
      case 'users':
        this.prepareUsersKPIData(report.data);
        break;
    }
}

  private prepareSalesKPIData(data: any): void {
    // Trouver les données nécessaires
    const totalItem = data.find((item: any) => item.statut === 'Total' || item.période === 'Total');
    const avgItem = data.find((item: any) => item.statut === 'Moyenne' || item.période === 'Moyenne/vente');
    
    // Extraire les valeurs avec des fallbacks sécurisés
    const totalRevenue = totalItem?.revenu || totalItem?.valeur || 0;
    const avgSale = avgItem?.revenu || avgItem?.valeur || 0;
    const totalSales = totalItem?.ventes || totalItem?.count || 0;

    this.kpiData = {
      title: '💰 Ventes',
      mainValue: `${totalRevenue.toFixed(2)} DT`,
      mainLabel: 'CA Total',
      items: [
        { value: totalSales, label: 'Ventes' },
        { value: `${totalRevenue.toFixed(2)} DT`, label: 'Total' },
        { value: `${avgSale.toFixed(2)} DT`, label: 'Moyenne' }
      ]
    };
}

  private prepareInventoryKPIData(data: any): void {
    const totalProducts = data.find((item: any) => item.métrique === 'Produits')?.valeur || 0;
    const totalItems = data.find((item: any) => item.métrique === 'Articles')?.valeur || 0;
    const totalValue = data.find((item: any) => item.métrique === 'Valeur totale')?.valeur || 0;
    const lowStock = data.find((item: any) => item.métrique === 'Stock bas')?.valeur || 0;

    this.kpiData = {
      title: '📦 Stock',
      mainValue: totalProducts,
      mainLabel: 'Produits',
      items: [
        { value: totalItems, label: 'Articles' },
        { value: `${totalValue.toFixed(2)} DT`, label: 'Valeur' },
        { value: lowStock, label: 'Stock bas', warning: true }
      ]
    };
  }

  private prepareUsersKPIData(data: any): void {
    const approved = data.find((item: any) => item.statut === 'Approuvés')?.count || 0;
    const pending = data.find((item: any) => item.statut === 'En attente')?.count || 0;
    const blocked = data.find((item: any) => item.statut === 'Bloqués')?.count || 0;
    const total = data.find((item: any) => item.statut === 'Total')?.count || 0;

    this.kpiData = {
      title: '👥 Utilisateurs',
      mainValue: total,
      mainLabel: 'Total',
      items: [
        { value: approved, label: 'Approuvés' },
        { value: pending, label: 'En attente' },
        { value: blocked, label: 'Bloqués' }
      ]
    };
  }

  exportToPDF(report: Report): void {
    const doc = new jsPDF();
    
    // Titre
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text(report.name, 105, 20, { align: 'center' });
    
    // Métadonnées
    doc.setFontSize(10);
    doc.setTextColor(100);
    const metadata = [
      `Généré le: ${report.generatedDate.toLocaleDateString()}`,
      `Type: ${this.getReportTypeLabel(report.type)}`,
      `Enregistrements: ${report.metadata?.recordsProcessed || 'N/A'}`,
    ];
    
    if (report.metadata?.dateDébut) {
      metadata.push(`Période: ${report.metadata.dateDébut} au ${report.metadata.dateFin}`);
    }
    
    autoTable(doc, {
      body: metadata.map(m => [m]),
      startY: 30,
      styles: { cellPadding: 2, fontSize: 10 },
      theme: 'plain'
    });
  
    // Graphique
    if (this.chartInstance) {
      const canvas = this.chartCanvas.nativeElement;
      const canvasImage = canvas.toDataURL('image/png');
      doc.addImage(canvasImage, 'PNG', 15, 60, 180, 100);
    }
  
    // Données
    autoTable(doc, {
      head: [this.tableHeaders],
      body: this.tableData,
      startY: 170,
      styles: { cellPadding: 5, fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] }
    });
  
    // Pied de page
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Exporté depuis StockFlow - ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });
  
    doc.save(`${report.name}.pdf`);
  }

  private getReportTypeLabel(type: ReportType): string {
    const types = {
      'sales': 'Ventes',
      'inventory': 'Stock',
      'users': 'Utilisateurs'
    };
    return types[type] || type;
  }

  async exportToExcel(report: Report) {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rapport');
    
    // Titre
    worksheet.mergeCells('A1:C1');
    worksheet.getCell('A1').value = `Rapport ${report.name}`;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    
    // En-têtes
    worksheet.addRow(this.tableHeaders);
    
    // Données
    this.tableData.forEach(row => worksheet.addRow(row));
    
    // Style
    worksheet.columns.forEach(column => {
      if (column.values) {
        const lengths = column.values.map(value => {
          if (value === null || value === undefined) return 0;
          return String(value).length;
        });
        const maxLength = Math.max(...lengths, 10);
        column.width = maxLength + 2;
      } else {
        column.width = 12;
      }
    });
    
    // Générer le fichier
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `rapport_${report.name}.xlsx`);
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  exportToCSV(report: Report): void {
    try {
      const csv = this.convertToCSV(report.data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `${report.name}.csv`);
      this.notificationService.success('CSV exporté avec succès');
    } catch (err) {
      this.notificationService.error('Erreur lors de l\'exportation en CSV');
    }
  }

  private setupSearchDebounce(): void {
    this.subscriptions.add(
      this.searchSubject.pipe(debounceTime(300)).subscribe((query) => {
        this.searchQuery = query;
        this.applyFilters();
      })
    );
  }

  public applyFilters(): void {
    this.filteredReports = this.reports.filter((report) => {
      const matchesSearch = report.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesType = this.filterType === 'all' || report.type === this.filterType;
      return matchesSearch && matchesType;
    });
  }

  private getFormattedDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private validateForm(): void {
    this.errors = {};
    if (!this.reportCriteria.type) {
      this.errors['type'] = 'Le type de rapport est requis';
    }
    if (!this.reportCriteria.startDate) {
      this.errors['startDate'] = 'La date de début est requise';
    }
    if (!this.reportCriteria.endDate) {
      this.errors['endDate'] = 'La date de fin est requise';
    }
    if (this.reportCriteria.startDate && this.reportCriteria.endDate) {
      const start = new Date(this.reportCriteria.startDate);
      const end = new Date(this.reportCriteria.endDate);
      if (start > end) {
        this.errors['dateRange'] = 'La date de début doit être antérieure à la date de fin';
      }
    }
  }

private prepareKPIData(reportData: any, type: ReportType): void {
  if (!reportData) return;

  switch(type) {
    case 'sales':
      // Use different variable names for sales data
      const salesTotalItem = reportData.find((item: any) => item.statut === 'Total' || item.période === 'Total');
      const salesAvgItem = reportData.find((item: any) => item.statut === 'Moyenne' || item.période === 'Moyenne/vente');
      
      this.kpiData = {
        title: '💰 Ventes',
        mainValue: `${(salesTotalItem?.revenu || salesTotalItem?.valeur || 0).toFixed(2)} DT`,
        mainLabel: 'CA Total',
        items: [
          { value: salesTotalItem?.ventes || salesTotalItem?.count || 0, label: 'Ventes' },
          { value: `${(salesTotalItem?.revenu || salesTotalItem?.valeur || 0).toFixed(2)} DT`, label: 'Total' },
          { value: `${(salesAvgItem?.revenu || salesAvgItem?.valeur || 0).toFixed(2)} DT`, label: 'Moyenne' }
        ]
      };
      break;
    
    case 'inventory':
      // Use different variable names for inventory data
      const inventoryProductsItem = reportData.find((item: any) => item.métrique === 'Produits');
      const inventoryItemsItem = reportData.find((item: any) => item.métrique === 'Articles');
      const inventoryValueItem = reportData.find((item: any) => item.métrique === 'Valeur totale');
      const inventoryLowStockItem = reportData.find((item: any) => item.métrique === 'Stock bas');

      this.kpiData = {
        title: '📦 Stock',
        mainValue: inventoryProductsItem?.valeur || 0,
        mainLabel: 'Produits',
        items: [
          { value: inventoryItemsItem?.valeur || 0, label: 'Articles' },
          { value: `${(inventoryValueItem?.valeur || 0).toFixed(2)} DT`, label: 'Valeur' },
          { 
            value: inventoryLowStockItem?.valeur || 0, 
            label: 'Stock bas', 
            warning: (inventoryLowStockItem?.valeur || 0) > 0 
          }
        ]
      };
      break;
    
    case 'users':
      // Use different variable names for users data
      const usersApprovedItem = reportData.find((item: any) => item.statut === 'Approuvés');
      const usersPendingItem = reportData.find((item: any) => item.statut === 'En attente');
      const usersBlockedItem = reportData.find((item: any) => item.statut === 'Bloqués');
      const usersTotalItem = reportData.find((item: any) => item.statut === 'Total');

      this.kpiData = {
        title: '👥 Utilisateurs',
        mainValue: usersTotalItem?.count || 0,
        mainLabel: 'Total',
        items: [
          { value: usersApprovedItem?.count || 0, label: 'Approuvés' },
          { value: usersPendingItem?.count || 0, label: 'En attente' },
          { value: usersBlockedItem?.count || 0, label: 'Bloqués' }
        ]
      };
      break;
  }
}

  private prepareTableData(report: Report): void {
    if (report.data.length === 0) {
      this.tableHeaders = [];
      this.tableData = [];
      return;
    }
    this.tableHeaders = Object.keys(report.data[0]);
    this.tableData = report.data.map((item) =>
      this.tableHeaders.map((header) => item[header] as string | number)
    );
  }


  private convertToCSV(data: ReportData[]): string {
    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((header) => row[header]).join(','));
    return [headers.join(','), ...rows].join('\n');
  }
}