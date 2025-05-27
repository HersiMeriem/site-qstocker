
import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { StockService } from '../../services/stock.service';
import { StockItem, Promotion } from '../../services/stock.service';
import { NgForm } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { Subscription, combineLatest, firstValueFrom } from 'rxjs';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-stock',
  templateUrl: './stock.component.html',
  styleUrls: ['./stock.component.css']
})
export class StockComponent implements OnInit, OnDestroy {
  @ViewChild('editForm') editForm!: NgForm;
  stock: StockItem[] = [];
  filteredStock: StockItem[] = [];
  loading = true;
  errorMessage: string | null = null;
  searchTerm = '';
  selectedProduct: StockItem = this.createEmptyProduct();
  updating = false;
  products: Product[] = [];

  private stockSubscription!: Subscription;
  private stockPath = '/stock'; // Define stock path

  constructor(
    private db: AngularFireDatabase,
    private stockService: StockService,
    private productService: ProductService
  ) {}


    async ngOnInit(): Promise<void> {
    await this.syncStockStatus();
    this.loadStock();
    this.loadProducts();
  }

  ngOnDestroy(): void {
    if (this.stockSubscription) {
      this.stockSubscription.unsubscribe();
    }
  }

  

  loadProducts(): void {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.mergeProductInfo();
      },
      error: (err) => {
        console.error('Error loading products', err);
        this.errorMessage = 'Error loading products.';
      }
    });
  }

  private mergeProductInfo(): void {
    this.stock = this.stock.map(item => {
      const product = this.products.find(p => p.id === item.idProduit);
      return {
        ...item,
        qrCode: product?.qrCode || item.qrCode || null,
        imageUrl: product?.imageUrl || item.imageUrl || null,
        description: product?.description || item.description || null
      };
    });
    this.filteredStock = [...this.stock];
  }

  filterStock(): void {
    if (!this.searchTerm) {
      this.filteredStock = [...this.stock];
      return;
    }

    const searchTermLower = this.searchTerm.toLowerCase().trim();
    this.filteredStock = this.stock.filter(produit => {
      return (
        (produit.idProduit?.toLowerCase().includes(searchTermLower) || false) ||
        (produit.nomProduit?.toLowerCase().includes(searchTermLower) || false)
      );
    });
  }

  saveChanges(): void {
    if (!this.validateForm()) return;

    this.updating = true;
    const updateData = {
      nomProduit: this.selectedProduct.nomProduit?.trim() || '',
      quantite: this.selectedProduct.quantite || 0,
      prixUnitaireHT: this.selectedProduct.prixUnitaireHT || 0,
      prixDeVente: this.selectedProduct.prixDeVente || 0,
      dateMiseAJour: new Date().toISOString()
    };

    this.stockService.updateStock(this.selectedProduct.idProduit, updateData)
      .then(() => {
        this.loadStock();
        this.closeModal();
      })
      .catch((error: Error) => {
        console.error(error);
        this.errorMessage = `Error updating: ${error.message}`;
      })
      .finally(() => {
        this.updating = false;
      });
  }

  async deleteProduct(productId: string): Promise<void> {
    if (confirm('Are you sure you want to permanently delete this product?')) {
      try {
        await this.stockService.deleteProduct(productId);
        this.loadStock();
        this.errorMessage = null;
      } catch (error: unknown) {
        this.errorMessage = "Failed to delete product";
        console.error(error);
      }
    }
  }

  async quickEditQuantity(produit: StockItem): Promise<void> {
    const newQty = prompt(`Modify quantity for ${produit.nomProduit}:`, produit.quantite.toString());

    if (newQty !== null && !isNaN(Number(newQty))) {
      const quantity = Number(newQty);

      if (quantity < 0) {
        this.errorMessage = "Quantity cannot be negative";
        return;
      }

      try {
        await this.stockService.updateStock(produit.idProduit, {
          quantite: quantity,
          dateMiseAJour: new Date().toISOString()
        });
        this.loadStock();
      } catch (error: unknown) {
        this.errorMessage = "Update error";
        console.error(error);
      }
    }
  }

  private closeModal(): void {
    const modal = document.getElementById('editStockModal');
    if (modal) {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      const modalBackdrop = document.querySelector('.modal-backdrop');
      if (modalBackdrop) modalBackdrop.remove();
    }
  }

  showPriceHistory(produit: StockItem): void {
    if (produit.historiquePrix?.length) {
      const history = produit.historiquePrix
        .map(entry => `${this.formatDate(entry.date)}: ${entry.prix.toFixed(3)} DT`)
        .join('\n');
      alert(`Price history for ${produit.nomProduit}:\n\n${history}`);
    } else {
      alert('No price history available');
    }
  }

  private formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR');
  }

  startEditingPrice(produit: StockItem): void {
    produit.editingPrice = true;
    produit.originalPrice = produit.prixDeVente || 0;
  }

  cancelEditingPrice(produit: StockItem): void {
    produit.editingPrice = false;
    produit.prixDeVente = produit.originalPrice || 0;
  }

  async savePrice(produit: StockItem): Promise<void> {
    if ((produit.prixDeVente || 0) <= 0) {
      this.errorMessage = 'Price must be positive';
      return;
    }

    try {
      const priceUpdate = {
        date: new Date().toISOString(),
        prix: produit.prixDeVente,
        quantiteAjoutee: 0
      };

      await this.stockService.updateStock(produit.idProduit, {
        prixDeVente: produit.prixDeVente,
        dateMiseAJour: new Date().toISOString(),
        historiquePrix: [...(produit.historiquePrix || []), priceUpdate]
      });

      produit.editingPrice = false;
      this.loadStock();
    } catch (error) {
      this.errorMessage = 'Update error';
    }
  }

  private validateForm(): boolean {
    if ((this.selectedProduct.quantite || 0) < 0) {
      this.errorMessage = 'Quantity cannot be negative';
      return false;
    }

    if ((this.selectedProduct.prixUnitaireHT || 0) <= 0) {
      this.errorMessage = 'Unit price must be positive';
      return false;
    }

    if ((this.selectedProduct.prixDeVente || 0) <= 0) {
      this.errorMessage = 'Sale price must be positive';
      return false;
    }

    if (!this.selectedProduct.nomProduit?.trim()) {
      this.errorMessage = 'Product name is required';
      return false;
    }

    this.errorMessage = null;
    return true;
  }

  createEmptyProduct(): StockItem {
    return {
      idProduit: '',
      nomProduit: '',
      quantite: 0,
      prixUnitaireHT: 0,
      prixDeVente: 0,
      dateMiseAJour: '',
      editingPrice: false,
      originalPrice: 0,
      seuil: 10,
      qrCode: null,
      imageUrl: null,
      description: null,
      status: 'active'
    };
  }

  isPromotionActive(product: StockItem): boolean {
    if (!product.promotion || typeof product.promotion === 'boolean') return false;

    const now = new Date();
    const start = new Date(product.promotion.startDate);
    const end = new Date(product.promotion.endDate);

    return now >= start && now <= end;
  }

  calculateDiscountedPrice(product: StockItem): number {
    if (!this.isPromotionActive(product)) return product.prixDeVente;

    const discount = product.promotion?.discountPercentage || 0;
    return product.prixDeVente * (1 - discount / 100);
  }

  calculateTotalValue(unitPrice: number, quantity: number): number {
    return unitPrice * quantity;
  }

  private checkExpiredPromotions(): void {
    this.stock.forEach(product => {
      if (product.status === 'promotion' && product.promotion && !this.isPromotionActive(product)) {
        this.stockService.updateStock(product.idProduit, {
          status: 'active',
          promotion: undefined
        }).catch(err => console.error('Error updating promotion status', err));
      }
    });
  }

  async updateStockQuantity(productId: string, delta: number): Promise<void> {
    const ref = this.db.object<StockItem>(`${this.stockPath}/${productId}`);
    const snapshot = await firstValueFrom(ref.valueChanges());

    if (!snapshot) throw new Error(`Product ${productId} not found`);

    const newQuantity = snapshot.quantite + delta;
    if (newQuantity < 0) throw new Error('Insufficient stock');

    const newStatus = newQuantity === 0 ? 'out-of-stock' : snapshot.status === 'out-of-stock' ? 'active' : snapshot.status;

    await ref.update({
      quantite: newQuantity,
      status: newStatus,
      dateMiseAJour: new Date().toISOString()
    });

    this.checkStockLevels(productId, newQuantity);
  }




  private checkStockLevels(productId: string, newQuantity: number): void {
    this.db.object<StockItem>(`${this.stockPath}/${productId}`).valueChanges()
      .pipe(take(1))
      .subscribe(product => {
        if (product && newQuantity <= (product.seuil || 10)) {
          this.createOutOfStockNotification(product);
        }
      });
  }

  private async createOutOfStockNotification(product: StockItem): Promise<void> {
    const notification = {
      type: 'stock-out',
      productId: product.idProduit,
      productName: product.nomProduit,
      message: `Out of stock - ${product.nomProduit}`,
      timestamp: new Date().toISOString(),
      read: false,
      priority: 'high'
    };

    await this.db.list('/notifications').push(notification);
  }

getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'green';
    case 'promotion':
      return 'orange';
    case 'out-of-stock':
      return 'red';
    default:
      return 'gray';
  }
}
    
  getStatusLabel(status: string): string {
    const statusMap: {[key: string]: string} = {
      'active': 'Actif',
      'inactive': 'Inactif',
      'promotion': 'Promo',
      'out-of-stock': 'Rupture'
    };
    return statusMap[status] || status;
  }

  getStatusIcon(status: string): string {
    const iconMap: {[key: string]: string} = {
      'active': 'fas fa-check-circle',
      'inactive': 'fas fa-times-circle',
      'promotion': 'fas fa-tag',
      'out-of-stock': 'fas fa-exclamation-triangle'
    };
    return iconMap[status] || 'fas fa-info-circle';
  }

loadStock(): void {
  this.loading = true;
  combineLatest([
    this.stockService.getStock(),
    this.productService.getProducts()
  ]).subscribe({
    next: ([stock, products]) => {
      this.stock = stock.map(item => {
        const product = products.find(p => p.id === item.idProduit);
        const seuil = item.seuil || 10; // Seuil par défaut
        
        // Calcul du statut basé sur la quantité et le seuil
        const status = item.quantite <= seuil ? 'out-of-stock' : 
                      item.status === 'promotion' && this.isPromotionActive(item) ? 'promotion' :
                      'active';

        return {
          ...item,
          status,
          promotion: product?.promotion || item.promotion || undefined,
          editingPrice: false,
          originalPrice: item.prixDeVente || 0,
          qrCode: item.qrCode || product?.qrCode || null,
          imageUrl: item.imageUrl || product?.imageUrl || null,
          description: item.description || product?.description || null,
          seuil: item.seuil || 10 // Seuil par défaut
        };
      });
      this.filteredStock = [...this.stock];
      this.loading = false;
    },
    error: (err) => {
      this.errorMessage = 'Erreur lors du chargement du stock';
      this.loading = false;
      console.error(err);
    }
  });
}

private async syncStockStatus(): Promise<void> {
  try {
    const stock = await firstValueFrom(this.stockService.getStock());
    
    const updates = stock.map(async (item: StockItem) => {
      const seuil = item.seuil || 10; // Seuil par défaut à 10
      const newStatus = item.quantite <= seuil ? 'out-of-stock' : 
                       item.status === 'out-of-stock' ? 'active' : item.status;

      if (newStatus !== item.status) {
        await this.stockService.updateStock(item.idProduit, { status: newStatus });
      }
    });

    await Promise.all(updates);
  } catch (error) {
    console.error('Error syncing status:', error);
  }
}

//qrcode 
getProductQrCode(productId: string): string | null {
  const product = this.products.find(p => p.id === productId);
  return product?.qrCodeImage || null;
}
}