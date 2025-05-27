import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable, firstValueFrom, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Product } from '../models/product';
import { QrCodeService } from './qr-code.service';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private dbPath = '/products';
  private readonly ID_PATTERN = /^PRD-\d{3,5}$/i;

  constructor(
    private db: AngularFireDatabase,
    private qrCodeService: QrCodeService
  ) {}

  async addProduct(product: Product): Promise<void> {
    try {
      // Validation de base
      if (!this.ID_PATTERN.test(product.id)) {
        throw new Error('Format ID invalide. Exemple: PRD-1234');
      }

      if (!product.name || product.name.trim().length < 3) {
        throw new Error('Le nom doit faire au moins 3 caractères');
      }

      const formattedId = product.id.toUpperCase().trim();
      const now = new Date().toISOString();

      // Vérification existence
      const ref = this.db.database.ref(`${this.dbPath}/${formattedId}`);
      if ((await ref.once('value')).exists()) {
        throw new Error('ID déjà utilisé');
      }

      // Validation promotion
      if (product.status === 'promotion') {
        this.validatePromotion(product.promotion);
      }

      // Validation authenticité
      if (product.isAuthentic === undefined) {
        throw new Error('Le champ d\'authenticité est requis');
      }

      // Génération QR Code
      const qrCodeImage = await this.qrCodeService.generateQRCodeImage(product.id);

      const productData = {
        ...this.cleanProductFields(product),
        id: formattedId,
        qrCode: product.id,
        qrCodeImage: qrCodeImage,
        status: product.status || 'active',
        createdAt: now,
        updatedAt: now,
        promotion: product.status === 'promotion' && product.promotion ? {
          discountPercentage: product.promotion.discountPercentage,
          startDate: product.promotion.startDate,
          endDate: product.promotion.endDate
        } : null
      };

      await ref.set(productData);

    } catch (error) {
      console.error(`Erreur d'ajout produit: ${error}`);
      throw new Error(this.getUserFriendlyError(error));
    }
  }

  private validatePromotion(promotion?: any): void {
    if (!promotion) {
      throw new Error('Promotion requise pour le statut promotion');
    }

    const { discountPercentage, startDate, endDate } = promotion;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Dates de promotion invalides');
    }

    if (start >= end) {
      throw new Error('La date de fin doit être après la date de début');
    }

    if (!discountPercentage || discountPercentage < 1 || discountPercentage > 100) {
      throw new Error('Remise doit être entre 1% et 100%');
    }
  }

  private cleanProductFields(product: Product): Partial<Product> {
    const { id, promotion, ...cleanProduct } = product;
    return cleanProduct;
  }

  private getUserFriendlyError(error: unknown): string {
    const message = (error as Error).message;
    if (message.includes('permission_denied')) {
      return 'Erreur d\'autorisation. Contactez l\'administrateur.';
    }
    return message.replace('Firebase: ', '');
  }

  async productExists(productId: string): Promise<boolean> {
    const product = await firstValueFrom(
      this.db.object(`/products/${productId}`).valueChanges()
    );
    return !!product;
  }

  // Récupérer tous les produits
  getProducts(): Observable<Product[]> {
    return this.db.list<Product>(this.dbPath).snapshotChanges().pipe(
      map(snapshot =>
        snapshot.map(c => ({
          ...(c.payload.val() as Product),
          id: c.payload.key || '' // Assurez-vous que la clé (ID) est incluse
        }))
      ),
      catchError(error => {
        console.error('Erreur Firebase:', error);
        return throwError(() => new Error('Erreur de chargement des produits'));
      })
    );
  }

  // Récupérer un produit par ID
  getProductById(id: string): Observable<Product> {
    return this.db.object<Product>(`${this.dbPath}/${id}`).valueChanges().pipe(
      map(product => {
        if (!product) {
          throw new Error('Produit non trouvé');
        }
        return {
          ...product,
          id,
          costPrice: product.costPrice || 0 // Valeur par défaut si non définie
        };
      })
    );
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<void> {
    try {
      if (!id) throw new Error('ID produit manquant');

      // Validation de l'authenticité
      if (product.isAuthentic === undefined) {
        throw new Error('Le champ d\'authenticité est requis');
      }

      const updateData = {
        ...product,
        updatedAt: new Date().toISOString()
      };

      await this.db.database.ref(`${this.dbPath}/${id}`).update(updateData);

    } catch (error) {
      console.error('Erreur Firebase:', error);
      throw new Error(`Échec de la mise à jour: ${(error as Error).message}`);
    }
  }

  // Supprimer un produit
  deleteProduct(productId: string): Promise<void> {
    return this.db.list(this.dbPath).remove(productId);
  }

  checkProductsAuthenticity(): Promise<any> {
    return Promise.resolve({
      verifiedCount: 0,
      suspiciousCount: 0,
      details: {
        qrValidationScore: 0,
        mlConsistency: 0,
        stockHistoryScore: 0,
        locationScore: 0
      }
    });
  }

  async generateMissingQRCodes(): Promise<void> {
    const products = await firstValueFrom(this.getProducts());

    for (const product of products) {
      if (!product.qrCodeImage) {
        try {
          const qrCodeImage = await this.qrCodeService.generateQRCodeImage(product.id);
          await this.db.database.ref(`${this.dbPath}/${product.id}`).update({
            qrCodeImage: qrCodeImage
          });
        } catch (error) {
          console.error(`Failed to generate QR code for product ${product.id}:`, error);
        }
      }
    }
  }
}
