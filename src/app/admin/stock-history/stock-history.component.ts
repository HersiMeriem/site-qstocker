import { Component, OnInit } from '@angular/core';
import { StockService } from '../../services/stock.service';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';

@Component({
  selector: 'app-stock-history',
  templateUrl: './stock-history.component.html',
  styleUrls: ['./stock-history.component.css']
})
export class StockHistoryComponent implements OnInit {
  stockHistory: any[] = [];
  currentStock: any[] = [];
  combinedData: any[] = [];
  filteredData: any[] = [];
  loading = true;
  errorMessage: string | null = null;
  searchTerm = '';
  products: Product[] = [];

  constructor(
    private stockService: StockService,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    this.loadStockAndHistory();
    this.loadProducts();
  }

  loadProducts(): void {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.mergeProductInfo();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des produits', err);
      }
    });
  }

  private mergeProductInfo(): void {
    this.combinedData = this.combinedData.map(item => {
      const product = this.products.find(p => p.id === item.idProduit);
      return {
        ...item,
        qrCode: product?.qrCode || null,
        imageUrl: product?.imageUrl || null
      };
    });
    this.filteredData = [...this.combinedData];
  }

  loadStockAndHistory(): void {
    this.loading = true;
    
    this.stockService.getStockMovements().subscribe({
      next: (history) => {
        this.stockHistory = history.map(item => ({
          idProduit: item.productId || '-',
          nomProduit: item.productName,
          quantite: item.quantity,
          prixUnitaireHT: null,
          prixDeVente: null,
          valeurTotale: null,
          dateMiseAJour: item.date,
          type: 'history',
          qrCode: null,
          imageUrl: null
        }));
        this.combineData();
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement de l\'historique';
        this.loading = false;
        console.error(err);
      }
    });

    this.stockService.getStock().subscribe({
      next: (stock) => {
        this.currentStock = stock.map(item => ({
          idProduit: item.idProduit || '-',
          nomProduit: item.nomProduit,
          quantite: item.quantite,
          prixUnitaireHT: item.prixUnitaireHT,
          prixDeVente: item.prixDeVente,
          valeurTotale: item.prixUnitaireHT * item.quantite,
          dateMiseAJour: item.dateMiseAJour,
          type: 'stock',
          qrCode: item.qrCode || null,
          imageUrl: item.imageUrl || null
        }));
        this.combineData();
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement du stock actuel';
        this.loading = false;
        console.error(err);
      }
    });
  }

  combineData(): void {
    if (this.stockHistory && this.currentStock) {
      const combinedMap = new Map<string, any>();
      
      this.stockHistory.forEach(record => {
        const key = record.idProduit;
        if (!combinedMap.has(key)) {
          combinedMap.set(key, record);
        }
      });

      this.currentStock.forEach(record => {
        const key = record.idProduit;
        combinedMap.set(key, record);
      });

      this.combinedData = Array.from(combinedMap.values())
        .sort((a, b) => new Date(b.dateMiseAJour).getTime() - new Date(a.dateMiseAJour).getTime());
      
      this.filteredData = [...this.combinedData];
      this.loading = false;
    }
  }

  filterStock(): void {
    if (!this.searchTerm) {
      this.filteredData = [...this.combinedData];
      return;
    }

    const searchTermLower = this.searchTerm.toLowerCase().trim();
    this.filteredData = this.combinedData.filter(produit => {
      return (
        (produit.idProduit?.toLowerCase().includes(searchTermLower) || false) ||
        (produit.nomProduit?.toLowerCase().includes(searchTermLower) || false)
      );
    });
  }
}