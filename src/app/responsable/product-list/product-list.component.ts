import { Component, OnInit, OnDestroy } from '@angular/core';
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

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css'],
})
export class ProductListComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm: string = '';
  loading: boolean = true;
  selectedCategory: string = '';
  selectedType: string = '';
  categories: string[] = [];
  types: string[] = [];
  selection = new SelectionModel<Product>(true, []); // Pour la sélection multiple
  isPromotionDialogOpen = false;
  private destroy$ = new Subject<void>();

  constructor(
    private productService: ProductService,
    private router: Router,
    private stockService: StockService,
    private dialog: MatDialog ,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    
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
  
  private loadProducts(): void {
    combineLatest([
      this.productService.getProducts(),
      this.stockService.getStock()
    ]).pipe(
      takeUntil(this.destroy$),
      map(([products, stockItems]) => {
        const enrichedProducts = products.map(product => {
          const stockItem = stockItems.find(item => item.idProduit === product.id);
          return {
            ...product,
            stockQuantity: stockItem ? stockItem.quantite : 0,
            unitPrice: stockItem ? stockItem.prixUnitaireHT : 0 // Ajout du prix unitaire
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

  private extractFilters(products: Product[]): void {
    this.categories = [...new Set(products.map(p => p.category))].filter(c => c);
    this.types = [...new Set(products.map(p => p.type))].filter(t => t);
  }

  getStatusLabel(status: string): string {
    const statusMap: {[key: string]: string} = {
      'active': 'Actif',
      'inactive': 'Inactif',
      'promotion': 'En promotion'
    };
    return statusMap[status] || status;
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
  //promotion 
isPromotionActive(product: Product): boolean {
  if (product.status !== 'promotion' || !product.promotion) return false;
  const now = new Date();
  const start = new Date(product.promotion.startDate);
  const end = new Date(product.promotion.endDate);
  return now >= start && now <= end;
}

calculateDiscountedPrice(product: Product): number {
  if (!this.isPromotionActive(product)) return product.unitPrice;
  return product.unitPrice * (1 - (product.promotion?.discountPercentage || 0) / 100);
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
  }}
 
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
        this.selection.clear(); // Désélectionne les produits
        this.loadProducts(); // Rafraîchit la liste
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
    // Implémentez votre système de notification
    console.log('Succès:', message);
    alert(message); // Remplacez par un toast/snackbar
  }

  private showErrorMessage(message: string): void {
    console.error('Erreur:', message);
    alert(message); // Remplacez par un toast/snackbar
  }

  // Méthodes pour la sélection multiple
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

}