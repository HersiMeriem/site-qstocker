import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';


export interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  getUnreadCount: any;
  markAsRead(id: any) {
    throw new Error('Method not implemented.');
  }

  private notificationSubject = new Subject<Notification>();
  // Explicitly type notification$ as Observable<Notification>
  notification$: Observable<Notification> = this.notificationSubject.asObservable();

  success(message: string): void {
    this.notificationSubject.next({ type: 'success', message });
  }

  error(message: string): void {
    this.notificationSubject.next({ type: 'error', message });
  }

  info(message: string): void {
    this.notificationSubject.next({ type: 'info', message });
  }
}