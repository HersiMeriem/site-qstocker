import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface User {
  uid: string;
  name: string;
  email: string;
  permissions: string[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  currentUser: User = {
    uid: 'user123',
    name: 'Responsable Stock',
    email: 'contact.qstocker@gmail.com',
    permissions: [
      'settings:general',
      'settings:notifications',
      'settings:security',
      'settings:backup'
    ]
  };

  constructor(
    private afAuth: AngularFireAuth,
    private db: AngularFireDatabase
  ) {
    this.afAuth.authState.pipe(
      switchMap(user => {
        if (user) {
          return this.db.object<User>(`users/${user.uid}`).valueChanges();
        }
        return of(null);
      })
    ).subscribe(user => {
      if (user) {
        this.currentUser = user;
      }
    });
  }

  hasPermission(permission: string): boolean {
    if (!permission) return true;
    return this.currentUser.permissions.includes(permission);
  }

  async changePassword(newPassword: string): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (user) {
      await user.updatePassword(newPassword);
    }
  }

  getCurrentUserId(): string {
    return this.currentUser.uid;
  }

  getCurrentUserName(): string {
    return this.currentUser.name;
  }
}