import { Component, OnInit } from '@angular/core';
import { StockService } from '../../services/stock.service';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { SupplierService } from '../../services/supplier.service';
import { MatDialog } from '@angular/material/dialog';
import { SupplierDialogComponent } from 'src/app/responsable/supplier-dialog/supplier-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Supplier } from '../../models/supplier';

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

  showSuppliers = false;
  suppliers: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  suppliersLoading = false;
  supplierSearchTerm = '';

  constructor(
    private stockService: StockService,
    private productService: ProductService,
    private supplierService: SupplierService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadStockAndHistory();
    this.loadProducts();
  }

  toggleSuppliersView(): void {
    this.showSuppliers = !this.showSuppliers;
    if (this.showSuppliers && this.suppliers.length === 0) {
      this.loadSuppliers();
    }
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
        qrCodeImage: product?.qrCodeImage || null,
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
          qrCodeImage: null,
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
          qrCodeImage: null,
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

  private combineData(): void {
    if (this.stockHistory && this.currentStock) {
      const combinedMap = new Map<string, any>();

      this.currentStock.forEach(record => {
        const product = this.products.find(p => p.id === record.idProduit);
        combinedMap.set(record.idProduit, {
          ...record,
          nomProduit: product?.name || record.nomProduit,
          qrCodeImage: product?.qrCodeImage || record.qrCodeImage,
          imageUrl: product?.imageUrl || record.imageUrl,
          description: product?.description,
          status: record.status || 'active',
          promotion: product?.promotion,
          isAuthentic: product?.isAuthentic
        });
      });

      this.stockHistory.forEach(record => {
        if (!combinedMap.has(record.idProduit)) {
          const product = this.products.find(p => p.id === record.idProduit);
          combinedMap.set(record.idProduit, {
            ...record,
            nomProduit: product?.name || record.nomProduit,
            qrCodeImage: product?.qrCodeImage,
            imageUrl: product?.imageUrl,
            description: product?.description,
            status: 'historic',
            isAuthentic: product?.isAuthentic
          });
        }
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

  // Méthodes pour les fournisseurs
  loadSuppliers(): void {
    this.suppliersLoading = true;
    this.supplierService.getAll().subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers;
        this.filteredSuppliers = [...suppliers];
        this.suppliersLoading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des fournisseurs', err);
        this.suppliersLoading = false;
        this.snackBar.open('Erreur lors du chargement des fournisseurs', 'OK', { duration: 3000 });
      }
    });
  }

  filterSuppliers(): void {
    if (!this.supplierSearchTerm) {
      this.filteredSuppliers = [...this.suppliers];
      return;
    }

    const searchTermLower = this.supplierSearchTerm.toLowerCase().trim();
    this.filteredSuppliers = this.suppliers.filter(supplier => {
      return (
        supplier.name?.toLowerCase().includes(searchTermLower) ||
        supplier.email?.toLowerCase().includes(searchTermLower) ||
        supplier.phone?.toLowerCase().includes(searchTermLower) ||
        supplier.address?.toLowerCase().includes(searchTermLower) ||
        supplier.info?.toLowerCase().includes(searchTermLower)
      );
    });
  }

  openSupplierDialog(supplier?: Supplier): void {
    const dialogRef = this.dialog.open(SupplierDialogComponent, {
      width: '500px',
      data: supplier ? { ...supplier } : null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        supplier ? this.updateSupplier(supplier.id!, result) : this.addSupplier(result);
      }
    });
  }

  addSupplier(supplier: Supplier): void {
    this.supplierService.create(supplier).then(() => {
      this.snackBar.open('Fournisseur ajouté avec succès', 'OK', { duration: 3000 });
      this.loadSuppliers();
    }).catch(error => {
      this.snackBar.open('Erreur lors de l\'ajout du fournisseur', 'OK', { duration: 3000 });
      console.error(error);
    });
  }

  updateSupplier(id: string, supplier: Supplier): void {
    this.supplierService.update(id, supplier).then(() => {
      this.snackBar.open('Fournisseur mis à jour avec succès', 'OK', { duration: 3000 });
      this.loadSuppliers();
    }).catch(error => {
      this.snackBar.open('Erreur lors de la mise à jour du fournisseur', 'OK', { duration: 3000 });
      console.error(error);
    });
  }

  deleteSupplier(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      this.supplierService.delete(id).then(() => {
        this.snackBar.open('Fournisseur supprimé avec succès', 'OK', { duration: 3000 });
        this.loadSuppliers();
      }).catch(error => {
        this.snackBar.open('Erreur lors de la suppression du fournisseur', 'OK', { duration: 3000 });
        console.error(error);
      });
    }
  }
}
