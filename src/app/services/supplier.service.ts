import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { map } from 'rxjs/operators';
import { Supplier } from '../models/supplier';

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private dbPath = '/suppliers';

  constructor(private db: AngularFireDatabase) {}

  getAll() {
    return this.db.list<Supplier>(this.dbPath).snapshotChanges().pipe(
      map(changes =>
        changes.map(c => {
          const supplier = c.payload.val() as Supplier;
          return { ...supplier, id: c.payload.key as string }; // 'id' ajouté après
        })
      )
    );
  }
  
  create(supplier: Supplier) {
    return this.db.list(this.dbPath).push(supplier);
  }

  update(id: string, supplier: Supplier) {
    return this.db.list(this.dbPath).update(id, supplier);
  }

  delete(id: string) {
    return this.db.list(this.dbPath).remove(id);
  }
}