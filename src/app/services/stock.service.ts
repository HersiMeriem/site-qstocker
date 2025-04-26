import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { firstValueFrom } from 'rxjs';
import { SnapshotAction } from '@angular/fire/compat/database/interfaces';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface StockItem {
  originalPrice: number;
editingPrice: any;
  idProduit: string;
  nomProduit: string;
  quantite: number;
  prixUnitaireHT: number;
  prixDeVente: number;
  seuil: number; 
  demandPrevue?: number; 
  dateMiseAJour: string;
  historiquePrix?: Array<{
    date: string;
    prix: number;
    quantiteAjoutee: number;
  }>;
  qrCode?: string | null;  
  imageUrl?: string | null;
  description?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private stockPath = '/stock';
  private movementsPath = '/stock-movements';


  constructor(private db: AngularFireDatabase) {}

    // Ajoutez cette méthode pour l'intégration avec les commandes
    async processSupplierOrder(order: any): Promise<void> {
      try {
        await this.ajouterAuStock({
          productId: order.productId,
          productName: order.productName,
          quantity: order.quantity,
          unitPrice: order.unitPrice
        });
        
        // Journalisation de la transaction
        await this.db.list('/order-logs').push({
          ...order,
          type: 'approvisionnement',
          date: new Date().toISOString()
        });
      } catch (error) {
        console.error('Erreur globale:', error);
        throw new Error('Échec du traitement de la commande');
      }
    }

    async logStockMovement(movement: {
      productId: string;
      type: 'ajout' | 'retrait' | 'ajustement';
      quantity: number;
      previousQuantity: number;
      date: string;
    }): Promise<void> {
      await this.db.list('/stock-movements').push(movement);
    } 


    getStockMovements(): Observable<any[]> {
      return this.db.list(this.movementsPath)
        .valueChanges()
        .pipe(
          map((movements: any[]) => 
            movements.sort((a, b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
            )
          )
        );
    }

    getStockReport(): Observable<any> {
      return this.getStock().pipe(
        map(stock => {
          const totalValue = stock.reduce((sum, item) => 
            sum + (item.quantite * item.prixUnitaireHT), 0);
          
          return {
            totalProducts: stock.length,
            totalItems: stock.reduce((sum, item) => sum + item.quantite, 0),
            totalValue,
            lowStock: stock.filter(item => item.quantite < (item.seuil || 10)).length,
            lastUpdated: new Date().toISOString()
          };
        })
      );
    }
  
    getStockHistoryReport(): Observable<any> {
      return this.getStockMovements().pipe(
        map(movements => {
          const today = new Date().toISOString().split('T')[0];
          const recent = movements.filter(m => 
            m.date && m.date.toString().startsWith(today));
          
          return {
            todayMovements: recent.length,
            lastMovements: movements.slice(0, 10),
            movementTypes: {
              additions: movements.filter(m => m.type === 'ajout').length,
              removals: movements.filter(m => m.type === 'retrait').length
            }
          };
        })
      );
    }

    async updateStockQuantity(productId: string, delta: number): Promise<void> {
      try {
        const ref = this.db.object<StockItem>(`${this.stockPath}/${productId}`);
        const snapshot = await firstValueFrom(ref.valueChanges());
        
        if (!snapshot) throw new Error(`Produit ${productId} non trouvé`);
    
        const newQuantity = snapshot.quantite + delta;
        if (newQuantity < 0) throw new Error('Stock insuffisant');
    
        await ref.update({
          quantite: newQuantity,
          dateMiseAJour: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`Erreur sur le produit ${productId}:`, error);
        throw error;
      }
    }
  
    getStock(): Observable<StockItem[]> {
      return this.db.list<StockItem>(this.stockPath).valueChanges();
    }

  async updateStock(productId: string, updateData: Partial<StockItem>): Promise<void> {
    try {
      if (!productId) throw new Error('ID produit manquant');
  
      const ref = this.db.object<StockItem>(`${this.stockPath}/${productId}`);
      const snapshot = await firstValueFrom(ref.valueChanges());
  
      if (!snapshot) {
        throw new Error('Produit non trouvé dans le stock');
      }
  
      await ref.update({
        ...updateData,
        dateMiseAJour: new Date().toISOString()
      });
  
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur de mise à jour:', {
        productId,
        updateData,
        errorMessage
      });
      throw new Error(`Échec de la mise à jour: ${errorMessage}`);
    }
  }
  getProductStockQuantity(productId: string): Observable<number> {
    return this.db.object<StockItem>(`${this.stockPath}/${productId}`)
      .valueChanges()
      .pipe(
        map((stock: StockItem | null) => stock?.quantite || 0),
        catchError(() => of(0))
      );
  }

  async ajouterAuStock(commande: {
    productId: string;
    productName?: string;
    quantity: number;
    unitPrice: number;
    qrCode?: string | null;
    imageUrl?: string | null;
    description?: string | null;
  }): Promise<StockItem> {
    try {
      const stockRef = this.db.object<StockItem>(`${this.stockPath}/${commande.productId}`);
      const snapshot = await firstValueFrom(stockRef.snapshotChanges()) as SnapshotAction<StockItem>;
      
      // Données par défaut avec valeurs null au lieu de undefined
      const currentData = snapshot.payload.val() || {
        idProduit: commande.productId,
        nomProduit: commande.productName || 'Nouveau produit',
        quantite: 0,
        prixUnitaireHT: 0,
        prixDeVente: 0,
        dateMiseAJour: new Date().toISOString(),
        historiquePrix: [],
        qrCode: null,
        imageUrl: null,
        description: null
      };
  
      const newEntry = {
        date: new Date().toISOString(),
        prix: commande.unitPrice,
        quantiteAjoutee: commande.quantity
      };
  
      const historique = [...(currentData.historiquePrix || []), newEntry];
      
      const totalQuantite = historique.reduce((sum, e) => sum + e.quantiteAjoutee, 0);
      const totalValeur = historique.reduce((sum, e) => sum + (e.prix * e.quantiteAjoutee), 0);
      const nouveauPMP = totalQuantite > 0 ? totalValeur / totalQuantite : 0;
  
      // Créez l'objet de données en remplaçant undefined par null
      const updatedData: StockItem = {
        ...currentData,
        idProduit: commande.productId,
        nomProduit: commande.productName || currentData.nomProduit || 'Nouveau produit',
        quantite: totalQuantite,
        prixUnitaireHT: nouveauPMP,
        prixDeVente: commande.unitPrice * 1.2, // Prix de vente par défaut
        dateMiseAJour: new Date().toISOString(),
        historiquePrix: historique,
        qrCode: commande.qrCode || null,
        imageUrl: commande.imageUrl || null,
        description: commande.description || null,
        // Initialisation des nouvelles propriétés
        editingPrice: false,
        originalPrice: commande.unitPrice * 1.2,
        seuil: (currentData as StockItem).seuil || 10 // Type assertion
      };
  
      // Supprimez explicitement les propriétés undefined
      Object.keys(updatedData).forEach(key => {
        if (updatedData[key as keyof StockItem] === undefined) {
          delete updatedData[key as keyof StockItem];
        }
      });
  
      await stockRef.set(updatedData);
      return updatedData;
    } catch (error) {
      console.error('Erreur détaillée:', error);
      throw new Error('Échec de la mise à jour du stock');
    }
  }
  
  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.db.object(`${this.stockPath}/${productId}`).remove();
    } catch (error) {
      console.error('Erreur suppression:', error);
      throw new Error('Échec de la suppression');
    }
  }

  async retirerDuStock(commande: any): Promise<void> {
    try {
      const stockRef = this.db.object<StockItem>(`${this.stockPath}/${commande.productId}`);
      const snapshot = await firstValueFrom(stockRef.snapshotChanges()) as SnapshotAction<StockItem>;
      const currentData = snapshot.payload.val();
      
      if (!currentData) throw new Error('Produit non trouvé');

      const updatedStock: StockItem = {
        ...currentData,
        quantite: Math.max(currentData.quantite - commande.quantity, 0),
        dateMiseAJour: new Date().toISOString()
      };

      await stockRef.update(updatedStock);
    } catch (error) {
      console.error('Erreur retrait:', error);
      throw error;
    }
  }



  getProduct(productId: string): Observable<StockItem | null> {
    return this.db.object<StockItem>(`${this.stockPath}/${productId}`).valueChanges().pipe(
      map(stockItem => {
        console.log('Stock Item:', stockItem); // Debug
        return stockItem;
      }),
      catchError(error => {
        console.error('Error loading stock item:', error);
        return of(null);
      })
    );
  }
  predictStockAnalysis(params: { period: number }): Promise<any> {
    // Implement your stock analysis logic here
    return Promise.resolve({
      predictedStockouts: 0,
      trend: 0,
      optimizationPotential: 0,
      turnoverRate: 0,
      predictionData: []
    });
  }
  getStockHistory(productId: string): Observable<StockItem[]> {
    return this.db.list<StockItem>(`${this.stockPath}/${productId}/historiquePrix`)
      .valueChanges();
  }
}