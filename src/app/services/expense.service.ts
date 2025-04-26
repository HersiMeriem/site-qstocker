import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Expense } from '../models/expense';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private dbPath = '/expenses';

  constructor(private db: AngularFireDatabase) { }

  getExpenses(): Observable<Expense[]> {
    return this.db.list<Expense>(this.dbPath)
      .snapshotChanges()
      .pipe(
        map(changes => 
          changes.map(c => {
            const payload = c.payload.val();
            return {
              id: c.payload.key || '',
              date: payload?.date || '',
              amount: payload?.amount || 0,
              category: payload?.category || '',
              description: payload?.description || '',
              paymentMethod: payload?.paymentMethod || 'Carte'
            };
          })
        )
      );
  }

  addExpense(expense: Omit<Expense, 'id'>): Promise<void> {
    const id = this.db.createPushId();
    return this.db.list(this.dbPath).set(id, expense);
  }

  deleteExpense(id: string): Promise<void> {
    return this.db.list(this.dbPath).remove(id);
  }

  updateExpense(id: string, expense: Partial<Expense>): Promise<void> {
    return this.db.list(this.dbPath).update(id, expense);
  }

  
}