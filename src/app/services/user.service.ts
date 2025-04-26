import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { BehaviorSubject, map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private usersSource = new BehaviorSubject<any[]>([]);
  users$ = this.usersSource.asObservable();

  constructor(private db: AngularFireDatabase) {
    this.db.list('users').valueChanges().subscribe(users => {
      this.usersSource.next(users);
    });
  }



getUserStats(): Observable<any> {
  return this.users$.pipe(
    map(users => {
      return {
        total: users.length,
        byStatus: {
          approved: users.filter(u => u.status === 'approved').length,
          pending: users.filter(u => u.status === 'pending').length,
          blocked: users.filter(u => u.status === 'blocked').length
        },
        lastUpdated: new Date().toISOString()
      };
    })
  );
}
}
