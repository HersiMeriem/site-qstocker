import { Component, OnInit, ViewChild } from '@angular/core';
import { StockItem, StockService } from '../../services/stock.service';
import { SaleService } from '../../services/sale.service';
import { CustomerService } from '../../services/customer.service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, SaleItem } from '../../models/sale';
import { MatDialog } from '@angular/material/dialog';
import { SalesReportsComponent } from '../sales-reports/sales-reports.component';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { QRCodeModule } from 'angularx-qrcode';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';

interface Promotion {
  startDate: string;
  endDate: string;
  discountPercentage: number;
}
 

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


    // Propriétés du scanner
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
console: any;

generateCustomerId(customerName: string): string {
  // Normaliser le nom et la date
  const normalizedName = customerName.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10); // Format YYYY-MM-DD

  // Rechercher dans l'historique
  const existingSale = this.salesHistory.find(sale => {
    const saleDate = new Date(sale.date).toISOString().slice(0, 10);
    return sale.customerName.toLowerCase() === normalizedName 
      && saleDate === today;
  });

  return existingSale?.customerId || this.createNewCustomerId();
}

private createNewCustomerId(): string {
  const timestamp = new Date().getTime().toString().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);
  return `CLI-${timestamp}-${random}`;
}

  // Données
  salesHistory: Sale[] = [];
  customers: any[] = [];
  dailyRevenue = 0;
  dailySalesCount = 0;
  historyFilter = 'today';
    // Stats

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
          console.log('Stock chargé:', items.map(i => i.idProduit));
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
      console.log('Données brutes:', sales); // Debug
      this.salesHistory = sales
        .filter(s => s.items && s.items.length > 0) // Filtre les ventes vides
        .sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      
      this.filteredSalesHistory = [...this.salesHistory];
      this.loadingHistory = false;
      
      console.log('Ventes traitées:', this.salesHistory); // Debug
    },
    error: (err: any) => {
      console.error('Erreur complète:', err); // Log complet
      this.historyError = 'Erreur de chargement: ' + err.message;
      this.loadingHistory = false;
    }
  });
}
  refreshQRCode(): void {
    if (this.selectedProduct) {
        this.selectedProduct = { ...this.selectedProduct };
    }}

  closeScanner(): void {
    this.scannerEnabled = false;
    this.scannedProduct = null;
    this.selectedQuantity = 1;
  }
  
  //scan qrcode 
  handleScanSuccess(resultString: string): void {
    console.log('Données brutes du QR code:', resultString);
  
    try {
      let productId: string;
  
      // Tentative de parsing JSON avec vérification de structure
      try {
        const qrData = JSON.parse(resultString);
        console.log('QR code structuré:', qrData);
        
        if (!qrData.idProduit && !qrData.id) {
          throw new Error('Structure QR code invalide');
        }
        productId = qrData.idProduit || qrData.id;
      } catch (jsonError) {
        console.log('QR code non-JSON - Utilisation directe de la chaîne');
        productId = resultString;
      }
  
      // Normalisation avancée de l'ID
      productId = productId.toString().trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  
      // Recherche avec indexation pour meilleure performance
      const product = this.availableProducts.find(p => {
        const normalizedId = p.idProduit.toString().trim().toLowerCase();
        return normalizedId === productId && p.quantite > 0;
      });
  
      if (product) {
        console.log('Produit trouvé:', product);
        this.scannedProduct = {
          ...product,
          // Génération dynamique du QR code et validation de l'image
          qrCode: this.generateProductQRCode(product),
        };
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

  //gestion de scan
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
    
    // Gestion propre de la fermeture
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
          console.log('Détails du produit:', {
            nom: this.selectedProduct?.nomProduit,
            imageUrl: this.selectedProduct?.imageUrl,
            qrCode: this.selectedProduct?.qrCode
          });
        },
        error: (err) => console.error('Erreur chargement produit:', err)
      });
    } else {
      this.selectedProduct = null;
    }
  }

  incrementQuantity(): void {
    if (this.selectedProduct && this.selectedQuantity < this.selectedProduct.quantite) {
      this.selectedQuantity++;
    }
  }

  decrementQuantity(): void {
    if (this.selectedQuantity > 1) {
      this.selectedQuantity--;
    }
  }
  addScannedToCart(): void {
    if (this.scannedProduct) {
      this.selectedProduct = this.scannedProduct;
      this.selectedProductId = this.scannedProduct.idProduit;
      this.addToCart();
      this.closeScanner();
    }
  }

  // Gestion du panier
  get canAddToCart(): boolean {
    return !!this.selectedProduct && 
           this.selectedQuantity > 0 &&
           this.selectedQuantity <= (this.selectedProduct.quantite || 0);
  }
  addToCart(): void {
    if (!this.selectedProduct || !this.canAddToCart) return;
  
    const unitPrice = this.getCurrentPrice(this.selectedProduct);
    const originalPrice = this.selectedProduct.prixDeVente;
  
    const existingItem = this.currentSale.items.find(item => 
      item.productId === this.selectedProduct?.idProduit 
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
        originalPrice: originalPrice, // Garder le prix original
        totalPrice: this.selectedQuantity * unitPrice,
      };
      this.currentSale.items.push(newItem);
    }
  
    this.updateCartTotals();
    this.clearSelection();
  }
  
  // Méthode améliorée pour vérifier les promotions
  isPromotionActive(product: StockItem): boolean {
    if (!product?.promotion || typeof product.promotion === 'boolean') return false;
    
    const now = new Date();
    const start = new Date(product.promotion.startDate);
    const end = new Date(product.promotion.endDate);
    
    return now >= start && now <= end;
  }


  // Calcul du prix avec réduction
  getCurrentPrice(product: StockItem): number {
    if (!product) return 0;
    
    if (this.isPromotionActive(product)) {
      const discount = (product.promotion as Promotion).discountPercentage / 100;
      return product.prixDeVente * (1 - discount);
    }
    return product.prixDeVente;
  }

  removeItem(index: number): void {
    this.currentSale.items.splice(index, 1);
    this.updateCartTotals();
  }

  updateCartTotals(): void {
    this.currentSale.subTotal = this.currentSale.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.updateDiscount();
  }

  updateDiscount(): void {
    this.currentSale.discountAmount = this.currentSale.subTotal * (this.currentSale.discount / 100);
    this.currentSale.totalAmount = this.currentSale.subTotal - this.currentSale.discountAmount;
  }

  private clearSelection(): void {
    this.selectedProductId = '';
    this.selectedProduct = null;
    this.selectedQuantity = 1;
  }

  // Finalisation de la vente
  get canFinalize(): boolean {
    return this.currentSale.items.length > 0 && 
           this.currentSale.totalAmount > 0 &&
           !!this.currentSale.customerName.trim();
  }

  async finalizeSale(): Promise<void> {
    if (!this.canFinalize) return;
  
    this.currentSale.customerId = this.generateCustomerId(this.currentSale.customerName);
  
    try {
      const createdSale = await this.saleService.createSale(this.currentSale);
      this.salesHistory.unshift(createdSale); 
      this.filteredSalesHistory = [...this.salesHistory];
      this.printInvoice(createdSale);
      this.resetSale();
      this.loadDailyStats();
    } catch (error) {
      console.error('Erreur lors de la vente:', error);
      
      // Gestion type-safe de l'erreur
      let errorMessage = 'Erreur inconnue';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      alert(`Échec de la vente : ${errorMessage}`);
    }
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
 

  // Utilitaires
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
  
    // Configuration des styles
    const styles = {
      primaryColor: [41, 128, 185] as [number, number, number],
      secondaryColor: [236, 240, 241] as [number, number, number],
      font: 'helvetica',
      headerHeight: 50,
      margin: 20,
      footerHeight: 20
    };
  
    // ==================== EN-TÊTE ====================
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
  
    // Coordonnées entreprise
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
  
    // Ligne de séparation
    doc.setDrawColor(...styles.primaryColor);
    doc.setLineWidth(0.5);
    doc.line(styles.margin, 45, doc.internal.pageSize.width - styles.margin, 45);
  
    // ==================== INFORMATIONS FACTURE ====================
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
  
    // ==================== SECTION CLIENT ====================
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
  
    // ==================== SECTION ARTICLES ====================
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
        { content: `${(item.unitPrice || 0).toFixed(2)} DT`, styles: { halign: 'right' } },
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
        0: { cellWidth: 90 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 35 }
      }
    });
  
    // ==================== SECTION TOTAUX ====================
    const totals = {
      subTotal: sale.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
      discount: sale.discount || 0,
      get discountAmount() { return this.subTotal * (this.discount / 100) },
      get total() { return this.subTotal - this.discountAmount }
    };
  
    const totalsStartY = (doc as any).lastAutoTable.finalY + 15;
    const totalsWidth = 70;
    const totalsX = doc.internal.pageSize.width - styles.margin - totalsWidth;
  
    // Encadré des totaux
    doc.setDrawColor(...styles.primaryColor);
    doc.setFillColor(...styles.secondaryColor);
    doc.rect(totalsX - 5, totalsStartY - 5, totalsWidth + 10, totals.discount ? 45 : 30, 'FD');
  
    // Contenu des totaux
    const formatCurrency = (value: number) => `${value.toFixed(2)} DT`;
    let currentY = totalsStartY;
  
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.setFont(styles.font, 'bold');
    doc.text('Sous-total:', totalsX, currentY);
    doc.text(formatCurrency(totals.subTotal), totalsX + totalsWidth - 5, currentY, { align: 'right' });
    currentY += 8;
  
    if (totals.discount) {
      doc.text(`Remise (${totals.discount}%):`, totalsX, currentY);
      doc.text(`-${formatCurrency(totals.discountAmount)}`, totalsX + totalsWidth - 5, currentY, { align: 'right' });
      currentY += 8;
      
      doc.setDrawColor(200);
      doc.setLineWidth(0.3);
      doc.line(totalsX, currentY, totalsX + totalsWidth, currentY);
      currentY += 5;
    }
  
    doc.setFontSize(12);
    doc.setTextColor(...styles.primaryColor);
    doc.text('Total à payer:', totalsX, currentY);
    doc.text(formatCurrency(totals.total), totalsX + totalsWidth - 5, currentY, { align: 'right' });
  
    // ==================== PIED DE PAGE ====================
    const footerContent = [
      'Merci pour votre confiance !',
      'Contact : contact.qstocker@gmail.com | Tél: +216 70 123 456'
    ];
  
    doc.setFontSize(8);
    doc.setTextColor(100);
    footerContent.forEach((line, index) => {
      doc.text(line, doc.internal.pageSize.width / 2, 290 + (index * 4), { align: 'center' });
    });
  
    // ==================== GÉNÉRATION DU FICHIER ====================
    const cleanName = (sale.customerName || 'client').replace(/[^a-zA-Z0-9_]/g, '_');
    const fileName = `Facture_${sale.invoiceNumber}_${cleanName}.pdf`;
    doc.save(fileName);
  }

printExistingInvoice(sale: Sale): void {
  this.printInvoice(sale);
}

getTotalProductDiscount(): number {
  return this.currentSale.items.reduce((total, item) => {
    if (item.unitPrice !== item.originalPrice) {
      return total + ((item.originalPrice || 0) - item.unitPrice) * item.quantity;
    }
    return total;
  }, 0);
}



updateCartPrices(): void {
  this.currentSale.items.forEach(item => {
    const product = this.availableProducts.find(p => p.idProduit === item.productId);
    if (product) {
      item.unitPrice = this.getCurrentPrice(product);
      item.totalPrice = item.unitPrice * item.quantity;
    }
  });
  this.updateCartTotals();
}
}