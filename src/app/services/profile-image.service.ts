import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProfileImageService {
  private defaultImage = 'assets/images/administrateur.png';
  private profileImageSource = new BehaviorSubject<string>(this.defaultImage);
  
  currentProfileImage = this.profileImageSource.asObservable();

  constructor() { }

  changeProfileImage(imageUrl: string) {
    this.profileImageSource.next(imageUrl || this.defaultImage);
  }

  getCurrentImage(): string {
    return this.profileImageSource.value;
  }
}