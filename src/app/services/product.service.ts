import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable, firstValueFrom, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Product } from '../models/product';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private dbPath = '/products';

  constructor(private db: AngularFireDatabase) {}

  async addProduct(product: Product): Promise<void> {
    try {
      // Validation de base
      if (!/^PRD-\d{3,5}$/i.test(product.id)) {
        throw new Error('Format ID invalide. Exemple: PRD-1234');
      }

      // Validation du nom
      if (!product.name || product.name.trim().length < 3) {
        throw new Error('Le nom doit faire au moins 3 caractères');
      }

      // Nettoyage et formatage
      const formattedId = product.id.toUpperCase().trim();
      const now = new Date().toISOString();

      // Vérification existence
      const ref = this.db.database.ref(`${this.dbPath}/${formattedId}`);
      if ((await ref.once('value')).exists()) {
        throw new Error('ID déjà utilisé');
      }

      // Validation des promotions
      if (product.status === 'promotion') {
        if (!product.promotion) {
          throw new Error('Promotion requise pour le statut promotion');
        }

        const { discountPercentage, startDate, endDate } = product.promotion;
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

      // Ajout de la validation de l’authenticité
      if (product.isAuthentic === undefined) {
        throw new Error('Le champ d\'authenticité est requis');
      }

      // Structure finale du produit
      const productData = {
        ...this.cleanProductFields(product), // Nettoyage des champs supplémentaires
        id: formattedId,
        status: product.status || 'active', // Valeur par défaut
        createdAt: now,
        updatedAt: now,
        promotion: product.status === 'promotion' ? product.promotion : null
      };

      await ref.set(productData);

    } catch (error) {
      console.error(`Erreur d'ajout produit: ${error}`);
      throw new Error(this.getUserFriendlyError(error));
    }
  }

private cleanProductFields(product: Product): Partial<Product> {
    // Enlève les champs inutiles pour Firebase
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
}
