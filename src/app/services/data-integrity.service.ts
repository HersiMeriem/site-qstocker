import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';

@Injectable({
  providedIn: 'root'
})


export class DataIntegrityService {
  runAllChecks() {
    throw new Error("Method not implemented.");
  }
  showSuccess: any;
  dataIntegrityService: any;
  confirmationService: any;
  issues: any;
  constructor(private db: AngularFireDatabase) { }

  async runCheck(checkId: string): Promise<{ issues: string[] }> {
    switch (checkId) {
      case 'orphan_records':
        return this.checkOrphanRecords();
      case 'data_integrity':
        return this.checkDataIntegrity();
      case 'duplicates':
        return this.checkDuplicates();
      default:
        return { issues: [] };
    }
  }

  async fixIssues(checkId: string): Promise<{ success: boolean; fixedCount: number }> {
    switch (checkId) {
      case 'orphan_records':
        return this.fixOrphanRecords();
      case 'data_integrity':
        return this.fixDataIntegrity();
      case 'duplicates':
        return this.fixDuplicates();
      default:
        return { success: false, fixedCount: 0 };
    }
  }

  private async checkOrphanRecords(): Promise<{ issues: string[] }> {
    const issues: string[] = [];
    
    const usersWithoutProfile = await this.db.list('users', ref => 
      ref.orderByChild('profileExists').equalTo(false)
    ).query.once('value');
    
    usersWithoutProfile.forEach(user => {
      issues.push(`Utilisateur orphelin: ${user.key} (pas de profil associé)`);
    });

    return { issues };
  }

  async checkDataIntegrity(): Promise<{ issues: string[] }> {
    const issues: string[] = [];
    
    try {
      const ordersSnapshot = await this.db.list('orders').query.once('value');
      const orders = ordersSnapshot.val() || {};
  
      const customersSnapshot = await this.db.list('customers').query.once('value');
      const customers = customersSnapshot.val() || {};
  
      Object.keys(orders).forEach(orderId => {
        const order = orders[orderId];
        
        if (!order.customerId) {
          issues.push(`Commande ${orderId} : aucun customerId spécifié`);
          return;
        }
  
        if (!customers[order.customerId]) {
          issues.push(`Commande ${orderId} : client ${order.customerId} introuvable`);
        }
      });
  
    } catch (error: any) {
      console.error('Erreur de vérification:', error);
      issues.push('Erreur technique lors de la vérification: ' + error.message);
    }
  
    return { issues };
  }

  private async checkDuplicates(): Promise<{ issues: string[] }> {
    const issues: string[] = [];
    const products = await this.db.list('products').query.once('value');
    const seenNames = new Set();
    
    products.forEach(product => {
      const name = product.val().name;
      if (seenNames.has(name)) {
        issues.push(`Produit en double: ${name} (ID: ${product.key})`);
      } else {
        seenNames.add(name);
      }
    });

    return { issues };
  }

  private async fixOrphanRecords(): Promise<{ success: boolean; fixedCount: number }> {
    try {
      const result = await this.db.list('users')
        .query.orderByChild('profileExists')
        .equalTo(false)
        .once('value');

      const updates: Promise<void>[] = [];
      let fixedCount = 0;

      result.forEach(user => {
        updates.push(
          this.db.object(`users/${user.key}/profileExists`).set(true)
        );
        fixedCount++;
      });

      await Promise.all(updates);
      return { success: true, fixedCount };
    } catch (error) {
      console.error('Error fixing orphan records:', error);
      return { success: false, fixedCount: 0 };
    }
  }

  private async fixDataIntegrity(): Promise<{ success: boolean; fixedCount: number }> {
    try {
      const ordersSnapshot = await this.db.list('orders').query.once('value');
      const customersSnapshot = await this.db.list('customers').query.once('value');
      
      const updates: Promise<void>[] = [];
      let fixedCount = 0;
      const defaultCustomerId = 'CLIENT_PAR_DEFAUT'; // À définir
  
      Object.keys(ordersSnapshot.val() || {}).forEach(orderId => {
        const order = ordersSnapshot.val()[orderId];
        
        // Cas 1: Aucun customerId spécifié
        if (!order.customerId) {
          updates.push(
            this.db.object(`orders/${orderId}/customerId`).set(defaultCustomerId)
          );
          fixedCount++;
        } 
        // Cas 2: customerId invalide
        else if (!customersSnapshot.val()[order.customerId]) {
          updates.push(
            this.db.object(`orders/${orderId}/customerId`).set(defaultCustomerId)
          );
          fixedCount++;
        }
      });
  
      await Promise.all(updates);
      return { success: true, fixedCount };
    } catch (error) {
      console.error('Error fixing data integrity:', error);
      return { success: false, fixedCount: 0 };
    }
  }

  private async fixDuplicates(): Promise<{ success: boolean; fixedCount: number }> {
    try {
      const products = await this.db.list('products').query.once('value');
      const nameMap = new Map<string, string[]>();

      // Group products by name
      products.forEach(product => {
        const name = product.val().name;
        if (!nameMap.has(name)) {
          nameMap.set(name, []);
        }
        nameMap.get(name)?.push(product.key as string);
      });

      const updates: Promise<void>[] = [];
      let fixedCount = 0;

      // Keep first occurrence, mark others as duplicates
      for (const [name, ids] of nameMap.entries()) {
        if (ids.length > 1) {
          for (let i = 1; i < ids.length; i++) {
            updates.push(
              this.db.object(`products/${ids[i]}/isDuplicate`).set(true)
            );
            fixedCount++;
          }
        }
      }

      await Promise.all(updates);
      return { success: true, fixedCount };
    } catch (error) {
      console.error('Error fixing duplicates:', error);
      return { success: false, fixedCount: 0 };
    }
  }

  async fixOrphanOrders() {
    const confirmation = await this.confirmationService.confirm({
      title: 'Correction des commandes',
      message: `Voulez-vous assigner un client par défaut à ${this.issues.length} commandes?`,
      confirmText: 'Corriger',
      cancelText: 'Annuler'
    });
    
    if (confirmation) {
      const result = await this.dataIntegrityService.fixDataIntegrity();
      if (result.success) {
        this.showSuccess(`${result.fixedCount} commandes corrigées`);
      }
    }
  }

  async fixAllMissingCustomerIds() {
    const defaultCustomerId = "ID_CLIENT_DEFAUT"; // À remplacer
    const issues = await this.dataIntegrityService.detectIssues();
    
    const ordersWithoutCustomer = issues.filter(
      (      issue: { message: string | string[]; }) => issue.message.includes('aucun customerId')
    );
  
    const results = await Promise.all(
      ordersWithoutCustomer.map((order: { orderId: any; }) => 
        this.db.object(`orders/${order.orderId}`).update({
          customerId: defaultCustomerId,
          _fixedAt: new Date().toISOString()
        })
      )
    );
  
    this.showSuccess(`${results.length} commandes corrigées`);
  }



private scheduleConfigRef = this.db.object('config/dataCheckSchedule');

async setSchedule(frequency: 'daily' | 'weekly' | 'monthly') {
  const nextRun = this.calculateNextRun(frequency);
  await this.scheduleConfigRef.set({
    frequency,
    nextRun: nextRun.toISOString(),
    lastUpdated: new Date().toISOString()
  });
  return nextRun;
}

private calculateNextRun(frequency: string): Date {
  const now = new Date();
  switch(frequency) {
    case 'daily':
      return new Date(now.setDate(now.getDate() + 1));
    case 'weekly':
      return new Date(now.setDate(now.getDate() + 7));
    case 'monthly':
      return new Date(now.setMonth(now.getMonth() + 1));
    default:
      return new Date(now.setDate(now.getDate() + 1));
  }
}
}