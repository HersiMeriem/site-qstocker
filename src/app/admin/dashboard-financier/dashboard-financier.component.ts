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
import { OrderService } from '../../services/order.service';
import { tap } from 'rxjs/operators';

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
  selector: 'app-dashboard-financier',
  templateUrl: './dashboard-financier.component.html',
  styleUrls: ['./dashboard-financier.component.css']
})
export class DashboardFinancierComponent implements OnInit, AfterViewInit, OnDestroy {

  private subscriptions = new Subscription();
   private lineChart?: Chart<'line', number[], string>;
   private combinedCAChart?: Chart<'line', number[], string>;
   private profitChart?: Chart;
 
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
   totalRevenue = 0;
 
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
 
   //livaison
   deliveredOrdersCount = 0;
   deliveredOrdersRevenue = 0;
   deliveredOrders: any[] = [];
 
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
     private http: HttpClient,
     private orderService: OrderService
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
 
   private loadExpenses(): void {
     this.expensesLoading = true;
     this.expenseService.getExpenses().subscribe({
       next: (expenses) => {
         this.expenses = expenses;
         this.filterExpenses();
         this.calculateTotalExpenses();
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
     // Basic metrics
     this.transactions = this.filteredSales.length;
     this.totalCA = this.filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
     this.totalCost = this.calculateTotalCost();
 
     // Calculate delivered orders metrics
     this.calculateDeliveredOrdersMetrics(this.deliveredOrders);
 
     // Total revenue (CA + delivered orders)
     this.totalRevenue = this.totalCA + this.deliveredOrdersRevenue;
 
     // Calculate profits
     this.calculateGrossProfit();
 
     // Calculate net profit (after all expenses)
     const netProfit = this.benefice - this.totalExpenses;
 
     // Other metrics
     this.panierMoyen = this.transactions > 0 ? this.totalCA / this.transactions : 0;
     this.costPerTransaction = this.transactions > 0 ? this.totalCost / this.transactions : 0;
 
     // Trend calculation
     const previousCA = this.previousPeriodSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
     this.caTrend = previousCA > 0 ? ((this.totalCA - previousCA) / previousCA) * 100 : 0;
   } catch (e) {
     console.error('Error calculating metrics:', e);
     this.errorMessage = 'Calculation error';
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
 
   printInvoice(): void {
     if (!this.selectedInvoice) return;
 
     const printWindow = window.open('', '_blank');
     if (!printWindow) return;
 
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
 
   private loadInitialData(): void {
     this.errorMessage = null;
 
     const sales$ = this.saleService.getSalesHistory('all');
     const stock$ = this.stockService.getStock();
     const deliveredOrders$ = this.orderService.getOrdersByStatus('delivered').pipe(
       tap(orders => {
         this.deliveredOrders = orders;
         this.calculateDeliveredOrdersMetrics(orders);
       })
     );
 
     this.subscriptions.add(
       combineLatest([sales$, stock$, deliveredOrders$]).subscribe({
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
 
 private calculateGrossProfit(): void {
   // Calculate transaction profit
   const transactionProfit = this.totalCA - this.totalCost;
 
   // Calculate delivery profit
   const deliveryProfit = this.calculateDeliveryProfit();
 
   // Total gross profit
   this.benefice = transactionProfit + deliveryProfit;
 
   // Update margin calculation
   this.margeBrute = this.totalRevenue > 0 ? (this.benefice / this.totalRevenue) * 100 : 0;
 }
 
 
 private calculateDeliveredOrdersMetrics(orders: any[]): void {
   const { start, end } = this.getDateRange();
 
   // Reset metrics before calculation
   this.deliveredOrdersCount = 0;
   this.deliveredOrdersRevenue = 0;
 
   const filteredOrders = orders.filter(order => {
     try {
       if (!order || !order.orderDate) return false;
 
       const orderDate = new Date(order.orderDate);
       return isWithinInterval(orderDate, { start, end });
     } catch (e) {
       console.error('Error filtering date:', e);
       return false;
     }
   });
 
   this.deliveredOrdersCount = filteredOrders.length;
   this.deliveredOrdersRevenue = filteredOrders.reduce((sum, order) => {
     return sum + (order.grandTotal || order.totalAmount || 0);
   }, 0);
 }
 
 
 applyPeriodFilter(): void {
   try {
     const { start, end } = this.getDateRange();
 
     // Filter sales
     this.filteredSales = this.sales.filter(sale => {
       try {
         const saleDate = new Date(sale.date);
         return isWithinInterval(saleDate, { start, end });
       } catch (e) {
         console.error('Error filtering date:', e);
         return false;
       }
     });
 
     // Filter expenses
     this.filterExpenses();
 
     // Filter command invoices
     this.filterCommandInvoices();
 
     // Filter and calculate delivered orders
     this.calculateDeliveredOrdersMetrics(this.deliveredOrders);
 
     // Calculate all metrics
     this.calculateMetrics();
 
     // Update charts
     this.updateCharts();
 
   } catch (e) {
     console.error('Error applying filter:', e);
     this.errorMessage = 'Filtering error';
   }
 }
 
 
 
   private initCharts(): void {
     this.destroyCharts();
     this.updateLineChart();
     this.initCombinedCAChart();
     this.initProfitChart();
   }
 
 private updateCharts(): void {
   this.updateLineChart();
   this.initCombinedCAChart();
   this.initProfitChart();
 }
 
 
 private initCombinedCAChart(): void {
   const ctx = document.getElementById('combinedCAChart') as HTMLCanvasElement;
   if (!ctx) return;
 
   if (this.combinedCAChart) this.combinedCAChart.destroy();
 
   const dailySalesData = this.groupSalesByDay();
   const dailyOrdersData = this.groupDeliveredOrdersByDay();
 
   const allDates = Array.from(new Set([
     ...dailySalesData.labels,
     ...dailyOrdersData.labels
   ])).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
 
   const salesValues = allDates.map(date =>
     dailySalesData.labels.includes(date)
       ? dailySalesData.values[dailySalesData.labels.indexOf(date)]
       : 0
   );
 
   const ordersValues = allDates.map(date =>
     dailyOrdersData.labels.includes(date)
       ? dailyOrdersData.values[dailyOrdersData.labels.indexOf(date)]
       : 0
   );
 
   const totalValues = allDates.map((_, i) => salesValues[i] + ordersValues[i]);
 
   const config: ChartConfiguration<'line', number[], string> = {
     type: 'line',
     data: {
       labels: allDates,
       datasets: [
         {
           label: 'CA Global',
           data: totalValues,
           borderColor: '#4ade80',
           backgroundColor: 'rgba(74, 222, 128, 0.1)',
           borderWidth: 3,
           pointRadius: 4,
           pointHoverRadius: 6,
           pointBackgroundColor: '#4ade80',
           fill: true,
           tension: 0.4
         },
         {
           label: 'Transactions',
           data: salesValues,
           borderColor: '#3b82f6',
           backgroundColor: 'rgba(59, 130, 246, 0.1)',
           borderWidth: 2,
           borderDash: [6, 3],
           pointRadius: 4,
           pointHoverRadius: 6,
           pointBackgroundColor: '#3b82f6',
           fill: false,
           tension: 0.4
         },
         {
           label: 'Commandes Livrées',
           data: ordersValues,
           borderColor: '#facc15',
           backgroundColor: 'rgba(250, 204, 21, 0.1)',
           borderWidth: 2,
           pointRadius: 4,
           pointHoverRadius: 6,
           pointBackgroundColor: '#facc15',
           fill: false,
           tension: 0.4
         }
       ]
     },
     options: {
       responsive: true,
       maintainAspectRatio: false,
       animation: {
         duration: 1000,
         easing: 'easeOutQuart'
       },
       plugins: {
         legend: {
           position: 'bottom',
           labels: {
             font: {
               size: 13
             },
             usePointStyle: true
           }
         },
         tooltip: {
           backgroundColor: '#ffffff',
           titleColor: '#111827',
           bodyColor: '#374151',
           borderColor: '#e5e7eb',
           borderWidth: 1,
           callbacks: {
             label: (context) => {
               const label = context.dataset.label || '';
               const value = context.raw as number;
               return `${label}: ${value.toFixed(2)} DT`;
             }
           }
         }
       },
       layout: {
         padding: { top: 10, left: 10, right: 10, bottom: 10 }
       },
       scales: {
         y: {
           beginAtZero: true,
           ticks: {
             color: '#374151',
             font: { size: 12 },
             callback: (value) => `${value} DT`
           },
           grid: {
             color: '#e5e7eb',
             drawBorder: false
           },
           title: {
             display: true,
             text: 'Montant (DT)',
             font: {
               size: 14,
               weight: 'bold'
             },
             color: '#111827'
           }
         },
         x: {
           ticks: {
             color: '#374151',
             font: { size: 12 }
           },
           grid: {
             display: false
           },
           title: {
             display: true,
             text: 'Date',
             font: {
               size: 14,
               weight: 'bold'
             },
             color: '#111827'
           }
         }
       }
     }
   };
 
   this.combinedCAChart = new Chart(ctx, config);
 }
 
 
   private groupDeliveredOrdersByDay(): { labels: string[]; values: number[] } {
     const groupedData: Record<string, number> = {};
 
     const { start, end } = this.getDateRange();
 
     this.deliveredOrders.forEach(order => {
       try {
         const orderDate = new Date(order.orderDate || order.date);
         if (!isWithinInterval(orderDate, { start, end })) return;
 
         const key = orderDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
         groupedData[key] = (groupedData[key] || 0) + (order.grandTotal || order.totalAmount || 0);
       } catch (e) {
         console.error('Erreur groupage commandes par jour:', e);
       }
     });
 
     return {
       labels: Object.keys(groupedData),
       values: Object.values(groupedData)
     };
   }
 
   retryFiltering(): void {
     this.errorMessage = null;
     this.applyPeriodFilter();
   }
 
   private destroyCharts(): void {
     if (this.lineChart) {
       this.lineChart.destroy();
       this.lineChart = undefined;
     }
     if (this.combinedCAChart) {
       this.combinedCAChart.destroy();
       this.combinedCAChart = undefined;
     }
     if (this.profitChart) {
       this.profitChart.destroy();
       this.profitChart = undefined;
     }
   }
 
   private initProfitChart(): void {
     const ctx = document.getElementById('profitChart') as HTMLCanvasElement;
     if (!ctx) return;
 
     if (this.profitChart) {
       this.profitChart.destroy();
     }
 
     this.profitChart = new Chart(ctx, {
       type: 'bar',
       data: {
         labels: ['Transactions', 'Delivered Orders', 'Total'],
         datasets: [{
           label: 'Gross Profit (DT)',
           data: [
             this.benefice,
             this.calculateDeliveryProfit(),
             this.benefice + this.calculateDeliveryProfit()
           ],
           backgroundColor: [
             'rgba(54, 162, 235, 0.7)',
             'rgba(255, 206, 86, 0.7)',
             'rgba(75, 192, 192, 0.7)'
           ],
           borderColor: [
             'rgba(54, 162, 235, 1)',
             'rgba(255, 206, 86, 1)',
             'rgba(75, 192, 192, 1)'
           ],
           borderWidth: 1
         }]
       },
       options: {
         responsive: true,
         scales: {
           y: {
             beginAtZero: true,
             title: {
               display: true,
               text: 'Amount (DT)'
             }
           }
         },
         plugins: {
           tooltip: {
             callbacks: {
               label: (context) => {
                 const label = context.dataset.label || '';
                 const value = context.raw as number;
                 return `${label}: ${value.toFixed(2)} DT`;
               }
             }
           }
         }
       }
     });
   }
 
   calculateDeliveryProfit(): number {
     const costMap = new Map(
       this.stock.map(item => [item.idProduit, item.prixUnitaireHT])
     );
 
     return this.deliveredOrders.reduce((total, order) => {
       return total + (order.items?.reduce((sum: number, item: any) => {
         const cost = (costMap.get(item.productId) || 0) * (item.quantity || 0);
         return sum + (item.totalPrice || 0) - cost;
       }, 0) || 0);
     }, 0);
   }
 }
 