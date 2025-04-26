// stock-manager-profile.service.ts
import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StockManagerProfileService {

  constructor(
    private afAuth: AngularFireAuth,
    private db: AngularFireDatabase
  ) { }

  private profilePhotoSource = new BehaviorSubject<string>('assets/images/responsable.png');
  currentProfilePhoto = this.profilePhotoSource.asObservable();

  updateProfilePhoto(photoUrl: string) {
    this.profilePhotoSource.next(photoUrl);
  }

  async getStockManagerProfile(userId: string): Promise<any> {
    const snapshot = await this.db.object(`stockManagers/${userId}`).query.once('value');
    return snapshot.val();
  }

  async updateStockManagerProfile(userId: string, profileData: any): Promise<void> {
    await this.db.object(`stockManagers/${userId}`).update(profileData);
  }

  async logStockManagerActivity(userId: string, action: string, details: string = ''): Promise<void> {
    const newActivity = {
      action,
      details,
      timestamp: new Date().toISOString()
    };
    await this.db.list(`stockManagers/${userId}/activityLog`).push(newActivity);
  }
}