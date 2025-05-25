import { Component, OnInit, ViewChild } from '@angular/core';
import { StockService } from '../../services/stock.service';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { SnapshotAction } from '@angular/fire/compat/database';
import { Chart, registerables } from 'chart.js';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SaleService } from '../../services/sale.service';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { jsPDF } from 'jspdf';
import { BehaviorSubject, combineLatest } from 'rxjs';
import autoTable from 'jspdf-autotable';
import { Router } from '@angular/router';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import * as XLSX from 'xlsx';
import { ActivityService } from '../../services/activity.service';
import { ProductService } from '../../services/product.service';
import { TimeAgoPipe } from 'src/app/pipes/time-ago.pipe';
import { DatePipe } from '@angular/common';
interface Activity {
  type: 'sales' | 'stock' | 'alerts' | 'system';
  icon: string;
  message: string;
  time: Date;
  user?: string;
  product?: {
    idProduit: string;
    nomProduit: string;
  };
  amount?: number;
}

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css'],
  providers: [TimeAgoPipe,DatePipe]
})
export class StatisticsComponent implements OnInit {
  @ViewChild('scanner') scanner!: ZXingScannerComponent;
  scannerActive = false;
  stats: any = {
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    totalSoldProducts: 0,
    totalStockedProducts: 0
  };

  isDarkMode = false;
  salesData: { productName: string, sales: number }[] = [];
topSellingPerfumes: { name: string, sales: number }[] = [];
  searchQuery = '';
  lowStockProducts: any[] = [];
  pendingUsers: any[] = [];
  calendarOptions!: CalendarOptions;
  calendarEvents: EventInput[] = [];
  loading: boolean | undefined;
  supportedFormats: BarcodeFormat[] = [BarcodeFormat.QR_CODE];
  
  // Activités et filtres
  filteredActivities: Activity[] = [];
  recentActivities: Activity[] = [];
  activityStats = {
    sales: 0,
    stock: 0,
    alerts: 0,
    system: 0
  };

  constructor(
    private db: AngularFireDatabase,
    private stockService: StockService,
    private saleService: SaleService,
    private router: Router,
    private snackBar: MatSnackBar,
    private activityService: ActivityService,
    private productService: ProductService
  ) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.getStatistics();
    this.loadSalesData();
    this.loadLowStockProducts();
    this.loadPendingUsers();
    this.initCalendar();
    this.loadCalendarEvents();
    this.loadRecentActivities();
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

  // Méthodes pour les produits en rupture
  loadLowStockProducts(): void {
    combineLatest([
      this.stockService.getStock(),
      this.productService.getProducts()
    ]).subscribe({
      next: ([stockItems, products]) => {
        this.lowStockProducts = stockItems.map(stockItem => {
          const product = products.find(p => p.id === stockItem.idProduit);
          return {
            ...stockItem,
            ...product,
            nomProduit: product?.name || stockItem.nomProduit,
            category: product?.category || 'Non classé',
            imageUrl: product?.imageUrl || 'assets/default-product.png'
          };
        }).filter(item => item.quantite <= item.seuil);

        this.stats.lowStockProducts = this.lowStockProducts.length;
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

  private calculateDaysUntilStockout(): void {
    this.saleService.getSalesHistory('week').subscribe(sales => {
      const demandMap = new Map<string, number>();

      sales.forEach(sale => {
        sale.items.forEach((item: any) => {
          const current = demandMap.get(item.productId) || 0;
          demandMap.set(item.productId, current + item.quantity);
        });
      });

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

  getStockProgressColor(product: any): string {
    const percentage = (product.quantite / product.seuil) * 100;
    if (percentage <= 15) return 'warn';
    if (percentage <= 30) return 'accent';
    return 'primary';
  }

  viewProductDetails(productId: string): void {
    this.router.navigate(['/admin/details-products', productId]);
  }

  goToSupplierOrder(): void {
    this.router.navigate(['/admin/supplier-orders']);
  }

  handleImageError(product: any): void {
    console.error('Erreur de chargement de l\'image pour le produit:', product.nomProduit, 'URL:', product.imageUrl);
    product.imageUrl = 'assets/default-product.png';
  }

  // Autres méthodes existantes...
  toggleScanner(): void {
    this.scannerActive = !this.scannerActive;
  }

  onScanSuccess(result: string): void {
    this.scannerActive = false;
    try {
      const productId = this.extractProductId(result);
      if (productId) {
        this.router.navigate(['/admin/details-products', productId]);
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
    console.error('Erreur de scan:', error);
    this.snackBar.open('Erreur de scan', 'Fermer', { duration: 3000 });
  }

  refreshData(): void {
    this.loading = true;
    this.getStatistics();
    this.loadSalesData();
    this.loadLowStockProducts();
    this.loadPendingUsers();
    this.loadCalendarEvents();
    this.loadRecentActivities();
    
    setTimeout(() => {
      this.snackBar.open('Données actualisées', 'Fermer', { duration: 2000 });
      this.loading = false;
    }, 1000);
  }

exportToPDF(): void {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString();
  const margin = 15;
  let yPosition = margin;

  // Style pour les titres de sections
  const sectionTitle = (text: string, y: number) => {
    doc.setFontSize(14);
    doc.setTextColor(41, 128, 185);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    return y + 10;
  };

  // Titre principal
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 128);
  doc.text('Rapport Complet du Tableau de Bord', 105, yPosition, { align: 'center' });
  yPosition += 10;
  doc.setFontSize(12);
  doc.text(`Généré le: ${date}`, 105, yPosition, { align: 'center' });
  yPosition += 20;

  // 1. Statistiques Principales
  yPosition = sectionTitle('1. Statistiques Globales', yPosition);
  autoTable(doc, {
    startY: yPosition,
    head: [['Statistique', 'Valeur']],
    body: [
      ['Utilisateurs Totaux', this.stats.totalUsers],
      ['Utilisateurs Actifs', this.stats.activeUsers],
      ['Utilisateurs en Attente', this.stats.pendingUsers],
      ['Produits Totaux', this.stats.totalProducts],
      ['Produits en Rupture', this.stats.lowStockProducts],
      ['Produits Vendus', this.stats.totalSoldProducts],
      ['Produits en Stock', this.stats.totalStockedProducts]
    ],
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] },
    margin: { top: 5 }
  });
  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // 2. Statistiques des Ventes par Produit
  if (this.salesData.length > 0) {
    if (yPosition > 250) { // Vérifier si on approche du bas de page
      yPosition = margin;
      doc.addPage();
    }
    
    yPosition = sectionTitle('2. Statistiques des Ventes par Produit', yPosition);
    
    // Tableau des 10 premiers produits
    autoTable(doc, {
      startY: yPosition,
      head: [['Produit', 'Quantité Vendue']],
      body: this.salesData
        .slice(0, 10)
        .sort((a, b) => b.sales - a.sales)
        .map(item => [item.productName, item.sales]),
      theme: 'grid',
      headStyles: { fillColor: [46, 204, 113] },
      margin: { top: 5 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // 3. Répartition des Stocks
  this.stockService.getStock().subscribe(stock => {
    const outOfStock = stock.filter(item => item.quantite <= 0).length;
    const lowStock = stock.filter(item => item.quantite > 0 && item.quantite <= 10).length;
    const inStock = stock.length - outOfStock - lowStock;

    if (yPosition > 220) {
      yPosition = margin;
      doc.addPage();
    }
    
    yPosition = sectionTitle('3. Répartition des Stocks', yPosition);
    autoTable(doc, {
      startY: yPosition,
      head: [['Statut', 'Nombre de Produits', 'Pourcentage']],
      body: [
        ['En Stock', inStock, `${Math.round((inStock/stock.length)*100)}%`],
        ['Stock Faible', lowStock, `${Math.round((lowStock/stock.length)*100)}%`],
        ['En Rupture', outOfStock, `${Math.round((outOfStock/stock.length)*100)}%`],
        ['Total', stock.length, '100%']
      ],
      theme: 'grid',
      headStyles: { fillColor: [155, 89, 182] },
      margin: { top: 5 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // 4. Top Produits Vendus (détaillé)
    if (this.topSellingPerfumes.length > 0) {
      if (yPosition > 220) {
        yPosition = margin;
        doc.addPage();
      }
      
      yPosition = sectionTitle('4. Top 5 des Produits Vendus', yPosition);
      autoTable(doc, {
        startY: yPosition,
        head: [['Position', 'Produit', 'Ventes']],
        body: this.topSellingPerfumes.map((item, index) => [
          index + 1,
          item.name,
          item.sales
        ]),
        theme: 'grid',
        headStyles: { fillColor: [241, 196, 15] },
        margin: { top: 5 }
      });
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // 5. Produits en Rupture de Stock
    if (this.lowStockProducts.length > 0) {
      if (yPosition > 200) {
        yPosition = margin;
        doc.addPage();
      }
      
      yPosition = sectionTitle('5. Produits en Rupture Imminente', yPosition);
      autoTable(doc, {
        startY: yPosition,
        head: [['Référence', 'Nom', 'Quantité', 'Seuil', 'Jours Restants']],
        body: this.lowStockProducts
          .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout)
          .map(p => [
            p.idProduit,
            p.nomProduit || p.name,
            p.quantite,
            p.seuil || 5,
            p.daysUntilStockout || 'N/A'
          ]),
        theme: 'grid',
        headStyles: { fillColor: [231, 76, 60] },
        margin: { top: 5 },
        columnStyles: {
          0: { cellWidth: 30 },
          2: { cellWidth: 20 },
          3: { cellWidth: 20 },
          4: { cellWidth: 25 }
        }
      });
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // 6. Activités Récentes (résumé)
    if (this.recentActivities.length > 0) {
      if (yPosition > 180) {
        yPosition = margin;
        doc.addPage();
      }
      
      yPosition = sectionTitle('6. Activités Récentes (Top 10)', yPosition);
      autoTable(doc, {
        startY: yPosition,
        head: [['Type', 'Message', 'Date/Heure']],
        body: this.recentActivities
          .slice(0, 10)
          .map(a => [
            a.type.toUpperCase(),
            a.message.length > 50 ? a.message.substring(0, 50) + '...' : a.message,
            this.formatActivityTime(a.time)
          ]),
        theme: 'grid',
        headStyles: { fillColor: [52, 152, 219] },
        margin: { top: 5 },
        columnStyles: {
          1: { cellWidth: 'auto' }
        }
      });
    }

    // Enregistrer le PDF
    doc.save(`rapport-tableau-de-bord_${date.replace(/\//g, '-')}.pdf`);
  });
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



  getStatistics(): void {
    this.db.list('users').snapshotChanges().subscribe((users: SnapshotAction<any>[]) => {
      this.stats.totalUsers = users.length;
      this.stats.activeUsers = users.filter(user => user.payload.val().status === 'approved').length;
      this.stats.pendingUsers = users.filter(user => user.payload.val().status === 'pending').length;
    });

    this.stockService.getStock().subscribe(stock => {
      this.stats.totalProducts = stock.length;
      this.stats.lowStockProducts = stock.filter(product => product.quantite <= 10).length;
      this.stats.totalStockedProducts = stock.reduce((total, product) => {
        return total + product.quantite;
      }, 0);
    });

    this.saleService.getAllSales().subscribe(sales => {
      this.stats.totalSoldProducts = sales.reduce((total, sale) => {
        return total + sale.items.reduce((sum, item) => sum + item.quantity, 0);
      }, 0);
    });
  }

  loadSalesData(): void {
    this.saleService.getAllSales().subscribe(sales => {
      const productSalesMap = new Map<string, number>();
      
      sales.forEach(sale => {
        sale.items.forEach(item => {
          const currentTotal = productSalesMap.get(item.name) || 0;
          productSalesMap.set(item.name, currentTotal + item.quantity);
        });
      });

      this.salesData = Array.from(productSalesMap.entries())
        .map(([name, sales]) => ({ productName: name, sales }))
        .sort((a, b) => b.sales - a.sales);

      this.topSellingPerfumes = this.salesData
        .slice(0, 5)
        .map(item => ({ name: item.productName, sales: item.sales }));

      this.renderCharts();
    });
  }

  loadPendingUsers(): void {
    this.db.list('users').snapshotChanges().subscribe((users: SnapshotAction<any>[]) => {
      this.pendingUsers = users
        .map(user => ({ id: user.key, ...user.payload.val() }))
        .filter(user => user.status === 'pending');
    });
  }

    renderCharts(): void {
    const colors = this.getChartColors();
    
    Chart.getChart('salesChart')?.destroy();
    Chart.getChart('stockChart')?.destroy();
    Chart.getChart('topPerfumesChart')?.destroy();

    // Graphique des ventes (grande taille)
    new Chart('salesChart', {
      type: 'bar',
      data: {
        labels: this.salesData.map(item => item.productName),
        datasets: [{
          label: 'Ventes',
          data: this.salesData.map(item => item.sales),
          backgroundColor: colors.pieColors,
          borderColor: colors.bgColor,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            display: false,
            labels: {
              color: colors.legendLabelsColor,
              font: {
                weight: 'bold'
              }
            }
          },
          title: { 
            display: true, 
            text: 'Ventes par Produit',
            color: colors.textColor,
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: colors.gridColor
            },
            ticks: {
              color: colors.textColor
            }
          },
          x: {
            grid: {
              color: colors.gridColor
            },
            ticks: {
              color: colors.textColor
            }
          }
        }
      }
    });

    this.stockService.getStock().subscribe(stock => {
      const outOfStock = stock.filter(item => item.quantite <= 0).length;
      const lowStock = stock.filter(item => item.quantite > 0 && item.quantite <= 10).length;
      const inStock = stock.length - outOfStock - lowStock;

      // Graphique de répartition des stocks (taille réduite)
      new Chart('stockChart', {
        type: 'pie',
        data: {
          labels: ['En Stock', 'Stock Faible', 'En Rupture'],
          datasets: [{
            label: 'Stocks',
            data: [inStock, lowStock, outOfStock],
            backgroundColor: [colors.pieColors[0], colors.pieColors[2], colors.pieColors[1]],
            borderColor: colors.bgColor,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              position: 'top',
              labels: {
                color: colors.legendLabelsColor
              }
            },
            title: { 
              display: true, 
              text: 'Répartition des Stocks',
              color: colors.textColor,
              font: {
                size: 14
              }
            }
          }
        }
      });
    });

    // Graphique des top parfums (taille réduite)
    new Chart('topPerfumesChart', {
      type: 'doughnut',
      data: {
        labels: this.topSellingPerfumes.map(p => p.name),
        datasets: [{
          data: this.topSellingPerfumes.map(p => p.sales),
          backgroundColor: colors.doughnutColors,
          borderColor: colors.bgColor,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: 'right',
            labels: {
              color: colors.legendLabelsColor
            }
          },
          title: { 
            display: true, 
            text: 'Top Parfums',
            color: colors.textColor,
            font: {
              size: 14
            }
          }
        }
      }
    });
  }

 initCalendar(): void {
  this.calendarOptions = {
    plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
    events: this.calendarEvents,
    eventClick: this.handleEventClick.bind(this),
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek,dayGridDay'
    },
    eventDisplay: 'block',
    eventColor: '#4CAF50',
    eventTextColor: '#ffffff',
    height: 'auto', // Supprime la hauteur fixe
    contentHeight: 'auto', // Supprime la hauteur de contenu fixe
    aspectRatio: 1.2, // Contrôle le ratio hauteur/largeur
    fixedWeekCount: false // Empêche d'afficher toujours 6 lignes
  };
}
  
  loadCalendarEvents(): void {
    this.db.list('events').valueChanges().subscribe((events: any[]) => {
      this.calendarEvents = events;
      this.calendarOptions.events = this.calendarEvents;
      this.snackBar.open('Bienvenu !!!', 'Fermer', { duration: 2000 });
    });
  }

  handleEventClick(info: any): void {
    this.snackBar.open(`Événement: ${info.event.title} - ${info.event.startStr}`, 'Fermer', { duration: 3000 });
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-theme', this.isDarkMode);
    
    if (this.salesData.length > 0) {
      this.renderCharts();
    }
  }

  onSearch(): void {
    console.log('Recherche:', this.searchQuery);
  }

  private getChartColors() {
    return this.isDarkMode ? {
      textColor: '#ffffff', 
      gridColor: 'rgba(236, 240, 241, 0.1)',
      bgColor: '#34495e',
      barColor: 'rgba(52, 152, 219, 0.9)',
      pieColors: [
        'rgba(52, 152, 219, 0.9)',
        'rgba(231, 76, 60, 0.9)',
        'rgba(46, 204, 113, 0.9)',
        'rgba(241, 196, 15, 0.9)',
        'rgba(155, 89, 182, 0.9)'
      ],
      doughnutColors: [
        'rgba(52, 152, 219, 0.9)',
        'rgba(231, 76, 60, 0.9)',
        'rgba(46, 204, 113, 0.9)',
        'rgba(241, 196, 15, 0.9)',
        'rgba(155, 89, 182, 0.9)'
      ],
      legendLabelsColor: '#ffffff'
    } : {
      textColor: '#2c3e50',
      gridColor: 'rgba(44, 62, 80, 0.1)',
      bgColor: '#ffffff',
      barColor: '#36A2EB',
      pieColors: ['#36A2EB', '#FF6384', '#4BC0C0', '#FFCE56', '#9966FF'],
      doughnutColors: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
      legendLabelsColor: '#2c3e50'
    };
  }
}