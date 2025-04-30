import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { SaleService } from '../../services/sale.service';
import { StockService } from '../../services/stock.service';
import { ExpenseService } from '../../services/expense.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { 
  startOfDay, endOfDay, startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth, startOfYear, endOfYear, 
  subMonths, parseISO, isWithinInterval, format 
} from 'date-fns';
import { combineLatest, Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EmailService } from 'src/app/services/email.service';
import { Router } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface CommandeInvoice {
  id: string;
  invoiceNumber?: string;
  supplierName: string;
  totalTTC: number;
  paymentStatus: 'En attente' | 'Payé' | 'En retard' | 'Annulé';
  dateCommande: string;
  dueDate?: string;
  items?: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }[];
  productId?: string;
  productName?: string;
  quantite?: number;
  prixUnitaire?: number;
  totalHT?: number;
  supplierAddress?: string;
  key?: string;
  unitPrice?: number; 
  quantity?: number; 
}
@Component({
  selector: 'app-financial-dashboard',
  templateUrl: './financial-dashboard.component.html',
  styleUrls: ['./financial-dashboard.component.css']
})
export class FinancialDashboardComponent  implements OnInit, AfterViewInit, OnDestroy {
  private subscriptions = new Subscription();
   private lineChart?: Chart<'line', number[], string>;
   private doughnutChart?: Chart<'doughnut', number[], string>;
 
   // Facturation commande 
   showCommandInvoices = false;
   commandInvoices: CommandeInvoice[] = [];
   filteredCommandInvoices: CommandeInvoice[] = []; 
   selectedInvoice: CommandeInvoice | null = null;
   showInvoiceModal = false;
   paidCount = 0;
   pendingCount = 0;
   overdueCount = 0;
   searchTerm: string = '';
 
   // Data
   sales: any[] = [];
   stock: any[] = [];
   filteredSales: any[] = [];
   previousPeriodSales: any[] = [];
   expenses: any[] = [];
   filteredExpenses: any[] = [];
 
   // Metrics
   totalCA = 0;
   totalCost = 0;
   benefice = 0;
   panierMoyen = 0;
   transactions = 0;
   margeBrute = 0;
   costPerTransaction = 0;
   caTrend = 0;
   totalExpenses = 0;
 
   // UI States
   errorMessage: string | null = null;
   showExpensesSection = false;
   showExpenseModal = false;
   expensesLoading = false;
   addingExpense = false;
 
   // New Expense
   newExpense: any = {
     date: format(new Date(), 'yyyy-MM-dd'),
     amount: 0,
     category: '',
     description: '',
     paymentMethod: 'Carte'
   };
 
 
   // Categories
   expenseCategories = [
     'Fournitures',
     'Loyer',
     'Salaires',
     'Services',
     'Marketing',
     'Transport',
     'Équipement',
     'Autres'
   ];
 
   // Filters
   period = 'month';
   customStart: string = '';
   customEnd: string = '';
 
   constructor(
     private saleService: SaleService,
     private stockService: StockService,
     private expenseService: ExpenseService,
     private emailService: EmailService,
     private router: Router,
     private http: HttpClient
   ) {
     Chart.register(...registerables);
   }
 
   ngOnInit(): void {
     this.loadInitialData();
   }
 
   ngAfterViewInit(): void {
     this.initCharts();
   }
 
   ngOnDestroy(): void {
     this.subscriptions.unsubscribe();
     this.destroyCharts();
   }
 
   
 
   viewInvoice(cmd: CommandeInvoice): void {
     this.selectedInvoice = cmd;
     this.showInvoiceModal = true;
   }
 
   closeInvoiceModal(): void {
     this.showInvoiceModal = false;
     this.selectedInvoice = null;
   }
 
   getProductId(commande: CommandeInvoice): string {
     return commande.productId || commande.items?.[0]?.productId || 'N/A';
   }
 
   getProductName(commande: CommandeInvoice): string {
     return commande.productName || commande.items?.[0]?.productName || 'N/A';
   }
 
   getQuantity(commande: CommandeInvoice): number {
     if (commande.quantite !== undefined && commande.quantite !== null) {
         return Number(commande.quantite);
     }
     
     if (commande.items && commande.items.length > 0) {
         return Number(commande.items[0].quantity) || 0;
     }
     
     if (commande.quantity !== undefined && commande.quantity !== null) {
         return Number(commande.quantity);
     }
     
     return 0;
   }
 
 
   getUnitPrice(commande: CommandeInvoice): number {
     if (commande.prixUnitaire !== undefined && commande.prixUnitaire !== null) {
         return Number(commande.prixUnitaire);
     }
     
     if (commande.items && commande.items.length > 0) {
         return Number(commande.items[0].unitPrice) || 0;
     }
     
     if (commande.unitPrice !== undefined && commande.unitPrice !== null) {
         return Number(commande.unitPrice);
     }
     
     return 0;
   }
 
   getTotalHT(commande: CommandeInvoice): number {
     if (commande.totalHT !== undefined && !isNaN(commande.totalHT)) {
       return commande.totalHT;
     }
     
     return this.getQuantity(commande) * this.getUnitPrice(commande);
   }
 
   getTotalTTC(commande: CommandeInvoice): number {
     return this.getTotalHT(commande) * 1.19;
   }
 
   private calculatePaymentStatus(commande: CommandeInvoice): 'En attente' | 'Payé' | 'En retard' {
     if (commande.paymentStatus === 'Payé') return 'Payé';
     if (!commande.dueDate) return 'En attente';
     
     const today = new Date();
     const dueDate = new Date(commande.dueDate);
     return today > dueDate ? 'En retard' : 'En attente';
   }
 
   private calculateDueDate(orderDate: string): string {
     const date = new Date(orderDate);
     date.setDate(date.getDate() + 30);
     return date.toISOString();
   }
 
   private updateCounts(): void {
     this.paidCount = this.commandInvoices.filter(c => c.paymentStatus === 'Payé').length;
     this.pendingCount = this.commandInvoices.filter(c => c.paymentStatus === 'En attente').length;
     this.overdueCount = this.commandInvoices.filter(c => c.paymentStatus === 'En retard').length;
   }
 
   calculateDaysLate(dueDate: string | undefined): number {
     if (!dueDate) return 0;
     
     const due = new Date(dueDate);
     const today = new Date();
     return Math.max(Math.floor((today.getTime() - due.getTime()) / (1000 * 3600 * 24)), 0);
   }
 
   async markAsPaid(commande: CommandeInvoice): Promise<void> {
     if (confirm(`Marquer la commande ${commande.id} comme payée ?`)) {
       try {
         await this.emailService.updateCommande(commande.key || '', {
           paymentStatus: 'Payé',
           paymentDate: new Date().toISOString()
         });
         this.loadCommandInvoices();
       } catch (error) {
         console.error('Erreur mise à jour paiement:', error);
       }
     }
   }
   
   generateInvoice(commande: CommandeInvoice): void {
     const doc = new jsPDF();
   
     this.getImageBase64('assets/images/qstockerlogo.PNG').subscribe({
       next: (base64Image) => {
         doc.addImage(base64Image, 'PNG', 15, 10, 40, 20);
   
         doc.setFontSize(18);
         doc.text('FACTURE FOURNISSEUR', 60, 20);
         doc.setFontSize(12);
         doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 170, 30, { align: 'right' });
         doc.text(`N° de commande: ${commande.id || 'N/A'}`, 170, 35, { align: 'right' });
         doc.text(`N° Facture: ${commande.invoiceNumber || 'N/A'}`, 170, 40, { align: 'right' });
   
         doc.setFontSize(10);
         doc.text(
           `Fournisseur: ${commande.supplierName || 'N/A'}\nAdresse: ${commande.supplierAddress || 'N/A'}`,
           15, 45
         );
   
         const items = commande.items || [{
           productId: this.getProductId(commande) || 'N/A',
           productName: this.getProductName(commande) || 'N/A',
           quantity: this.getQuantity(commande) || 0,
           unitPrice: this.getUnitPrice(commande) || 0
         }];
   
         autoTable(doc, {
           startY: 60,
           head: [['ID Produit', 'Nom Produit', 'Quantité', 'Prix Unitaire HT (DT)', 'Total HT (DT)']],
           body: items.map(item => [
             item.productId || 'N/A',
             item.productName || 'N/A',
             (item.quantity || 0).toString(),
             `${(item.unitPrice || 0).toFixed(3).replace('.', ',')} DT`,
             `${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(3).replace('.', ',')} DT`
           ]),
           theme: 'grid',
           headStyles: {
             fillColor: [245, 246, 250],
             textColor: 0,
             fontStyle: 'bold'
           },
           columnStyles: {
             3: { halign: 'right' },
             4: { halign: 'right' }
           },
           didParseCell: (data: any) => {
             if (data.section === 'body' && data.column.index >= 3) {
               if (typeof data.cell.text === 'string') {
                 data.cell.text = data.cell.text.replace('.', ',');
               }
             }
           }
         });
   
         const totalHT = items.reduce((acc, item) => acc + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
         const tva = totalHT * 0.19;
         const totalTTC = totalHT + tva;
   
         const finalY = (doc as any).lastAutoTable.finalY + 10;
         autoTable(doc, {
           startY: finalY,
           body: [
             ['Total HT', `${totalHT.toFixed(3).replace('.', ',')} DT`],
             ['TVA (19%)', `${tva.toFixed(3).replace('.', ',')} DT`],
             ['Total TTC', `${totalTTC.toFixed(3).replace('.', ',')} DT`]
           ],
           theme: 'plain',
           columnStyles: {
             0: { fontStyle: 'bold', halign: 'right' },
             1: { halign: 'right' }
           }
         });
   
         const footerY = doc.internal.pageSize.height - 20;
         doc.setFontSize(10);
         doc.setTextColor('#555');
         doc.text(
           'QStocker - Adresse : Mahdia, zone touristique | Tél : +216 70 123 456 | Email : contact.qstocker@gmail.com',
           15, footerY
         );
   
         doc.save(`facture-${commande.invoiceNumber || commande.id}.pdf`);
       },
       error: (err) => {
         console.error('Erreur lors du chargement de l\'image:', err);
       }
     });
   }
 
   getImageBase64(imagePath: string): Observable<string> {
     return this.http.get(imagePath, { responseType: 'blob' }).pipe(
       switchMap((blob: Blob) => {
         return new Observable<string>((observer) => {
           const reader = new FileReader();
           reader.onloadend = () => {
             observer.next(reader.result as string);
             observer.complete();
           };
           reader.onerror = (error) => {
             observer.error(error);
           };
           reader.readAsDataURL(blob);
         });
       })
     );
   }
 
 
   applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredCommandInvoices = [...this.commandInvoices];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredCommandInvoices = this.commandInvoices.filter(commande => 
      commande.id.toLowerCase().includes(term) ||
      (commande.invoiceNumber?.toLowerCase() || '').includes(term) ||
      this.getProductName(commande).toLowerCase().includes(term) ||
      commande.supplierName.toLowerCase().includes(term) 
    );
  }
 
   // Reste des méthodes existantes...
   toggleExpensesSection(): void {
     this.showExpensesSection = !this.showExpensesSection;
     if (this.showExpensesSection && this.expenses.length === 0) {
       this.loadExpenses();
     }
   }
 
   toggleCommandInvoicesSection(): void {
     this.showCommandInvoices = !this.showCommandInvoices;
     if (this.showCommandInvoices && this.commandInvoices.length === 0) {
       this.loadCommandInvoices();
     }
   }
 
   private loadCommandInvoices(): void {
     this.emailService.getCommandes().subscribe({
       next: (commandes: any[]) => {
         this.commandInvoices = commandes.map(c => {
           const commandeInvoice: CommandeInvoice = {
             ...c,
             totalTTC: this.getTotalTTC(c as CommandeInvoice),
             paymentStatus: this.calculatePaymentStatus(c as CommandeInvoice),
             dueDate: c.dueDate || this.calculateDueDate(c.dateCommande)
           };
           return commandeInvoice;
         });
         this.filterCommandInvoices();
         this.updateCounts();
       },
       error: (error) => console.error('Erreur chargement commandes:', error)
     });
   }
 
   private filterCommandInvoices(): void {
     const { start, end } = this.getDateRange();
     this.filteredCommandInvoices = this.commandInvoices.filter(cmd => {
       const cmdDate = new Date(cmd.dateCommande);
       return isWithinInterval(cmdDate, { start, end });
     });
   }
 
 
 
 
   openExpenseModal(): void {
     this.showExpenseModal = true;
   }
 
   closeExpenseModal(): void {
     this.showExpenseModal = false;
     this.newExpense = {
       date: format(new Date(), 'yyyy-MM-dd'),
       amount: 0,
       category: '',
       description: '',
       paymentMethod: 'Carte'
     };
   }
 
   submitExpense(): void {
     this.addingExpense = true;
     this.expenseService.addExpense(this.newExpense).then(() => {
       this.loadExpenses();
       this.closeExpenseModal();
     }).catch(error => {
       this.errorMessage = 'Erreur lors de l\'ajout de la dépense';
       console.error(error);
     }).finally(() => {
       this.addingExpense = false;
     });
   }
 
   deleteExpense(id: string): void {
     if (confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
       this.expenseService.deleteExpense(id).then(() => {
         this.loadExpenses();
       }).catch(error => {
         this.errorMessage = 'Erreur lors de la suppression';
         console.error(error);
       });
     }
   }
 
   getCategoryColor(category: string): string {
     const colors: Record<string, string> = {
       'Fournitures': 'info',
       'Loyer': 'warning',
       'Salaires': 'danger',
       'Services': 'primary',
       'Marketing': 'success',
       'Transport': 'secondary',
       'Équipement': 'dark',
       'Autres': 'light'
     };
     return colors[category] || 'secondary';
   }
 
   retryLoading(): void {
     this.loadInitialData();
     if (this.showExpensesSection) {
       this.loadExpenses();
     }
   }
 
   private loadInitialData(): void {
     this.errorMessage = null;
 
     const sales$ = this.saleService.getSalesHistory('all').pipe(
       catchError(err => {
         console.error('Erreur sales:', err);
         return of([]);
       })
     );
 
     const stock$ = this.stockService.getStock().pipe(
       catchError(err => {
         console.error('Erreur stock:', err);
         return of([]);
       })
     );
 
     this.subscriptions.add(
       combineLatest([sales$, stock$]).subscribe({
         next: ([sales, stock]) => {
           this.processData(sales, stock);
         },
         error: (err) => {
           console.error('Erreur:', err);
           this.errorMessage = 'Impossible de charger les données';
         }
       })
     );
   }
 
   private loadExpenses(): void {
     this.expensesLoading = true;
     this.expenseService.getExpenses().subscribe({
       next: (expenses) => {
         this.expenses = expenses;
         this.filterExpenses();
         this.calculateTotalExpenses();
         this.updateDoughnutChart();
         this.expensesLoading = false;
       },
       error: (error) => {
         this.errorMessage = 'Erreur lors du chargement des dépenses';
         console.error(error);
         this.expensesLoading = false;
       }
     });
   }
   private calculateTotalExpenses(): void {
     const commandExpenses = this.commandInvoices
       .filter(cmd => cmd.paymentStatus !== 'Annulé')
       .reduce((sum, cmd) => sum + cmd.totalTTC, 0);
     
     const otherExpenses = this.filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
     
     this.totalExpenses = otherExpenses + commandExpenses;
   }
 
   private processData(sales: any[], stock: any[]): void {
     this.sales = Array.isArray(sales) ? sales : [];
     this.stock = Array.isArray(stock) ? stock : [];
     
     if (this.sales.length > 0 || this.stock.length > 0) {
       this.loadPreviousPeriodData();
       this.applyPeriodFilter();
       this.initCharts();
     } else {
       this.errorMessage = 'Aucune donnée disponible';
     }
   }
 
   private filterExpenses(): void {
     const { start, end } = this.getDateRange();
     this.filteredExpenses = this.expenses.filter(exp => {
       const expDate = new Date(exp.date);
       return isWithinInterval(expDate, { start, end });
     });
     this.calculateTotalExpenses();
   }
 
   private initCharts(): void {
     this.destroyCharts();
     this.updateLineChart();
     this.updateDoughnutChart();
   }
 
   private loadPreviousPeriodData(): void {
     try {
       const previousMonth = subMonths(new Date(), 1);
       const { start, end } = this.getDateRange(previousMonth);
       
       this.previousPeriodSales = this.sales.filter(s => {
         try {
           const saleDate = new Date(s.date);
           return isWithinInterval(saleDate, { start, end });
         } catch (e) {
           console.error('Erreur date:', e);
           return false;
         }
       });
     } catch (e) {
       console.error('Erreur période précédente:', e);
       this.previousPeriodSales = [];
     }
   }
 
   applyPeriodFilter(): void {
     try {
       const { start, end } = this.getDateRange();
       
       this.filteredSales = this.sales.filter(sale => {
         try {
           const saleDate = new Date(sale.date);
           return isWithinInterval(saleDate, { start, end });
         } catch (e) {
           console.error('Erreur filtre date:', e);
           return false;
         }
       });
 
       if (this.expenses.length > 0) {
         this.filterExpenses();
       }
 
       if (this.commandInvoices.length > 0) {
         this.filterCommandInvoices();
       }
 
       if (this.filteredSales.length === 0 && this.filteredExpenses.length === 0) {
         this.errorMessage = 'Aucune donnée pour cette période';
       } else {
         this.errorMessage = null;
       }
 
       this.calculateMetrics();
       this.updateCharts();
     } catch (e) {
       console.error('Erreur application filtre:', e);
       this.errorMessage = 'Erreur de filtrage';
     }
   }
 
   private getDateRange(referenceDate = new Date()): { start: Date; end: Date } {
     try {
       let start: Date;
       let end: Date;
 
       switch (this.period) {
         case 'today':
           start = startOfDay(referenceDate);
           end = endOfDay(referenceDate);
           break;
         case 'week':
           start = startOfWeek(referenceDate);
           end = endOfWeek(referenceDate);
           break;
         case 'month':
           start = startOfMonth(referenceDate);
           end = endOfMonth(referenceDate);
           break;
         case 'year':
           start = startOfYear(referenceDate);
           end = endOfYear(referenceDate);
           break;
         case 'custom':
           start = this.customStart ? parseISO(this.customStart) : new Date(0);
           end = this.customEnd ? endOfDay(parseISO(this.customEnd)) : new Date();
           break;
         default: // 'all'
           start = new Date(0);
           end = new Date();
       }
 
       return { start, end };
     } catch (e) {
       console.error('Erreur calcul période:', e);
       return { start: new Date(0), end: new Date() };
     }
   }
 
   private calculateMetrics(): void {
     try {
       this.transactions = this.filteredSales.length;
       this.totalCA = this.filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
       this.totalCost = this.calculateTotalCost();
       this.benefice = this.totalCA - this.totalCost;
       this.margeBrute = this.totalCA > 0 ? (this.benefice / this.totalCA) * 100 : 0;
       this.panierMoyen = this.transactions > 0 ? this.totalCA / this.transactions : 0;
       this.costPerTransaction = this.transactions > 0 ? this.totalCost / this.transactions : 0;
 
       const previousCA = this.previousPeriodSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
       this.caTrend = previousCA > 0 ? ((this.totalCA - previousCA) / previousCA) * 100 : 0;
     } catch (e) {
       console.error('Erreur calcul métriques:', e);
       this.errorMessage = 'Erreur de calcul';
     }
   }
 
   private calculateTotalCost(): number {
     try {
       const costMap = new Map(
         this.stock.map(item => [item.idProduit, item.prixUnitaireHT])
       );
 
       return this.filteredSales.reduce((total, sale) => {
         return total + (sale.items?.reduce((sum: number, item: any) => {
           return sum + ((costMap.get(item.productId) || 0)) * (item.quantity || 0);
         }, 0) || 0);
       }, 0);
     } catch (e) {
       console.error('Erreur calcul coût:', e);
       return 0;
     }
   }
 
   private updateCharts(): void {
     this.updateLineChart();
     this.updateDoughnutChart();
   }
 
   private updateLineChart(): void {
     const ctx = document.getElementById('lineChart') as HTMLCanvasElement;
     if (!ctx) return;
 
     const dailyData = this.groupSalesByDay();
     
     if (this.lineChart) {
       this.lineChart.data.labels = dailyData.labels;
       this.lineChart.data.datasets[0].data = dailyData.values;
       this.lineChart.update();
     } else {
       const config: ChartConfiguration<'line', number[], string> = {
         type: 'line',
         data: {
           labels: dailyData.labels,
           datasets: [{
             label: 'Chiffre d\'affaires',
             data: dailyData.values,
             borderColor: '#4CAF50',
             backgroundColor: 'rgba(76, 175, 80, 0.2)',
             fill: true,
             tension: 0.4
           }]
         },
         options: {
           responsive: true,
           maintainAspectRatio: false,
           plugins: {
             legend: { position: 'top' },
             tooltip: {
               callbacks: {
                 label: (context) => {
                   const label = context.dataset.label || '';
                   const value = Number(context.raw) || 0;
                   return `${label}: ${value.toFixed(2)} DT`;
                 }
               }
             }
           }
         }
       };
       
       this.lineChart = new Chart(ctx, config);
     }
   }
 
   private updateDoughnutChart(): void {
     const ctx = document.getElementById('doughnutChart') as HTMLCanvasElement;
     if (!ctx) return;
 
     const categories = this.showExpensesSection && this.filteredExpenses.length > 0 
       ? this.groupExpensesByCategory()
       : this.groupSalesByCategory();
     
     if (this.doughnutChart) {
       this.doughnutChart.data.labels = categories.labels;
       (this.doughnutChart.data.datasets[0].data as number[]) = categories.values;
       this.doughnutChart.update();
     } else {
       const config: ChartConfiguration<'doughnut', number[], string> = {
         type: 'doughnut',
         data: {
           labels: categories.labels,
           datasets: [{
             label: this.showExpensesSection ? 'Dépenses' : 'Répartition',
             data: categories.values,
             backgroundColor: [
               '#FF6384', '#36A2EB', '#FFCE56', 
               '#4BC0C0', '#9966FF', '#FF9F40',
               '#8AC24A', '#607D8B'
             ]
           }]
         },
         options: {
           responsive: true,
           maintainAspectRatio: false,
           plugins: {
             legend: { position: 'top' },
             tooltip: {
               callbacks: {
                 label: (context) => {
                   const label = context.label || '';
                   const value = context.parsed || 0;
                   const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                   const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                   return `${label}: ${value.toFixed(2)} DT (${percentage}%)`;
                 }
               }
             }
           }
         }
       };
       
       this.doughnutChart = new Chart(ctx, config);
     }
   }
 
   private groupSalesByDay(): { labels: string[]; values: number[] } {
     const groupedData: Record<string, number> = {};
 
     this.filteredSales.forEach(sale => {
       try {
         const date = new Date(sale.date);
         const key = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
         groupedData[key] = (groupedData[key] || 0) + (sale.totalAmount || 0);
       } catch (e) {
         console.error('Erreur groupage par jour:', e);
       }
     });
 
     return {
       labels: Object.keys(groupedData),
       values: Object.values(groupedData)
     };
   }
 
   private groupSalesByCategory(): { labels: string[]; values: number[] } {
     const categories: Record<string, number> = {};
 
     this.filteredSales.forEach(sale => {
       (sale.items || []).forEach((item: any) => {
         try {
           const category = this.determineCategory(item.productId);
           categories[category] = (categories[category] || 0) + (item.totalPrice || 0);
         } catch (e) {
           console.error('Erreur groupage catégorie:', e);
         }
       });
     });
 
     if (Object.keys(categories).length === 0) {
       return {
         labels: ['Aucune donnée'],
         values: [1]
       };
     }
 
     return {
       labels: Object.keys(categories),
       values: Object.values(categories)
     };
   }
 
   private groupExpensesByCategory(): { labels: string[]; values: number[] } {
     const categories: Record<string, number> = {};
 
     this.filteredExpenses.forEach(expense => {
       categories[expense.category] = (categories[expense.category] || 0) + expense.amount;
     });
 
     if (Object.keys(categories).length === 0) {
       return {
         labels: ['Aucune dépense'],
         values: [1]
       };
     }
 
     return {
       labels: Object.keys(categories),
       values: Object.values(categories)
     };
   }
 
   private determineCategory(productId: string): string {
     if (!productId) return 'Non catégorisé';
     
     const firstChar = productId.charAt(0).toUpperCase();
     switch(firstChar) {
       case 'A': return 'Alimentaire';
       case 'B': return 'Boissons';
       case 'C': return 'Cosmétiques';
       default: return 'Divers';
     }
   }
 
   private destroyCharts(): void {
     if (this.lineChart) {
       this.lineChart.destroy();
       this.lineChart = undefined;
     }
     if (this.doughnutChart) {
       this.doughnutChart.destroy();
       this.doughnutChart = undefined;
     }
   }
 
   
   printInvoice(): void {
     if (!this.selectedInvoice) return;
     
     // Créer une fenêtre d'impression avec le contenu de la facture
     const printWindow = window.open('', '_blank');
     if (!printWindow) return;
   
     // HTML pour l'impression
     printWindow.document.write(`
       <html>
         <head>
           <title>Facture ${this.selectedInvoice.invoiceNumber || this.selectedInvoice.id}</title>
           <style>
             body { font-family: Arial, sans-serif; margin: 20px; }
             .invoice-header { text-align: center; margin-bottom: 20px; }
             .invoice-details { margin-bottom: 30px; }
             .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
             .invoice-table th, .invoice-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
             .invoice-table th { background-color: #f2f2f2; }
             .text-right { text-align: right; }
             .total-row { font-weight: bold; }
             @media print {
               body { margin: 0; padding: 0; }
               .no-print { display: none; }
             }
           </style>
         </head>
         <body>
           <div class="invoice-header">
             <h2>Facture Fournisseur</h2>
             <p>${this.selectedInvoice.supplierName}</p>
           </div>
           
           <div class="invoice-details">
             <p><strong>N° Facture:</strong> ${this.selectedInvoice.invoiceNumber || 'Non généré'}</p>
             <p><strong>ID Commande:</strong> ${this.selectedInvoice.id}</p>
             <p><strong>Date:</strong> ${format(new Date(this.selectedInvoice.dateCommande), 'dd/MM/yyyy')}</p>
             <p><strong>Statut:</strong> ${this.selectedInvoice.paymentStatus}</p>
           </div>
           
           <div class="invoice-total">
             <h3>Total TTC: ${this.selectedInvoice.totalTTC.toFixed(3)} DT</h3>
           </div>
           
           <div class="no-print" style="margin-top: 20px;">
             <button onclick="window.print();" style="padding: 10px 15px; background: #4CAF50; color: white; border: none; cursor: pointer;">
               Imprimer
             </button>
             <button onclick="window.close();" style="padding: 10px 15px; background: #f44336; color: white; border: none; cursor: pointer;">
               Fermer
             </button>
           </div>
           
           <script>
             // Imprimer automatiquement quand la fenêtre est chargée
             window.onload = function() {
               setTimeout(function() {
                 window.print();
               }, 500);
             };
           </script>
         </body>
       </html>
     `);
       
     printWindow.document.close();
   }
 }