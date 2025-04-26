// profile-photo.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProfilePhotoService {
  private photoUrlSource = new BehaviorSubject<string>('assets/images/responsable.png');
  currentPhotoUrl = this.photoUrlSource.asObservable();

  constructor() { }

  changePhoto(url: string) {
    this.photoUrlSource.next(url);
  }
}