import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { StockItem, StockService } from 'src/app/services/stock.service';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { PromotionDialogComponent } from '../promotion-dialog/promotion-dialog.component';
import { SelectionModel } from '@angular/cdk/collections';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';
import { ProductAddComponent } from '../product-add/product-add.component';
import { ProductDetailsComponent } from '../product-details/product-details.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { BarcodeFormat } from '@zxing/library';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css'],
})
export class ProductListComponent implements OnInit, OnDestroy {
  @ViewChild(ZXingScannerComponent, { static: false }) scanner!: ZXingScannerComponent;
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm: string = '';
  loading: boolean = true;
  selectedCategory: string = '';
  selectedType: string = '';
  categories: string[] = [];
  types: string[] = [];
  selection = new SelectionModel<Product>(true, []);
  isPromotionDialogOpen = false;
  devices$: BehaviorSubject<MediaDeviceInfo[]> = new BehaviorSubject<MediaDeviceInfo[]>([]);
  scannerActive = false;
  hasPermission = false;
  currentDevice: MediaDeviceInfo | undefined;
  supportedFormats = [BarcodeFormat.QR_CODE];
  scanMode: 'add' | 'edit' | 'delete' | 'view' | null = null;
  availableDevices: MediaDeviceInfo[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private productService: ProductService,
    private router: Router,
    private stockService: StockService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.checkCameraPermissions();

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const navigation = this.router.getCurrentNavigation();
        const state = navigation?.extras.state as {
          shouldRefresh?: boolean;
          successMessage?: string;
        };

        if (state?.successMessage) {
          alert(state.successMessage);
        }

        if (state?.shouldRefresh) {
          this.loadProducts();
        }
      }
    });
  }

  private extractFilters(products: Product[]): void {
    this.categories = [...new Set(products.map(p => p.category))].filter(c => c);
    this.types = [...new Set(products.map(p => p.type))].filter(t => t);
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

  filterProducts(): void {
    const searchLower = this.searchTerm.toLowerCase().trim();

    this.filteredProducts = this.products.filter(product => {
      const matchesSearch =
        product.name?.toLowerCase().includes(searchLower) ||
        product.id?.toLowerCase().includes(searchLower) ||
        product.type?.toLowerCase().includes(searchLower) ||
        product.category?.toLowerCase().includes(searchLower);

      const matchesCategory = !this.selectedCategory ||
        product.category === this.selectedCategory;

      const matchesType = !this.selectedType ||
        product.type === this.selectedType;

      return matchesSearch && matchesCategory && matchesType;
    });
  }

  viewDetails(id: string): void {
    this.router.navigate(['responsable', 'product-details', id]).then(success => {
      if (!success) {
        console.error('Échec de navigation - Vérifiez la configuration des routes');
        window.location.assign(`/responsable/product-details/${id}`);
      }
    });
  }

  editProduct(id: string): void {
    this.router.navigate(['/responsable/edit-product', id]);
  }

  deleteProduct(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      this.productService.deleteProduct(id)
        .then(() => {
          this.loadProducts();
        })
        .catch(error => {
          console.error('Erreur:', error);
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isPromotionActive(product: Product): boolean {
    if (product.status !== 'promotion' || !product.promotion) return false;
    const now = new Date();
    const start = new Date(product.promotion.startDate);
    const end = new Date(product.promotion.endDate);
    return now >= start && now <= end;
  }

  calculateDiscountedPrice(product: Product): number {
    if (!product || !this.isPromotionActive(product)) return product?.unitPrice || 0;
    const discount = product.promotion?.discountPercentage || 0;
    return product.unitPrice * (1 - discount / 100);
  }

  private applyPromotion(product: Product, promoData: any): void {
    const updatedProduct: Product = {
      ...product,
      status: 'promotion',
      promotion: {
        discountPercentage: promoData.discount,
        startDate: promoData.startDate.toISOString(),
        endDate: promoData.endDate.toISOString()
      },
      postPromoStatus: promoData.postPromoStatus
    };

    this.productService.updateProduct(product.id, updatedProduct)
      .then(() => this.scheduleStatusUpdate(product, promoData))
      .catch(error => console.error(error));
  }

  private scheduleStatusUpdate(product: Product, promoData: any): void {
    const endDate = new Date(promoData.endDate);
    const now = new Date().getTime();
    const delay = endDate.getTime() - now;

    if (delay > 0) {
      setTimeout(() => {
        const updatedProduct: Product = {
          ...product,
          status: promoData.postPromoStatus,
          promotion: undefined
        };
        this.productService.updateProduct(product.id, updatedProduct);
      }, delay);
    }
  }

  openPromotionDialog(): void {
    if (this.selection.isEmpty()) {
      this.snackBar.open('Sélectionnez au moins un produit pour appliquer une promotion', 'Fermer', {
        duration: 4000,
        panelClass: 'error-snackbar'
      });
      return;
    }

    this.isPromotionDialogOpen = true;

    const dialogRef = this.dialog.open(PromotionDialogComponent, {
      width: '600px',
      panelClass: 'modern-dialog',
      data: {
        products: this.selection.selected,
        defaultDiscount: 10,
        defaultStartDate: new Date(),
        defaultEndDate: new Date(new Date().setDate(new Date().getDate() + 7)),
        defaultStatus: 'active'
      }
    });

    dialogRef.afterClosed().subscribe((result: {
      discount: number,
      startDate: Date,
      endDate: Date,
      postPromoStatus: 'active' | 'inactive'
    }) => {
      this.isPromotionDialogOpen = false;

      if (result) {
        this.applyPromotionToSelectedProducts(result);
      }
    });
  }

  private applyPromotionToSelectedProducts(promoData: {
    discount: number,
    startDate: Date,
    endDate: Date,
    postPromoStatus: 'active' | 'inactive'
  }): void {
    const promises = this.selection.selected.map(product => {
      const updatedProduct: Product = {
        ...product,
        status: 'promotion',
        promotion: {
          discountPercentage: promoData.discount,
          startDate: promoData.startDate.toISOString(),
          endDate: promoData.endDate.toISOString()
        },
        postPromoStatus: promoData.postPromoStatus
      };

      return this.productService.updateProduct(product.id, updatedProduct)
        .then(() => {
          this.schedulePostPromotionStatus(product, promoData);
          return product;
        });
    });

    Promise.all(promises)
      .then(products => {
        this.showSuccessMessage(`${products.length} produits mis en promotion`);
        this.selection.clear();
        this.loadProducts();
      })
      .catch(error => {
        console.error('Erreur lors de la mise en promotion', error);
        this.showErrorMessage('Une erreur est survenue');
      });
  }

  private schedulePostPromotionStatus(product: Product, promoData: {
    endDate: Date,
    postPromoStatus: 'active' | 'inactive'
  }): void {
    const endDate = new Date(promoData.endDate);
    const now = new Date();
    const delay = endDate.getTime() - now.getTime();

    if (delay > 0) {
      setTimeout(() => {
        const updatedProduct: Product = {
          ...product,
          status: promoData.postPromoStatus,
          promotion: undefined
        };

        this.productService.updateProduct(product.id, updatedProduct)
          .then(() => {
            console.log(`Statut post-promo appliqué à ${product.name}`);
            this.loadProducts();
          })
          .catch(error => {
            console.error('Erreur mise à jour statut post-promo', error);
          });
      }, delay);
    }
  }

  private showSuccessMessage(message: string): void {
    console.log('Succès:', message);
    alert(message);
  }

  private showErrorMessage(message: string): void {
    console.error('Erreur:', message);
    alert(message);
  }

  isAllSelected(): boolean {
    return this.selection.selected.length === this.filteredProducts.length;
  }

  toggleAll(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.filteredProducts.forEach(product => this.selection.select(product));
    }
  }

  get selectedCount(): number {
    return this.selection.selected.length;
  }

  async checkCameraPermissions(): Promise<void> {
    try {
      if (!this.scanner) {
        console.warn('Scanner component not initialized');
        return;
      }

      this.scanner.camerasFound.subscribe((devices: MediaDeviceInfo[]) => {
        this.availableDevices = devices;
        this.devices$.next(devices);
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

  toggleScanner(): void {
    this.scannerActive = !this.scannerActive;
    if (this.scannerActive) {
      this.checkCameraPermissions();
    }
  }

  onCamerasFound(devices: MediaDeviceInfo[]): void {
    this.availableDevices = devices;
    this.hasPermission = true;
    if (devices.length > 0) {
      this.currentDevice = devices[0];
    }
  }

  onCamerasNotFound(): void {
    console.warn('No cameras found');
    this.hasPermission = false;
  }

  onHasPermission(perm: boolean): void {
    this.hasPermission = perm;
  }

  onDeviceSelectChange(deviceId: string): void {
    this.currentDevice = this.availableDevices.find(device => device.deviceId === deviceId);
  }

  private extractProductId(data: string): string | null {
    try {
      const parsed = JSON.parse(data);
      return parsed.id || null;
    } catch {
      return data.startsWith('PRD-') ? data : null;
    }
  }

  onScanSuccess(result: string): void {
    this.scannerActive = false;

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

  private parseScannedData(data: string): { id: string; [key: string]: any } {
    try {
      return JSON.parse(data);
    } catch {
      return { id: data };
    }
  }

  private lookupProduct(productId: string): void {
    this.productService.getProductById(productId).subscribe({
      next: (product) => {
        if (product) {
          this.selection.clear();
          this.selection.select(product);
          this.snackBar.open(`Produit ${product.name} sélectionné`, 'Fermer', {
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

  onScanError(error: any): void {
    console.error('Scan error:', error);
    this.snackBar.open('Erreur de scan - Vérifiez les permissions de la caméra', 'Fermer', {
      duration: 5000,
      panelClass: 'error-snackbar'
    });
  }

private loadProducts(): void {
  combineLatest([
    this.productService.getProducts(),
    this.stockService.getStock()
  ]).pipe(
    takeUntil(this.destroy$),
    map(([products, stockItems]) => {
      const enrichedProducts = products.map(product => {
        const stockItem = stockItems.find(item => item.idProduit === product.id);
        const stockQuantity = stockItem ? stockItem.quantite : 0;
        
        // Mettre à jour le statut si la quantité est 0
        const status = stockQuantity <= 0 ? 'out-of-stock' : product.status;

        return {
          ...product,
          stockQuantity,
          unitPrice: stockItem ? stockItem.prixDeVente : 0,
          status // Mise à jour du statut
        };
      });

      this.extractFilters(enrichedProducts);
      return enrichedProducts;
    })
    ).subscribe({
      next: (products) => {
        this.products = products;
        this.filteredProducts = [...products];
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur de chargement:', error);
        this.loading = false;
      }
    });
  }



}
