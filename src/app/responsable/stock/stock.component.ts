import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { StockService } from '../../services/stock.service';
import { StockItem } from '../../services/stock.service';
import { NgForm } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { Subscription } from 'rxjs';

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

  constructor(
    private stockService: StockService,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    this.loadStock();
    this.loadProducts();
  }

  ngOnDestroy(): void {
    if (this.stockSubscription) {
      this.stockSubscription.unsubscribe();
    }
  }

  loadStock(): void {
    this.loading = true;
    this.stockSubscription = this.stockService.getStock().subscribe({
      next: (stock) => {
        this.stock = stock.map(item => ({
          ...item,
          editingPrice: false,
          originalPrice: item.prixDeVente || 0,
          qrCode: item.qrCode || null,
          imageUrl: item.imageUrl || null,
          description: item.description || null,
          seuil: item.seuil || 10
        }));
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

  loadProducts(): void {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.mergeProductInfo();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des produits', err);
        this.errorMessage = 'Erreur lors du chargement des produits.';
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

  calculateTotalValue(prixUnitaire: number, quantite: number): number {
    return prixUnitaire * quantite;
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
        this.errorMessage = `Erreur de mise à jour: ${error.message}`;
      })
      .finally(() => {
        this.updating = false;
      });
  }

  async deleteProduct(productId: string): Promise<void> {
    if (confirm('Êtes-vous sûr de vouloir supprimer définitivement ce produit ?')) {
      try {
        await this.stockService.deleteProduct(productId);
        this.loadStock();
        this.errorMessage = null;
      } catch (error: unknown) {
        this.errorMessage = "Échec de la suppression du produit";
        console.error(error);
      }
    }
  }

  async quickEditQuantity(produit: StockItem): Promise<void> {
    const newQty = prompt(`Modifier la quantité pour ${produit.nomProduit} :`, produit.quantite.toString());

    if (newQty !== null && !isNaN(Number(newQty))) {
      const quantity = Number(newQty);

      if (quantity < 0) {
        this.errorMessage = "La quantité ne peut pas être négative";
        return;
      }

      try {
        await this.stockService.updateStock(produit.idProduit, {
          quantite: quantity,
          dateMiseAJour: new Date().toISOString()
        });
        this.loadStock();
      } catch (error: unknown) {
        this.errorMessage = "Erreur lors de la mise à jour";
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
      alert(`Historique des prix pour ${produit.nomProduit}:\n\n${history}`);
    } else {
      alert('Aucun historique de prix disponible');
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
      this.errorMessage = 'Le prix de vente doit être positif';
      return;
    }

    try {
      await this.stockService.updateStock(produit.idProduit, {
        prixDeVente: produit.prixDeVente,
        dateMiseAJour: new Date().toISOString()
      });
      produit.editingPrice = false;
      this.loadStock();
    } catch (error: unknown) {
      this.errorMessage = 'Erreur lors de la mise à jour du prix';
      console.error(error);
    }
  }

  private validateForm(): boolean {
    if ((this.selectedProduct.quantite || 0) < 0) {
      this.errorMessage = 'La quantité ne peut pas être négative';
      return false;
    }

    if ((this.selectedProduct.prixUnitaireHT || 0) <= 0) {
      this.errorMessage = 'Le prix unitaire doit être positif';
      return false;
    }

    if ((this.selectedProduct.prixDeVente || 0) <= 0) {
      this.errorMessage = 'Le prix de vente doit être positif';
      return false;
    }

    if (!this.selectedProduct.nomProduit?.trim()) {
      this.errorMessage = 'Le nom du produit est requis';
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
      description: null
    };
  }
}