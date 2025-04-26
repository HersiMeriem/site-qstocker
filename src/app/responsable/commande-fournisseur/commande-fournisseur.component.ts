import { Component, OnInit } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Supplier } from '../../models/supplier'; 
import { SupplierService } from 'src/app/services/supplier.service';
import { Product } from '../../models/product';
import { ProductService } from '../../services/product.service';
import { ActivatedRoute } from '@angular/router';
import { EmailService } from 'src/app/services/email.service';

@Component({
  selector: 'app-commande-fournisseur',
  templateUrl: './commande-fournisseur.component.html',
  styleUrls: ['./commande-fournisseur.component.css']
})
export class CommandeFournisseurComponent implements OnInit {
  newOrder: any = {
    quantity: 1,
    totalHT: 0,
    totalTTC: 0
  };
  suppliers: Supplier[] = []; 
  products: Product[] = [];
  filteredProducts: Product[] = [];
  selectedSupplier?: Supplier;
  selectedProduct?: Product;
  productSearchTerm = '';
  predefinedSizes: string[] = ['15ML', '30ML', '120ML'];
   selectedSize: string = '';
   customSize: string = '';

  constructor(
    private emailService: EmailService,
    private db: AngularFireDatabase,
    private supplierService: SupplierService,
    private productService: ProductService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.loadSuppliers();
    this.loadProducts();
    this.generateOrderId();
    this.route.queryParams.subscribe(params => {
      if (params['productId']) {
        this.productService.getProductById(params['productId']).subscribe(product => {
          if (product) {
            this.selectedProduct = product;
            this.onProductSelected();
          }
        });
      }
    });
  }

  loadSuppliers() {
    this.supplierService.getAll().subscribe(suppliers => {
      this.suppliers = suppliers;
    });
  }

  loadProducts() {
    this.productService.getProducts().subscribe(products => {
      this.products = products;
      this.filteredProducts = [...products];
    });
  }

  filterProducts() {
    if (!this.productSearchTerm) {
      this.filteredProducts = [...this.products];
      return;
    }
    
    const term = this.productSearchTerm.toLowerCase();
    this.filteredProducts = this.products.filter(product => 
      product.name.toLowerCase().includes(term) || 
      product.id.toLowerCase().includes(term)
    );
  }

  onProductSelected() {
    if (this.selectedProduct) {
      this.newOrder.productId = this.selectedProduct.id;
      this.newOrder.productName = this.selectedProduct.name;
  
      if (!this.newOrder.unitPrice) {
        this.newOrder.unitPrice = this.selectedProduct.costPrice;
      }
  
      this.calculateTotals();
    }
  }

  calculateTotals() {
    const quantity = Number(this.newOrder.quantity) || 0;
    const unitPrice = Number(this.newOrder.unitPrice) || 0;
  
    this.newOrder.totalHT = quantity * unitPrice;
    this.newOrder.totalTTC = this.newOrder.totalHT * 1.19;
  }
  

  sendOrder() {
    if (!this.selectedSupplier || !this.selectedProduct) {
      alert('❌ Veuillez sélectionner un fournisseur et un produit');
      return;
    }
      if (!this.newOrder.id) {
      this.newOrder.id = this.generateOrderId();
    }  
    const finalSize = this.selectedSize === 'Autre' ? this.customSize : this.selectedSize;
   
    const orderData = {
      ...this.newOrder,
      deliveryDate: new Date(this.newOrder.deliveryDate).toISOString(),
      id: this.newOrder.id,
      idProduit: this.selectedProduct.id,
      productName: this.selectedProduct.name,
      productVolume: this.selectedProduct.volume, 
      dateCommande: new Date().toISOString(),
      status: "En attente",
      supplierId: this.selectedSupplier.id,
      supplierName: this.selectedSupplier.name,
      supplierEmail: this.selectedSupplier.email,
      unitPrice: this.newOrder.unitPrice
    };
    
    this.db.object(`/historique-commandes/${orderData.id}`).set(orderData)
      .then(() => {
        alert('✅ Commande envoyée avec succès!');
        this.emailService.sendEmail(orderData);
        this.resetForm();
      })
      .catch(error => {
        console.error("❌ Erreur:", error);
        alert(`❌ Erreur lors de l'enregistrement: ${error.message}`);
      });
  }

  private generateOrderId(): string {
    const date = new Date();
    const datePart = date.toISOString().slice(2, 10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    this.newOrder.id = `CMD-${datePart}-${randomPart}`; 
    return this.newOrder.id;
}
  
  get formattedProductId(): string {
    if (!this.selectedProduct?.id) return '';
    return `REF-${this.selectedProduct.id}`;
  } 
  
  private resetForm() {
    this.newOrder = {
      id: this.generateOrderId(),
      productId: '',
      productName: '',
      productVolume: '', 
      unitPrice: 0,
      quantity: 1,
      deliveryDate: '',
      totalHT: 0,
      totalTTC: 0,
    };
    this.selectedSupplier = undefined;
    this.selectedProduct = undefined;
    this.productSearchTerm = '';
    this.filterProducts();
}

}
