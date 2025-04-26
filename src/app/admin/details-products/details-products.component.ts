import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { StockService } from 'src/app/services/stock.service';
import { Location } from '@angular/common';
import { takeUntil, switchMap } from 'rxjs/operators';
import { Subject, combineLatest, of } from 'rxjs';

@Component({
  selector: 'app-details-products',
  templateUrl: './details-products.component.html',
  styleUrls: ['./details-products.component.css']
})
export class DetailsProductsComponent implements OnInit, OnDestroy {
  product: any = null;
  loading: boolean = true;
  error: string | null = null;
  realStockQuantity: number | null = null;
  stockLoading: boolean = true;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private db: AngularFireDatabase,
    private stockService: StockService,
    private location: Location
  ) {}

  ngOnInit(): void {
    const productId = this.route.snapshot.paramMap.get('id');
    if (productId) {
      this.loadProductDetails(productId);
    } else {
      this.error = 'Aucun ID de produit fourni';
      this.loading = false;
    }
  }

  loadProductDetails(productId: string): void {
    // Récupération des données du produit
    const product$ = this.db.object(`products/${productId}`).valueChanges();
    
    // Récupération des données de stock
    const stock$ = this.stockService.getStock();

    combineLatest([product$, stock$])
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: ([productData, stockItems]) => {
          if (!productData) {
            this.error = 'Produit non trouvé';
            this.loading = false;
            return;
          }

          const stockItem = stockItems.find((item: any) => item.idProduit === productId);
          
          // Fusion des données
          this.product = {
            id: productId,
            ...(productData as object),
            ...(stockItem || {}),
            nomProduit: stockItem?.nomProduit || (productData as any).name,
            stockQuantity: stockItem?.quantite || (productData as any).quantity,
            unitPrice: stockItem?.prixDeVente || (productData as any).price
          };

          this.realStockQuantity = this.product.stockQuantity;
          this.loading = false;
          this.stockLoading = false;
        },
        error: (err) => {
          console.error('Erreur lors du chargement:', err);
          this.error = 'Erreur lors du chargement des détails du produit';
          this.loading = false;
          this.stockLoading = false;
        }
      });
  }

  goBack(): void {
    this.location.back();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

    /* Ajoutez cette fonction dans votre composant TypeScript */
    getStatusLabel(status: string): string {
      const statusMap: {[key: string]: string} = {
        'active': 'Actif',
        'inactive': 'Inactif',
        'pending': 'En attente',
        'promo': 'En promotion',
        'soldout': 'Épuisé'
      };
      return statusMap[status] || status;
    }
}