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

    const existingItem = this.currentSale.items.find(item => 
      item.productId === this.selectedProduct?.idProduit 
    );    
    if (existingItem) {
      existingItem.quantity += this.selectedQuantity;
      existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
    } else {
      const newItem: SaleItem = {
        productId: this.selectedProduct.idProduit,
        name: this.selectedProduct.nomProduit,
        quantity: this.selectedQuantity,
        unitPrice: this.selectedProduct.prixDeVente,
        totalPrice: this.selectedQuantity * this.selectedProduct.prixDeVente,
      };
      this.currentSale.items.push(newItem);
    }

    this.updateCartTotals();
    this.clearSelection();
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
  
      img.onerror = () => reject('Erreur lors du chargement de l\'image');
    });
  }
   
 
 // Facturation
private async printInvoice(sale: Sale): Promise<void> {
  // Création du document PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Couleurs
  const primaryColor: [number, number, number] = [41, 128, 185];
  const secondaryColor: [number, number, number] = [52, 152, 219];
  const lightColor: [number, number, number] = [236, 240, 241];
  const discountColor: [number, number, number] = [192, 57, 43];

  // Métadonnées du document
  doc.setProperties({
    title: `Facture ${sale.invoiceNumber}`,
    subject: `Vente du ${new Date(sale.date).toLocaleDateString('fr-FR')}`,
    author: 'QStocker',
    creator: 'QStocker POS System'
  });

  // ==================== EN-TÊTE ====================
  try {
    const logoBase64 = await this.loadImageBase64('assets/images/qstockerlogo.PNG');
    doc.addImage({
      imageData: logoBase64,
      x: 20,
      y: 12,
      width: 40,
      height: 20,
      format: 'PNG'
    });
  } catch (error) {
    console.error('Erreur logo:', error);
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.text('QStocker', 20, 23);
  }

  // Coordonnées entreprise
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text('Mahdia, Zone touristique', 130, 30);
  doc.text('Tél: +216 70 123 456', 130, 35);
  doc.text('Email: contact.qstocker@gmail.com', 130, 40);

  // Titre principal
  doc.setFontSize(28);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', 105, 50, { align: 'center' });
  doc.setDrawColor(...secondaryColor);
  doc.setLineWidth(1);
  doc.line(80, 53, 130, 53);

  // Infos facture
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`N°: ${sale.invoiceNumber}`, 20, 65);
  doc.text(`Date: ${new Date(sale.date).toLocaleDateString('fr-FR')}`, 20, 70);
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(20, 75, 190, 75);

  // ==================== SECTION CLIENT ====================
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT', 20, 85);

  autoTable(doc, {
    startY: 90,
    margin: { left: 20 },
    head: [['Champ', 'Valeur']],
    body: [
      ['Nom', sale.customerName || 'Non spécifié'],
      ['ID Client', sale.customerId || 'N/A'],
      ['Date de vente', new Date(sale.date).toLocaleString('fr-FR')],
      ['Méthode de paiement', this.getPaymentMethodLabel(sale.paymentMethod)]
    ],
    theme: 'grid',
    styles: {
      cellPadding: 4,
      fontSize: 10,
      lineColor: lightColor,
    },
    headStyles: {
      fillColor: secondaryColor,
      textColor: 255,
      fontStyle: 'bold',
    }
  });

  // ==================== SECTION ARTICLES ====================
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉTAIL DE LA COMMANDE', 20, (doc as any).lastAutoTable.finalY + 10);

  // Vérification et formatage des articles
  const itemsBody = sale.items.map(item => [
    item.name || 'Produit sans nom',
    `${(item.unitPrice || 0).toFixed(2)} DT`,
    (item.quantity || 0).toString(),
    `${(item.totalPrice || 0).toFixed(2)} DT`
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [['Produit', 'Prix unitaire', 'Quantité', 'Total']],
    body: itemsBody,
    theme: 'striped',
    styles: {
      fontSize: 10,
      cellPadding: 4,
      lineColor: lightColor,
    },
    headStyles: {
      fillColor: primaryColor,
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248]
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 30, halign: 'right' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' }
    }
  });

  // ==================== SECTION TOTAUX ====================
  // Calculs robustes avec valeurs par défaut
  const subTotal = sale.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const discount = sale.discount || 0;
  const discountAmount = subTotal * (discount / 100);
  const totalAmount = subTotal - discountAmount;

  // Position Y pour la section des totaux
  const totalsStartY = (doc as any).lastAutoTable.finalY + 15;

  // Ajout d'un cadre pour les totaux
  doc.setDrawColor(...lightColor);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(120, totalsStartY - 5, 80, discount > 0 ? 40 : 30, 3, 3, 'FD');

  // Sous-total
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('Sous-total:', 125, totalsStartY + 5);
  doc.text(`${subTotal.toFixed(2)} DT`, 185, totalsStartY + 5, { align: 'right' });

  // Détails de la remise seulement si applicable
  if (discount > 0) {
    // Pourcentage de remise
    doc.setTextColor(0);
    doc.text('Remise appliquée:', 125, totalsStartY + 12);
    doc.text(`${discount}%`, 185, totalsStartY + 12, { align: 'right' });

    // Montant de la remise
    doc.setTextColor(...discountColor);
    doc.text('Montant remise:', 125, totalsStartY + 19);
    doc.text(`-${discountAmount.toFixed(2)} DT`, 185, totalsStartY + 19, { align: 'right' });
  }

  // Ligne de séparation
  doc.setDrawColor(...lightColor);
  doc.line(125, totalsStartY + (discount > 0 ? 24 : 14), 185, totalsStartY + (discount > 0 ? 24 : 14));

  // Total à payer
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Total à payer:', 125, totalsStartY + (discount > 0 ? 32 : 22));
  doc.text(`${totalAmount.toFixed(2)} DT`, 185, totalsStartY + (discount > 0 ? 32 : 22), { align: 'right' });

  // ==================== PIED DE PAGE ====================
  const footerY = 280;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.3);
  doc.line(20, footerY, 190, footerY);

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Merci pour votre confiance !', 105, footerY + 5, { align: 'center' });
  doc.text('Contact : contact.qstocker@gmail.com | Tél: +216 70 123 456', 105, footerY + 10, { align: 'center' });

  // ==================== GÉNÉRATION DU FICHIER ====================
  const fileName = `Facture_${sale.invoiceNumber}_${(sale.customerName || 'client').replace(/ /g, '_')}.pdf`;
  doc.save(fileName);
}

printExistingInvoice(sale: Sale): void {
  this.printInvoice(sale);
}



}