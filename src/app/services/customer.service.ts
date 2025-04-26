import { Injectable } from '@angular/core';
import { AngularFireDatabase, SnapshotAction } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';


interface Customer {
  id?: string;
  name: string;
  phone: string;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private dbPath = '/customers';

  constructor(private db: AngularFireDatabase) {}

  getCustomers(): Observable<Customer[]> {
    return this.db.list<Customer>(this.dbPath)
      .snapshotChanges()
      .pipe(
        map((snapshots: SnapshotAction<Customer>[]) => 
          snapshots.map(snapshot => ({
            id: snapshot.key,
            ...snapshot.payload.val()
          } as Customer)),
        map((customers: Customer[]) => 
          customers.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      )
    ));
  }

  async addCustomer(customer: { name: string; phone: string; address?: string }): Promise<string> {
    const ref = await this.db.list(this.dbPath).push({
      ...customer,
      createdAt: new Date().toISOString()
    });
    return ref.key ?? '';
  }

  async updateCustomer(id: string, data: Partial<{ name: string; phone: string; address: string }>): Promise<void> {
    if (!id) {
      throw new Error('Customer ID is required');
    }
    await this.db.object(`${this.dbPath}/${id}`).update({
      ...data,
      updatedAt: new Date().toISOString()
    });
  }

  async deleteCustomer(id: string): Promise<void> {
    if (!id) {
      throw new Error('Customer ID is required');
    }
    await this.db.object(`${this.dbPath}/${id}`).remove();
  }
}