import { Component, OnInit, OnDestroy } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { StockService } from 'src/app/services/stock.service';
import { Subject, combineLatest } from 'rxjs';
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
  selectedCategory: string = '';
  selectedStatus: string = '';
  categories: string[] = [];
  loading: boolean = true;
  private destroy$ = new Subject<void>();

  constructor(
    private productService: ProductService,
    private stockService: StockService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProducts(): void {
    combineLatest([
      this.productService.getProducts(),
      this.stockService.getStock()
    ]).pipe(
      takeUntil(this.destroy$),
      map(([products, stockItems]) => {
        return products.map(product => {
          const stockItem = stockItems.find(item => item.idProduit === product.id);
          return {
            ...product,
            unitPrice: stockItem ? stockItem.prixDeVente : 0,
            stockQuantity: stockItem ? stockItem.quantite : 0
          };
        });
      })
    ).subscribe({
      next: (products) => {
        this.products = products;
        this.filteredProducts = [...products];
        this.extractCategories();
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur de chargement:', error);
        this.loading = false;
      }
    });
  }

  private extractCategories(): void {
    this.categories = [...new Set(this.products.map(p => p.category))].filter(c => c);
  }

  applySearch(): void {
    const query = this.searchQuery.toLowerCase().trim();
    
    this.filteredProducts = this.products.filter(product => {
      const matchesSearch = 
        product.name?.toLowerCase().includes(query) ||
        product.id?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query);
      
      const matchesCategory = !this.selectedCategory || 
        product.category === this.selectedCategory;
      
      const matchesStatus = !this.selectedStatus || 
        product.status === this.selectedStatus;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }

  filterProducts(): void {
    this.applySearch();
  }

  viewDetails(productId: string): void {
    this.router.navigate(['/admin/details-products', productId]);
  }

  isPromotionActive(product: any): boolean {
    if (!product.promotion) return false;
    const now = new Date();
    const start = new Date(product.promotion.startDate);
    const end = new Date(product.promotion.endDate);
    return now >= start && now <= end;
  }

  calculateDiscountedPrice(product: any): number {
    if (!this.isPromotionActive(product)) return product.unitPrice;
    const discount = product.promotion?.discountPercentage || 0;
    return product.unitPrice * (1 - discount / 100);
  }

      // Nouvelle méthode pour naviguer vers la gestion du stock
    goToStock() {
      this.router.navigate(['/admin/stock-history']);
    }
  
    // Nouvelle méthode pour naviguer vers la gestion des ventes
    goToSales() {
      this.router.navigate(['/admin/ventes']);
    }
}