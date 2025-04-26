import { Component, OnInit, OnDestroy } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { SnapshotAction } from '@angular/fire/compat/database';
import { StockService } from 'src/app/services/stock.service';
import { combineLatest, Subject } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { Router } from '@angular/router';


@Component({
  selector: 'app-product-management',
  templateUrl: './product-management.component.html',
  styleUrls: ['./product-management.component.css']
})
export class ProductManagementComponent implements OnInit, OnDestroy {
  products: any[] = [];
  filteredProducts: any[] = [];
  searchQuery: string = '';
  loading: boolean = true;
  selectedCategory: string = '';
selectedType: string = '';
  private destroy$ = new Subject<void>();

  constructor(
    private db: AngularFireDatabase,
    private stockService: StockService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadProducts();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

    // Nouvelle méthode pour naviguer vers la gestion du stock
    goToStock() {
      this.router.navigate(['/admin/stock-history']);
    }
  
    // Nouvelle méthode pour naviguer vers la gestion des ventes
    goToSales() {
      this.router.navigate(['/admin/ventes']);
    }
  getUniqueCategories(): string[] {
    return [...new Set(this.products.map(p => p.category))].filter(c => c);
  }
  
  getUniqueTypes(): string[] {
    return [...new Set(this.products.map(p => p.type))].filter(t => t);
  }
  
  filterByCategory(): void {
    if (!this.selectedCategory) {
      this.filteredProducts = [...this.products];
    } else {
      this.filteredProducts = this.products.filter(
        p => p.category === this.selectedCategory
      );
    }
  }
  
  filterByType(): void {
    if (!this.selectedType) {
      this.filteredProducts = [...this.products];
    } else {
      this.filteredProducts = this.products.filter(
        p => p.type === this.selectedType
      );
    }
  }

  loadProducts() {
    combineLatest([
      this.db.list('products').snapshotChanges(),
      this.stockService.getStock()
    ]).pipe(
      takeUntil(this.destroy$),
      map(([products, stockItems]) => {
        return products.map(product => {
          const productData = product.payload.val() as any;
          const stockItem = stockItems.find(item => item.idProduit === product.key);
          
          // Fusion des données produit et stock
          return {
            id: product.key,
            ...productData,
            ...(stockItem || {}),
            nomProduit: stockItem?.nomProduit || productData.name,
            quantite: stockItem?.quantite || productData.quantity,
            prixDeVente: stockItem?.prixDeVente || productData.price
          };
        });
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

  applySearch() {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredProducts = [...this.products];
      return;
    }

    this.filteredProducts = this.products.filter(product => {
      return (
        (product.nomProduit?.toLowerCase().includes(query) || 
         product.name?.toLowerCase().includes(query)) ||
        (product.type?.toLowerCase().includes(query)) ||
        (product.category?.toLowerCase().includes(query)) ||
        (product.id?.toLowerCase().includes(query)));
    });
  }

  getStatusLabel(status: string): string {
    const statusMap: {[key: string]: string} = {
      'active': 'Actif',
      'inactive': 'Inactif',
      'critical': 'Critique',
      'normal': 'Normal',
      'promotion': 'En promotion'
    };
    return statusMap[status] || status;
  }

  viewDetails(product: any) {
    this.router.navigate(['/admin/details-products', product.id]);
  }

  markAsCritical(productId: string) {
    this.db.object(`products/${productId}/status`).set('critical').then(() => {
      alert("✅ Produit marqué comme critique !");
      this.loadProducts(); // Rafraîchir la liste
    }).catch(error => {
      console.error('Erreur:', error);
      alert(`❌ Erreur: ${error.message}`);
    });
  }

  
}