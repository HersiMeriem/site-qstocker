// inventory.service.ts
import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface InventoryItem {
  id: string;
  name: string;
  code: string;
  category: string;
  quantity: number;
  minStock: number;
  location: string;
  lastModified: string;
  lastModifiedBy: string;
}

interface InventoryStats {
  totalItems: number;
  lowStockItems: number;
  categories: number;
  lastInventory?: string;
  lastTransfer?: string;
}

interface TransferItem {
  id: string;
  destinationId: string;
  name: string;
  code: string;
  currentQuantity: number;
  destinationCurrentQuantity?: number;
  transferQuantity: number;
}

interface TransferRecord {
  name: string;
  code: string;
  quantity: number;
  from: string;
  to: string;
  date: string;
  by: string;
}

interface FirebaseUpdates {
  [key: `inventory/${string}/items/${string}/quantity`]: number;
  [key: `inventory/${string}/items/${string}/lastModified`]: string;
  [key: `inventory/${string}/items/${string}/lastModifiedBy`]: string;
  [key: `inventory/${string}/stats/lastInventory`]: string;
  [key: `inventory/${string}/stats/lastTransfer`]: string;
  [key: `inventory/${string}/stats/totalItems`]: number;
  [key: `inventory/${string}/stats/lowStockItems`]: number;
  [key: `inventory/${string}/stats/categories`]: number;
  [key: `transfers/${string}/${string}/items/${string}`]: TransferRecord;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  constructor(
    private db: AngularFireDatabase,
    private storage: AngularFireStorage
  ) {}

  // Récupère les statistiques d'inventaire
  async getInventoryStats(userId: string): Promise<InventoryStats> {
    try {
      const snapshot = await this.db.database.ref(`inventory/${userId}/stats`).once('value');
      return snapshot.val() || { 
        totalItems: 0, 
        lowStockItems: 0, 
        categories: 0 
      };
    } catch (error) {
      console.error('Error getting inventory stats:', error);
      throw error;
    }
  }

  // Récupère les articles récemment modifiés
  async getRecentItems(userId: string, limit: number = 5): Promise<InventoryItem[]> {
    try {
      const snapshot = await this.db.database.ref(`inventory/${userId}/items`)
        .orderByChild('lastModified')
        .limitToLast(limit)
        .once('value');
      
      const items: InventoryItem[] = [];
      snapshot.forEach(childSnapshot => {
        items.push({
          id: childSnapshot.key || '',
          ...childSnapshot.val()
        });
        return false;
      });
      
      return items.reverse(); // Les plus récents en premier
    } catch (error) {
      console.error('Error getting recent items:', error);
      throw error;
    }
  }

  // Génère un rapport PDF d'inventaire
  async generateReport(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const user = await this.db.database.ref('users/current').once('value');
        const userId = user.val().uid;
        const warehouse = user.val().warehouse || 'Principal';
        
        // Récupérer les données d'inventaire
        const items = await this.getRecentItems(userId, 100);
        
        // Créer le PDF
        const doc = new jsPDF();
        const date = new Date().toLocaleDateString();
        
        // En-tête
        doc.setFontSize(18);
        doc.text(`Rapport d'inventaire - ${warehouse}`, 14, 20);
        doc.setFontSize(12);
        doc.text(`Date: ${date}`, 14, 30);
        
        // Tableau des articles
        const tableData = items.map(item => [
          item.name,
          item.code,
          item.category,
          item.quantity,
          item.minStock,
          item.quantity <= item.minStock ? '⚠️' : '✅'
        ]);
        
        (doc as any).autoTable({
          head: [['Nom', 'Code', 'Catégorie', 'Quantité', 'Stock min', 'Statut']],
          body: tableData,
          startY: 40,
          styles: {
            cellPadding: 2,
            fontSize: 10,
            valign: 'middle'
          },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 30 },
            2: { cellWidth: 40 },
            3: { cellWidth: 20 },
            4: { cellWidth: 20 },
            5: { cellWidth: 15 }
          },
          didDrawCell: (data: { column: { index: number; }; cell: { raw: string; }; }) => {
            if (data.column.index === 5 && data.cell.raw === '⚠️') {
              doc.setTextColor(255, 0, 0);
            }
          }
        });
        
        // Pied de page
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(10);
          doc.text(`Page ${i} sur ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
        }
        
        // Sauvegarder le PDF
        const pdfBlob = doc.output('blob');
        const pdfName = `inventory_report_${date.replace(/\//g, '-')}.pdf`;
        
        // Optionnel: Sauvegarder dans Firebase Storage
        const fileRef = this.storage.ref(`reports/${userId}/${pdfName}`);
        await fileRef.put(pdfBlob);
        
        // Télécharger le fichier
        doc.save(pdfName);
        
        resolve();
      } catch (error) {
        console.error('Error generating report:', error);
        reject(error);
      }
    });
  }

  // Méthode pour effectuer un inventaire rapide
  async quickInventoryCheck(userId: string, items: Array<{
    id: string;
    newQuantity: number;
  }>): Promise<void> {
    try {
      const updates: FirebaseUpdates = {};
      const now = new Date().toISOString();
      
      items.forEach(item => {
        updates[`inventory/${userId}/items/${item.id}/quantity`] = item.newQuantity;
        updates[`inventory/${userId}/items/${item.id}/lastModified`] = now;
        updates[`inventory/${userId}/items/${item.id}/lastModifiedBy`] = userId;
      });
      
      updates[`inventory/${userId}/stats/lastInventory`] = now;
      
      await this.db.database.ref().update(updates);
    } catch (error) {
      console.error('Error during inventory check:', error);
      throw error;
    }
  }

  // Méthode pour effectuer un transfert de stock
  async transferStock(
    userId: string,
    items: TransferItem[],
    fromLocation: string,
    toLocation: string
  ): Promise<void> {
    try {
      const updates: FirebaseUpdates = {};
      const now = new Date().toISOString();
      const transferId = this.db.createPushId();
      
      items.forEach(item => {
        // Réduire la quantité à l'origine
        updates[`inventory/${userId}/items/${item.id}/quantity`] = 
          item.currentQuantity - item.transferQuantity;
        
        // Augmenter la quantité à destination
        updates[`inventory/${userId}/items/${item.destinationId}/quantity`] = 
          (item.destinationCurrentQuantity || 0) + item.transferQuantity;
        
        // Marquer les dates de modification
        updates[`inventory/${userId}/items/${item.id}/lastModified`] = now;
        updates[`inventory/${userId}/items/${item.destinationId}/lastModified`] = now;
        updates[`inventory/${userId}/items/${item.id}/lastModifiedBy`] = userId;
        updates[`inventory/${userId}/items/${item.destinationId}/lastModifiedBy`] = userId;
        
        // Journaliser le transfert
        updates[`transfers/${userId}/${transferId}/items/${item.id}`] = {
          name: item.name,
          code: item.code,
          quantity: item.transferQuantity,
          from: fromLocation,
          to: toLocation,
          date: now,
          by: userId
        };
      });
      
      updates[`inventory/${userId}/stats/lastTransfer`] = now;
      
      await this.db.database.ref().update(updates);
    } catch (error) {
      console.error('Error during stock transfer:', error);
      throw error;
    }
  }

  // Méthode pour ajouter rapidement un article
  async quickAddItem(userId: string, item: {
    name: string;
    code?: string;
    category?: string;
    quantity?: number;
    minStock?: number;
    location?: string;
  }): Promise<string> {
    try {
      const now = new Date().toISOString();
      const newItemRef = this.db.database.ref(`inventory/${userId}/items`).push();
      const itemId = newItemRef.key || '';
      
      await newItemRef.set({
        name: item.name,
        code: item.code || '',
        category: item.category || 'Non classé',
        quantity: item.quantity || 0,
        minStock: item.minStock || 5,
        lastModified: now,
        lastModifiedBy: userId,
        location: item.location || 'Principal'
      });
      
      // Mettre à jour les statistiques
      await this.db.database.ref(`inventory/${userId}/stats`).transaction(stats => {
        const currentStats: InventoryStats = stats || { 
          totalItems: 0, 
          lowStockItems: 0, 
          categories: 0 
        };
        
        return {
          ...currentStats,
          totalItems: currentStats.totalItems + 1,
          categories: currentStats.categories + (item.category ? 1 : 0)
        };
      });
      
      return itemId;
    } catch (error) {
      console.error('Error adding new item:', error);
      throw error;
    }
  }

  // Méthode pour marquer un article comme en rupture de stock
  async markAsOutOfStock(userId: string, itemId: string): Promise<void> {
    try {
      const updates: FirebaseUpdates = {};
      const now = new Date().toISOString();
      
      updates[`inventory/${userId}/items/${itemId}/quantity`] = 0;
      updates[`inventory/${userId}/items/${itemId}/lastModified`] = now;
      updates[`inventory/${userId}/items/${itemId}/lastModifiedBy`] = userId;
      
      await this.db.database.ref().update(updates);
      
      // Mettre à jour les statistiques
      await this.db.database.ref(`inventory/${userId}/stats/lowStockItems`).transaction(lowStock => {
        return (lowStock || 0) + 1;
      });
    } catch (error) {
      console.error('Error marking item as out of stock:', error);
      throw error;
    }
  }
}