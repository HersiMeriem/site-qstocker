import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private profilePhotoSubject = new BehaviorSubject<string>('assets/default-profile.png');
  profilePhoto$ = this.profilePhotoSubject.asObservable();

  constructor(
    private db: AngularFireDatabase,
    private afAuth: AngularFireAuth
  ) {
    this.initProfilePhoto();
  }

  private async initProfilePhoto() {
    const user = await this.afAuth.currentUser;
    if (user) {
      this.db.object(`users/${user.uid}/photoUrl`).valueChanges().subscribe((photoUrl: any) => {
        this.updateProfilePhoto(photoUrl || 'assets/default-profile.png');
      });
    }
  }

  updateProfilePhoto(photoUrl: string) {
    this.profilePhotoSubject.next(photoUrl);
  }
}