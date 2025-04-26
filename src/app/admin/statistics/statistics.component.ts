import { Component, OnInit } from '@angular/core';
import { StockService } from '../../services/stock.service';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { SnapshotAction } from '@angular/fire/compat/database';
import { Chart, registerables } from 'chart.js';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SaleService } from '../../services/sale.service';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css']
})
export class StatisticsComponent implements OnInit {
  stats: any = {
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    totalSoldProducts: 0,  // Nombre total de produits vendus
    totalStockedProducts: 0 // Quantité totale de produits en stock
  };

  topSellingPerfumes: { name: string, sales: number }[] = [];
  salesData: { productName: string, sales: number }[] = [];
  alerts = [
    { message: 'Rupture de stock pour le Parfum X', time: '10:45 AM' },
    { message: 'Contrefaçon détectée pour le Parfum Y', time: '11:30 AM' },
  ];

  isDarkMode = false;
  searchQuery = '';
  lowStockProducts: any[] = [];
  pendingUsers: any[] = [];
  calendarOptions!: CalendarOptions;
  calendarEvents: EventInput[] = [];

  constructor(
    private db: AngularFireDatabase,
    private stockService: StockService,
    private saleService: SaleService,
    private snackBar: MatSnackBar
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
  }

  getStatistics(): void {
    this.db.list('users').snapshotChanges().subscribe((users: SnapshotAction<any>[]) => {
      this.stats.totalUsers = users.length;
      this.stats.activeUsers = users.filter(user => user.payload.val().status === 'approved').length;
      this.stats.pendingUsers = users.filter(user => user.payload.val().status === 'pending').length;
    });

    this.stockService.getStock().subscribe(stock => {
      this.stats.totalProducts = stock.length;
      this.stats.lowStockProducts = stock.filter(product => product.quantite < 10).length;
      
      // Calcul de la quantité totale de produits en stock
      this.stats.totalStockedProducts = stock.reduce((total, product) => {
        return total + product.quantite;
      }, 0);
    });

    // Calcul du nombre total de produits vendus
    this.saleService.getAllSales().subscribe(sales => {
      this.stats.totalSoldProducts = sales.reduce((total, sale) => {
        return total + sale.items.reduce((sum, item) => sum + item.quantity, 0);
      }, 0);
    });
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

  loadLowStockProducts(): void {
    this.stockService.getStock().subscribe(stock => {
      this.lowStockProducts = stock
        .filter(product => product.quantite < 10)
        .map(product => ({
          id: product.idProduit,
          name: product.nomProduit,
          quantity: product.quantite
        }));
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
    
    // Destroy existing charts if they exist
    Chart.getChart('salesChart')?.destroy();
    Chart.getChart('stockChart')?.destroy();
    Chart.getChart('topPerfumesChart')?.destroy();

    // Graphique des ventes par produit
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

    // Graphique des stocks
    this.stockService.getStock().subscribe(stock => {
      const inStock = stock.filter(item => item.quantite >= 10).length;
      const outOfStock = stock.filter(item => item.quantite < 10).length;

      new Chart('stockChart', {
        type: 'pie',
        data: {
          labels: ['En Stock', 'En Rupture'],
          datasets: [{
            label: 'Stocks',
            data: [inStock, outOfStock],
            backgroundColor: [colors.pieColors[0], colors.pieColors[1]],
            borderColor: colors.bgColor,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { 
              position: 'top',
              labels: {
                color: colors.legendLabelsColor,
                font: {
                  weight: 'bold'
                }
              }
            },
            title: { 
              display: true, 
              text: 'Répartition des Stocks',
              color: colors.textColor,
              font: {
                size: 16,
                weight: 'bold'
              }
            }
          }
        }
      });
    });

    // Graphique des top parfums
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
        plugins: {
          legend: { 
            position: 'right',
            labels: {
              color: colors.legendLabelsColor,
              font: {
                weight: 'bold'
              }
            }
          },
          title: { 
            display: true, 
            text: 'Top Parfums',
            color: colors.textColor,
            font: {
              size: 16,
              weight: 'bold'
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
      eventTextColor: '#ffffff'
    };
  }

  loadCalendarEvents(): void {
    this.db.list('events').valueChanges().subscribe((events: any[]) => {
      this.calendarEvents = events;
      this.calendarOptions.events = this.calendarEvents;
      this.snackBar.open('Calendrier mis à jour', 'Fermer', { duration: 2000 });
    });
  }

  handleEventClick(info: any): void {
    this.snackBar.open(`Événement: ${info.event.title} - ${info.event.startStr}`, 'Fermer', { duration: 3000 });
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-theme', this.isDarkMode);
    
    // Re-render les graphiques avec le bon thème
    if (this.salesData.length > 0) {
      this.renderCharts();
    }
  }

  onSearch(): void {
    console.log('Recherche:', this.searchQuery);
  }
}