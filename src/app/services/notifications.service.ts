import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { switchMap, map, tap } from 'rxjs/operators';

interface Notification {
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: number;
  id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);
  
  notifications$ = this.notificationsSubject.asObservable();
  unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(
    private db: AngularFireDatabase,
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.initNotifications();
  }

  private initNotifications() {
    this.authService.getCurrentUser.pipe(
      switchMap(user => {
        if (user) {
          return this.db.list(`notifications/${user.uid}`, ref => 
            ref.orderByChild('createdAt').limitToLast(20)
          ).valueChanges().pipe(
            map((notifications: any[]) => 
              notifications.map((n, i) => ({ ...n, id: Object.keys(n)[0] }))
            )
          );
        }
        return of([]);
      })
    ).subscribe(notifications => {
      this.notificationsSubject.next(notifications);
      this.unreadCountSubject.next(
        notifications.filter(n => !n.read).length
      );
    });
  }

  sendNotification(title: string, message: string, type: string = 'info', sendEmail: boolean = false) {
    return this.authService.getCurrentUser.pipe(
      switchMap(user => {
        if (!user) return of(null);
          
        const notificationData = {
          userId: user.uid,
          title,
          message,
          type,
          sendEmail,
          emailSubject: title,
          emailContent: message
        };
        
        return this.http.post('/api/notifications/send', notificationData);
      })
    );
  }

  markAsRead(notificationId: string) {
    return this.authService.getCurrentUser.pipe(
      switchMap(user => {
        if (!user) return of(null);
        return this.http.put(`/api/notifications/mark-read/${user.uid}/${notificationId}`, {});
      }),
      tap(() => {
        // Update local state
        const notifications = this.notificationsSubject.value.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        );
        this.notificationsSubject.next(notifications);
        this.unreadCountSubject.next(
          notifications.filter(n => !n.read).length
        );
      })
    );
  }

  getNotifications(): Observable<Notification[]> {
    return this.notifications$;
  }

  getUnreadCount(): Observable<number> {
    return this.unreadCount$;
  }
}