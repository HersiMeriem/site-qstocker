import { Component, OnInit, ViewChild } from '@angular/core';
import { StockItem, StockService } from '../../services/stock.service';
import { SaleService } from '../../services/sale.service';
import { CustomerService } from '../../services/customer.service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, SaleItem } from '../../models/sale';
import { MatDialog } from '@angular/material/dialog';
import { SalesReportsComponent } from '../sales-reports/sales-reports.component';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { v4 as uuidv4 } from 'uuid';
import { HttpClient } from '@angular/common/http';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

@Component({
  selector: 'app-sales',
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.css']
})
export class SalesComponent implements OnInit {
  @ViewChild('scanner') scanner!: ZXingScannerComponent;
  availableProducts: StockItem[] = [];
  selectedProductId: string = '';
  selectedQuantity: number = 1;
  selectedProduct: StockItem | null = null;
  searchTerm = '';
  filteredSalesHistory: Sale[] = [];
  loadingStats = true;
  statsError: string | null = null;
  loadingHistory = true;
  historyError: string | null = null;
  imageLoaded: boolean = false;

  // Scanner properties
  scannerEnabled = false;
  availableCameras: MediaDeviceInfo[] = [];
  currentCamera: MediaDeviceInfo | undefined;
  allowedFormats: BarcodeFormat[] = [BarcodeFormat.QR_CODE];
  scannedProduct: any = null;

  // Cart management
  currentSale: Omit<Sale, 'id'> = {
    items: [],
    subTotal: 0,
    discount: 0,
    discountAmount: 0,
    totalAmount: 0,
    paymentMethod: 'cash',
    customerId: '',
    customerName: '',
    invoiceNumber: '',
    userId: 'current-user-id',
    date: new Date().toISOString()
  };
  db: any;
  dbPath: any;

  // Data
  salesHistory: Sale[] = [];
  customers: any[] = [];
  dailyRevenue = 0;
  dailySalesCount = 0;
  historyFilter = 'today';

  paymentMethods = [
    { value: 'cash', label: 'Espèces', icon: 'fas fa-money-bill-wave' },
    { value: 'card', label: 'Carte', icon: 'fas fa-credit-card' },
    { value: 'credit', label: 'Crédit', icon: 'fas fa-hand-holding-usd' }
  ];

  constructor(
    private stockService: StockService,
    private saleService: SaleService,
    private customerService: CustomerService,
    private dialog: MatDialog
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.loadStock();
      this.loadSalesHistory();
      this.loadDailyStats();
      console.log('Initialisation complète - Produits disponibles:', this.availableProducts.length);
    } catch (error) {
      console.error('Erreur initialisation:', error);
    }
  }

  private async loadStock(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stockService.getStock().subscribe({
        next: (items) => {
          this.availableProducts = items;
          resolve();
        },
        error: (err) => reject(err)
      });
    });
  }

  private loadInitialData(): void {
    this.loadStock();
    this.loadCustomers();
    this.loadSalesHistory();
    this.loadDailyStats();
  }

  generateCustomerId(customerName: string): string {
    const normalizedName = customerName.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);

    const existingSale = this.salesHistory.find(sale => {
      const saleDate = new Date(sale.date).toISOString().slice(0, 10);
      return sale.customerName.toLowerCase() === normalizedName
        && saleDate === today;
    });

    if (existingSale) {
      return existingSale.customerId;
    }

    return this.createNewCustomerId();
  }

  private createNewCustomerId(): string {
    const timestamp = new Date().getTime().toString().slice(-6);
    const random = Math.floor(100 + Math.random() * 900);
    return `CLI-${timestamp}-${random}`;
  }

  private loadCustomers(): void {
    this.customerService.getCustomers().subscribe({
      next: (customers: any[]) => this.customers = customers,
      error: (err: any) => console.error('Erreur chargement clients:', err)
    });
  }

  private loadDailyStats(): void {
    this.loadingStats = true;
    this.statsError = null;

    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();

    this.saleService.getSalesByDateRange(todayStart, todayEnd).subscribe({
      next: (sales: Sale[]) => {
        this.dailySalesCount = sales.length;
        this.dailyRevenue = sales.reduce((sum: number, sale: Sale) => sum + sale.totalAmount, 0);
        this.loadingStats = false;
      },
      error: (err: any) => {
        console.error('Erreur stats quotidiennes:', err);
        this.statsError = 'Erreur de chargement des statistiques';
        this.loadingStats = false;
      }
    });
  }

  public loadSalesHistory(): void {
    this.loadingHistory = true;
    this.historyError = null;

    this.saleService.getSalesHistory(this.historyFilter).subscribe({
      next: (sales: Sale[]) => {
        this.salesHistory = sales
          .filter(s => s.items && s.items.length > 0)
          .sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        this.filteredSalesHistory = [...this.salesHistory];
        this.loadingHistory = false;
      },
      error: (err: any) => {
        console.error('Erreur complète:', err);
        this.historyError = 'Erreur de chargement: ' + err.message;
        this.loadingHistory = false;
      }
    });
  }

  refreshQRCode(): void {
    if (this.selectedProduct) {
      this.selectedProduct = { ...this.selectedProduct };
    }
  }

  closeScanner(): void {
    this.scannerEnabled = false;
    this.scannedProduct = null;
    this.selectedQuantity = 1;
  }

  handleScanSuccess(resultString: string): void {
    console.log('Données brutes du QR code:', resultString);

    try {
      let productId: string;

      // Essayer de parser le QR code comme JSON
      try {
        const qrData = JSON.parse(resultString);
        productId = qrData.idProduit || qrData.id || resultString;
      } catch {
        // Si ce n'est pas du JSON, utiliser directement la chaîne
        productId = resultString;
      }

      // Nettoyer l'ID du produit
      productId = productId.toString().trim().toLowerCase();

      // Trouver le produit correspondant
      const product = this.availableProducts.find(p =>
        p.idProduit.toString().trim().toLowerCase() === productId
      );

      if (product) {
        if (product.quantite <= 0) {
          this.showProductNotFoundError('Ce produit est en rupture de stock');
          return;
        }

        this.scannedProduct = { ...product };
        this.selectedQuantity = 1;
      } else {
        this.showProductNotFoundError(productId);
      }
    } catch (error) {
      console.error('Erreur de traitement du QR code:', error);
      this.showScanError('Erreur de lecture du QR code');
    }
  }

  generateProductQRCode(product: StockItem): string {
    return JSON.stringify({
      system: 'QStocker',
      version: '2.0',
      productId: product.idProduit,
      timestamp: new Date().toISOString()
    });
  }

  async openScanner(): Promise<void> {
    try {
      if (this.scannerEnabled) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      this.scannerEnabled = true;
      this.scannedProduct = null;

      window.addEventListener('beforeunload', () => this.cleanupScanner(stream));

    } catch (error) {
      console.error('Erreur d\'accès caméra:', error);
      this.showScanError('Accès caméra refusé - Vérifiez les permissions');
    }
  }

  private cleanupScanner(stream: MediaStream): void {
    stream.getTracks().forEach(track => {
      track.stop();
      stream.removeTrack(track);
    });
    this.scannerEnabled = false;
  }

  private showProductNotFoundError(productId: string): void {
    const message = `Produit "${productId}" non trouvé ou hors stock`;
    console.warn(message);
    alert(message);
    this.scannedProduct = null;
  }

  private showScanError(message: string): void {
    alert(`Erreur de scan: ${message}`);
    this.scannerEnabled = false;
    this.scannedProduct = null;
  }

  handleCamerasFound(devices: MediaDeviceInfo[]): void {
    this.availableCameras = devices;
    if (devices.length > 0) {
      this.currentCamera = devices[0];
    }
  }

  camerasFoundHandler(cameras: MediaDeviceInfo[]): void {
    this.availableCameras = cameras;
    this.currentCamera = cameras.length > 0 ? cameras[0] : undefined;
  }

  onProductSelect(): void {
    if (this.selectedProductId) {
      this.stockService.getProduct(this.selectedProductId).subscribe({
        next: (product) => {
          this.selectedProduct = product || null;
          this.selectedQuantity = 1;
        },
        error: (err) => console.error('Erreur chargement produit:', err)
      });
    } else {
      this.selectedProduct = null;
    }
  }

  incrementQuantity(): void {
    if (this.selectedProduct) {
      this.selectedQuantity++;
    }
  }

  decrementQuantity(): void {
    if (this.selectedQuantity > 1) {
      this.selectedQuantity--;
    }
  }

  addScannedToCart(): void {
    if (!this.scannedProduct) return;

    // Vérifier si le produit est en stock
    if (this.scannedProduct.quantite <= 0) {
      alert('Ce produit est en rupture de stock');
      return;
    }

    // Vérifier la quantité
    if (this.selectedQuantity <= 0 || this.selectedQuantity > this.scannedProduct.quantite) {
      alert('Quantité invalide');
      return;
    }

    // Créer l'item pour le panier
    const newItem: SaleItem = {
      productId: this.scannedProduct.idProduit,
      name: this.scannedProduct.nomProduit,
      quantity: this.selectedQuantity,
      unitPrice: this.scannedProduct.prixDeVente,
      originalPrice: this.scannedProduct.prixDeVente,
      totalPrice: this.selectedQuantity * this.scannedProduct.prixDeVente
    };

    // Vérifier si le produit existe déjà dans le panier
    const existingItemIndex = this.currentSale.items.findIndex(
      item => item.productId === newItem.productId
    );

    if (existingItemIndex !== -1) {
      // Mettre à jour la quantité si le produit existe déjà
      this.currentSale.items[existingItemIndex].quantity += newItem.quantity;
      this.currentSale.items[existingItemIndex].totalPrice =
        this.currentSale.items[existingItemIndex].quantity *
        this.currentSale.items[existingItemIndex].unitPrice;
    } else {
      // Ajouter le nouvel item
      this.currentSale.items.push(newItem);
    }

    // Mettre à jour les totaux
    this.updateCartTotals();

    // Fermer le scanner
    this.closeScanner();
  }

  get canAddToCart(): boolean {
    return !!this.selectedProduct &&
           this.selectedQuantity > 0;
  }

  addToCart(): void {
    if (!this.selectedProduct) {
      alert('Aucun produit sélectionné');
      return;
    }

    if (this.selectedProduct.quantite <= 0) {
      alert('Ce produit est en rupture de stock');
      return;
    }

    if (this.selectedQuantity <= 0 || this.selectedQuantity > this.selectedProduct.quantite) {
      alert('Quantité invalide');
      return;
    }

    if (!this.canAddToCart) return;

    const unitPrice = this.selectedProduct.prixDeVente;
    const originalPrice = this.selectedProduct.prixDeVente;

    const existingItem = this.currentSale.items.find(item =>
      item.productId === this.selectedProduct?.idProduit &&
      item.unitPrice === unitPrice
    );

    if (existingItem) {
      existingItem.quantity += this.selectedQuantity;
      existingItem.totalPrice = existingItem.quantity * unitPrice;
    } else {
      const newItem: SaleItem = {
        productId: this.selectedProduct.idProduit,
        name: this.selectedProduct.nomProduit,
        quantity: this.selectedQuantity,
        unitPrice: unitPrice,
        originalPrice: originalPrice,
        totalPrice: this.selectedQuantity * unitPrice
      };
      this.currentSale.items.push(newItem);
    }

    this.updateCartTotals();
    this.clearSelection();
  }

  get canFinalize(): boolean {
    return this.currentSale.items.length > 0 &&
           this.currentSale.totalAmount > 0 &&
           !!this.currentSale.customerName.trim();
  }

  resetSale(): void {
    this.currentSale = {
      items: [],
      subTotal: 0,
      discount: 0,
      discountAmount: 0,
      totalAmount: 0,
      paymentMethod: 'cash',
      customerId: '',
      customerName: '',
      invoiceNumber: '',
      userId: 'current-user-id',
      date: new Date().toISOString()
    };
  }

  getPaymentMethodLabel(method: string): string {
    return this.paymentMethods.find(m => m.value === method)?.label || method;
  }

  getPaymentMethodIcon(method: string): string {
    return this.paymentMethods.find(m => m.value === method)?.icon || 'fas fa-question-circle';
  }

  applySearchFilter(): void {
    const search = this.searchTerm.toLowerCase().trim();

    if (!search) {
      this.filteredSalesHistory = [...this.salesHistory];
      return;
    }

    this.filteredSalesHistory = this.salesHistory.filter(sale =>
      sale.invoiceNumber.toLowerCase().includes(search) ||
      sale.items.some(item => item.name.toLowerCase().includes(search)) ||
      new Date(sale.date).toLocaleDateString('fr-FR').includes(search)
    );
  }

  showReports(): void {
    this.dialog.open(SalesReportsComponent, {
      width: '95vw',
      height: '90vh',
      maxWidth: '1400px',
      panelClass: 'reports-dialog',
      data: {
        salesHistory: this.salesHistory,
        dailyRevenue: this.dailyRevenue,
        dailySalesCount: this.dailySalesCount
      }
    });
  }

  private loadImageBase64(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = path;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context not found');

        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = (error) => reject(`Erreur lors du chargement de l'image: ${error}`);
    });
  }

  private async printInvoice(sale: Sale): Promise<void> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const styles = {
      primaryColor: [41, 128, 185] as [number, number, number],
      secondaryColor: [236, 240, 241] as [number, number, number],
      font: 'helvetica',
      headerHeight: 50,
      margin: 20,
      footerHeight: 20
    };

    try {
      const logoBase64 = await this.loadImageBase64('assets/images/qstockerlogo.PNG');
      doc.addImage({
        imageData: logoBase64,
        x: styles.margin,
        y: 15,
        width: 40,
        height: 20,
        format: 'PNG'
      });
    } catch (error) {
      console.error('Erreur de chargement du logo:', error);
      doc.setFontSize(16);
      doc.setTextColor(...styles.primaryColor);
      doc.setFont(styles.font, 'bold');
      doc.text('QStocker', styles.margin, 25);
    }

    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.setFont(styles.font, 'normal');
    const companyInfo = [
      'Mahdia, Zone touristique',
      'Tél: +216 70 123 456',
      'Email: contact.qstocker@gmail.com',
      'R.C. : 12345678A | TVA: 12345678'
    ];
    companyInfo.forEach((line, index) => {
      doc.text(line, 130, 25 + (index * 5));
    });

    doc.setDrawColor(...styles.primaryColor);
    doc.setLineWidth(0.5);
    doc.line(styles.margin, 45, doc.internal.pageSize.width - styles.margin, 45);

    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.setFont(styles.font, 'bold');
    doc.text(`Facture N°: ${sale.invoiceNumber}`, styles.margin, 55);
    doc.setFont(styles.font, 'normal');
    doc.text(`Date: ${new Date(sale.date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })}`, styles.margin, 60);

    const clientStartY = 65;
    autoTable(doc, {
      startY: clientStartY,
      margin: { left: styles.margin },
      head: [[{ content: 'INFORMATIONS CLIENT', colSpan: 2, styles: { fillColor: styles.primaryColor } }]],
      body: [
        ['Nom', sale.customerName || 'Non spécifié'],
        ['ID Client', sale.customerId || 'N/A'],
        ['Date de vente', new Date(sale.date).toLocaleString('fr-FR')],
        ['Méthode de paiement', this.getPaymentMethodLabel(sale.paymentMethod)]
      ],
      theme: 'plain',
      styles: {
        fontSize: 10,
        cellPadding: 4,
        lineColor: styles.primaryColor,
        textColor: 40
      },
      headStyles: {
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 60 }
      }
    });

    const itemsStartY = (doc as any).lastAutoTable.finalY + 10;
    autoTable(doc, {
      startY: itemsStartY,
      head: [
        [
          'Produit',
          { content: 'Prix unitaire', styles: { halign: 'right' } },
          { content: 'Quantité', styles: { halign: 'center' } },
          { content: 'Total', styles: { halign: 'right' } }
        ]
      ],
      body: sale.items.map(item => [
        item.name || 'Produit non nommé',
        {
          content: `${item.unitPrice.toFixed(2)} DT`,
          styles: { halign: 'right' }
        },
        { content: (item.quantity || 0).toString(), styles: { halign: 'center' } },
        { content: `${(item.totalPrice || 0).toFixed(2)} DT`, styles: { halign: 'right' } }
      ]),
      margin: { left: styles.margin, right: styles.margin },
      styles: {
        fontSize: 10,
        cellPadding: 4,
        textColor: 40
      },
      headStyles: {
        fillColor: styles.primaryColor,
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 45 },
        2: { cellWidth: 25 },
        3: { cellWidth: 35 }
      }
    });

    const totals = {
      subTotal: sale.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
      discount: sale.discount || 0,
      get discountAmount() { return this.subTotal * (this.discount / 100) },
      get total() { return this.subTotal - this.discountAmount }
    };

    const totalsStartY = (doc as any).lastAutoTable.finalY + 15;
    const totalsWidth = 70;
    const totalsX = doc.internal.pageSize.width - styles.margin - totalsWidth;

    doc.setDrawColor(...styles.primaryColor);
    doc.setFillColor(...styles.secondaryColor);
    doc.rect(totalsX - 5, totalsStartY - 5, totalsWidth + 10, totals.discount ? 45 : 30, 'FD');

    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.setFont(styles.font, 'bold');
    doc.text('Sous-total:', totalsX, totalsStartY);
    doc.text(`${totals.subTotal.toFixed(2)} DT`, totalsX + totalsWidth - 5, totalsStartY, { align: 'right' });
    let currentY = totalsStartY + 8;

    if (totals.discount) {
      doc.text(`Remise (${totals.discount}%):`, totalsX, currentY);
      doc.text(`-${totals.discountAmount.toFixed(2)} DT`, totalsX + totalsWidth - 5, currentY, { align: 'right' });
      currentY += 8;

      doc.setDrawColor(200);
      doc.setLineWidth(0.3);
      doc.line(totalsX, currentY, totalsX + totalsWidth, currentY);
      currentY += 5;
    }

    doc.setFontSize(12);
    doc.setTextColor(...styles.primaryColor);
    doc.text('Total à payer:', totalsX, currentY);
    doc.text(`${totals.total.toFixed(2)} DT`, totalsX + totalsWidth - 5, currentY, { align: 'right' });

    const footerContent = [
      'Merci pour votre confiance !',
      'Contact : contact.qstocker@gmail.com | Tél: +216 70 123 456'
    ];

    doc.setFontSize(8);
    doc.setTextColor(100);
    footerContent.forEach((line, index) => {
      doc.text(line, doc.internal.pageSize.width / 2, 290 + (index * 4), { align: 'center' });
    });

    const cleanName = (sale.customerName || 'client').replace(/[^a-zA-Z0-9_]/g, '_');
    const fileName = `Facture_${sale.invoiceNumber}_${cleanName}.pdf`;
    doc.save(fileName);
  }

  printExistingInvoice(sale: Sale): void {
    this.printInvoice(sale);
  }

  getTotalProductDiscount(): number {
    return 0;
  }

  updateDiscount(): void {
    this.currentSale.discountAmount = this.currentSale.subTotal * (this.currentSale.discount / 100);
    this.currentSale.totalAmount = this.currentSale.subTotal - this.currentSale.discountAmount;
  }

  removeItem(index: number): void {
    this.currentSale.items.splice(index, 1);
    this.updateCartTotals();
  }

  private clearSelection(): void {
    this.selectedProductId = '';
    this.selectedProduct = null;
    this.selectedQuantity = 1;
  }

  async finalizeSale(): Promise<void> {
    if (!this.canFinalize) return;

    this.currentSale.customerId = this.generateCustomerId(this.currentSale.customerName);

    try {
      const saleData: Omit<Sale, 'id'> = {
        items: this.currentSale.items,
        subTotal: this.currentSale.subTotal,
        discount: this.currentSale.discount,
        discountAmount: this.currentSale.discountAmount,
        totalAmount: this.currentSale.totalAmount,
        paymentMethod: this.currentSale.paymentMethod,
        customerName: this.currentSale.customerName,
        customerId: this.currentSale.customerId,
        userId: 'current-user-id',
        date: new Date().toISOString(),
        invoiceNumber: ''
      };

      const createdSale = await this.saleService.createSale(saleData);
      this.salesHistory.unshift(createdSale);
      this.filteredSalesHistory = [...this.salesHistory];
      this.printInvoice(createdSale);
      this.resetSale();
      this.loadDailyStats();
      await this.loadStock();
    } catch (error) {
      console.error('Erreur finale:', error);
    }
  }

  private async validateSaleData(saleData: any): Promise<void> {
    if (!saleData.items || saleData.items.length === 0) {
      throw new Error('Le panier est vide');
    }

    if (saleData.totalAmount <= 0) {
      throw new Error('Le montant total doit être positif');
    }

    if (!saleData.paymentMethod) {
      throw new Error('Méthode de paiement non spécifiée');
    }
  }

  private async processSaleTransaction(saleData: any): Promise<string> {
    const saleRef = this.db.list(this.dbPath).push(saleData);
    return saleRef.key || '';
  }

  updateCartTotals(): void {
    this.currentSale.subTotal = this.currentSale.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.updateDiscount();
  }
}
