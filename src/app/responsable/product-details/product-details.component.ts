import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { StockService } from '../../services/stock.service';
import { Product } from '../../models/product';
import { StockItem } from '../../services/stock.service';

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.css']
})
export class ProductDetailsComponent implements OnInit {
  product: Product | null = null;
  realStockQuantity: number | null = null;
  qrCodeUrl: string | null = null;
  loading = true;
  stockLoading = true;
  error: string | null = null;
  stockItem: StockItem | null = null;
  qrCodeService: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
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

  private loadProductAndStock(productId: string): void {
    this.productService.getProductById(productId).subscribe({
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
    this.stockService.getProduct(productId).subscribe({
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
    if (this.product?.qrCodeImage) {
      this.qrCodeUrl = this.product.qrCodeImage;
      return;
    }

    this.qrCodeService.generateQRCodeImage(productId).subscribe({
      next: (qrCodeImage) => {
        this.qrCodeUrl = qrCodeImage;
      },
      error: (err) => {
        console.error('Erreur lors du chargement du QR code:', err);
        this.qrCodeUrl = null;
      }
    });
  }

  deleteProduct(productId: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      this.productService.deleteProduct(productId)
        .then(() => {
          this.router.navigate(['/responsable/product-list'], {
            state: { successMessage: 'Produit supprimé avec succès' }
          });
        })
        .catch((error) => {
          console.error('Erreur:', error);
          this.error = 'Échec de la suppression du produit';
        });
    }
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
      'promotion': 'En promotion',
      'out-of-stock': 'Rupture'
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
      return this.stockItem?.prixUnitaireHT || 0;
    }
    const discount = this.product.promotion?.discountPercentage || 0;
    return this.stockItem.prixUnitaireHT * (1 - discount / 100);
  }

  calculateSavings(): number {
    if (!this.stockItem?.prixUnitaireHT) return 0;
    return this.stockItem.prixUnitaireHT - this.calculateDiscountedPrice();
  }
}
