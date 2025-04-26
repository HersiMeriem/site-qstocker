import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {
  constructor(
    private afAuth: AngularFireAuth,
    private db: AngularFireDatabase
  ) {}

  async getCurrentUser() {
    return await this.afAuth.currentUser;
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user || !user.email) throw new Error('User not authenticated');
    
    await this.afAuth.signInWithEmailAndPassword(user.email, currentPassword);
    return user.updatePassword(newPassword);
  }

  getProfile(uid: string): Observable<any> {
    return this.db.object(`users/${uid}`).valueChanges();
  }

  async updateProfile(uid: string, data: any): Promise<void> {
    return this.db.object(`users/${uid}`).update(data);
  }

  async uploadProfilePicture(uid: string, file: File): Promise<string> {
    const filePath = `profile-pictures/${uid}/${file.name}`;
    const fileRef = this.db.list(`profile-pictures/${uid}`);
    const snapshot = await fileRef.push({ name: file.name, size: file.size, type: file.type });
    return snapshot.key || ''; // Retourner l'URL ou le chemin du fichier
  }

  logActivity(uid: string, action: string) {
    const timestamp = new Date().toISOString();
    this.db.list(`activities/${uid}`).push({ action, timestamp });
  }

  getRecentActivities(uid: string): Observable<any[]> {
    return this.db.list(`activities/${uid}`).valueChanges();
  }

  getNotifications(uid: string): Observable<any[]> {
    return this.db.list(`notifications/${uid}`).valueChanges();
  }

  markNotificationAsRead(uid: string, notificationId: string) {
    return this.db.object(`notifications/${uid}/${notificationId}`).update({ read: true });
  }

  getMessages(uid: string): Observable<any[]> {
    return this.db.list(`messages/${uid}`).valueChanges();
  }

  sendMessage(uid: string, text: string) {
    const timestamp = new Date().toISOString();
    this.db.list(`messages/${uid}`).push({ sender: 'Vous', text, timestamp });
  }

  savePreferences(uid: string, preferences: any) {
    return this.db.object(`preferences/${uid}`).update(preferences);
  }

  logProfileChange(uid: string, change: any) {
    return this.db.list(`profile-history/${uid}`).push(change);
  }

  getProfileHistory(uid: string): Observable<any[]> {
    return this.db.list(`profile-history/${uid}`).valueChanges();
  }

  getStats(uid: string): Observable<any> {
    return this.db.object(`stats/${uid}`).valueChanges();
  }

  logout() {
    return this.afAuth.signOut();
  }
}