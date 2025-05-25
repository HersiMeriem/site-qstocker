// details-products.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { StockService } from '../../services/stock.service';
import { Product } from '../../models/product';
import { StockItem } from '../../services/stock.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-details-products',
  templateUrl: './details-products.component.html',
  styleUrls: ['./details-products.component.css']
})
export class DetailsProductsComponent implements OnInit, OnDestroy {
  product: Product | null = null;
  realStockQuantity: number | null = null;
  qrCodeUrl: string | null = null;
  loading = true;
  stockLoading = true;
  error: string | null = null;
  stockItem: StockItem | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private productService: ProductService,
    private stockService: StockService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.loadProductAndStock(id);
    } else {
      this.error = 'ID de produit non fourni';
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProductAndStock(productId: string): void {
    this.productService.getProductById(productId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (product) => {
          this.product = product;
          if (product) {
            this.loadStockData(productId);
            this.loadQrCode(productId);
          } else {
            this.error = 'Produit non trouvé';
            this.loading = false;
          }
        },
        error: (err) => this.handleError(err)
      });
  }

  private loadStockData(productId: string): void {
    this.stockLoading = true;
    this.stockService.getProduct(productId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stockItem: StockItem | null) => {
          this.stockItem = stockItem;
          if (stockItem) {
            this.realStockQuantity = stockItem.quantite;
          } else {
            console.warn('Aucune donnée de stock trouvée pour ce produit');
            this.realStockQuantity = null;
          }
          this.stockLoading = false;
          this.loading = false;
        },
        error: (err) => {
          console.error('Erreur lors du chargement du stock:', err);
          this.realStockQuantity = null;
          this.stockLoading = false;
          this.loading = false;
        }
      });
  }

  private loadQrCode(productId: string): void {
    if (this.product?.qrCode) {
      this.qrCodeUrl = this.product.qrCode;
      return;
    }

    this.stockService.getProduct(productId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stockItem) => {
          this.qrCodeUrl = stockItem?.qrCode || null;
        },
        error: (err) => {
          console.error('Erreur lors du chargement du QR code:', err);
          this.qrCodeUrl = null;
        }
      });
  }

  goBack(): void {
    this.location.back();
  }

  private handleError(error: any): void {
    this.error = 'Erreur lors du chargement du produit';
    this.loading = false;
    this.stockLoading = false;
    console.error('Erreur détaillée:', error);
  }

  getStatusLabel(status: string): string {
    const statusMap: {[key: string]: string} = {
      'active': 'Actif',
      'inactive': 'Inactif',
      'promotion': 'En promotion'
    };
    return statusMap[status] || status;
  }

  isPromotionActive(): boolean {
    if (!this.product || this.product.status !== 'promotion' || !this.product.promotion) return false;

    const now = new Date();
    const start = new Date(this.product.promotion.startDate);
    const end = new Date(this.product.promotion.endDate);

    return now >= start && now <= end;
  }

  calculateDiscountedPrice(): number {
    if (!this.stockItem || !this.product || !this.isPromotionActive()) {
      return this.stockItem?.prixDeVente || 0;
    }
    const discount = this.product.promotion?.discountPercentage || 0;
    return this.stockItem.prixDeVente * (1 - discount / 100);
  }

  calculateSavings(): number {
    if (!this.stockItem?.prixDeVente) return 0;
    return this.stockItem.prixDeVente - this.calculateDiscountedPrice();
  }
}