import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  constructor(private db: AngularFireDatabase) {}

  getUsers() {
    return this.db.list('users').valueChanges();
  }

  getProducts() {
    return this.db.list('products').valueChanges();
  }

  updateProduct(productId: string, data: any) {
    return this.db.object(`products/${productId}`).update(data);
  }

  deleteProduct(productId: string) {
    return this.db.object(`products/${productId}`).remove();
  }
}