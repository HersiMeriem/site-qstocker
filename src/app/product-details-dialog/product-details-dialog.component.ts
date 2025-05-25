// product-details-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-product-details-dialog',
  template: `
    <h2 mat-dialog-title>Détails du produit</h2>
    <div mat-dialog-content>
      <div class="product-details">
        <div class="product-image" *ngIf="data.image">
          <img [src]="data.image" alt="Image du produit" class="img-fluid">
        </div>
        <div class="product-info">
          <p><strong>Nom:</strong> {{ data.name }}</p>
          <p><strong>Quantité:</strong> {{ data.quantity }} (Seuil: {{ data.threshold }})</p>
          <p><strong>Prix:</strong> {{ data.price | currency:'EUR':'symbol' }}</p>
          <p class="text-danger"><strong>Statut:</strong> Rupture de stock</p>
        </div>
      </div>
    </div>
    <div mat-dialog-actions>
      <button mat-button mat-dialog-close>Fermer</button>
      <button mat-button color="primary" [mat-dialog-close]="true" cdkFocusInitial>
        Voir le produit
      </button>
    </div>
  `,
  styles: [`
    .product-details {
      display: flex;
      gap: 20px;
      align-items: center;
    }
    .product-image {
      width: 100px;
      height: 100px;
      border-radius: 4px;
      overflow: hidden;
    }
    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .product-info {
      flex: 1;
    }
  `]
})
export class ProductDetailsDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}