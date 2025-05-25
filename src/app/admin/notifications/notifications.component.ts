import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { Router } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class NotificationsComponent implements OnInit, OnDestroy {
  showNotifications = false;
  notifications: any[] = [];
  unreadCount = 0;
  private notificationsSub: Subscription = new Subscription();
  private unreadCountSub: Subscription = new Subscription();

  constructor(
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.listenForUnreadCount();
  }

  ngOnDestroy(): void {
    this.notificationsSub.unsubscribe();
    this.unreadCountSub.unsubscribe();
  }

  loadNotifications(): void {
    this.notificationsSub = this.notificationService.getNotifications().subscribe({
      next: (notifs) => {
        // On s'assure que les notifications ont bien un ID
        this.notifications = notifs.map(notif => ({
          ...notif,
          id: notif.id || notif.$key // Selon votre structure Firebase
        }));
        console.log('Notifications loaded:', this.notifications); // Debug
      },
      error: (err) => console.error('Error loading notifications:', err)
    });
  }
  

  listenForUnreadCount(): void {
    this.unreadCountSub = this.notificationService.unreadCount$.subscribe(count => {
      this.unreadCount = count;
    });
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (!this.showNotifications && this.unreadCount > 0) {
      this.markAllAsRead();
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().catch(err => {
      console.error('Error marking all as read:', err);
    });
  }

  clearAll(): void {
    this.notificationService.clearAll().catch(err => {
      console.error('Error clearing notifications:', err);
    });
  }



getNotificationIcon(type: string): string {
  switch(type) {
    case 'stock-out': return 'fas fa-exclamation-triangle text-danger';
    case 'low-stock': return 'fas fa-box-open text-warning';
    case 'sale': return 'fas fa-shopping-cart text-success';
    case 'product-sold': return 'fas fa-cash-register text-success';
    case 'success': return 'fas fa-check-circle text-success';
    case 'error': return 'fas fa-times-circle text-danger';
    case 'info': return 'fas fa-info-circle text-primary';
    default: return 'fas fa-bell text-primary';
  }
}

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notifications-wrapper')) {
      this.showNotifications = false;
    }
  }

 markAsRead(notificationId: string): void {
    console.log('Marking as read:', notificationId); // Debug
    if (!notificationId) {
      console.error('No notification ID provided');
      return;
    }

    this.notificationService.markAsRead(notificationId).then(() => {
      // Mise à jour optimiste de l'interface
      const index = this.notifications.findIndex(n => n.id === notificationId);
      if (index !== -1) {
        this.notifications[index].read = true;
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      }
    }).catch(err => {
      console.error('Error marking notification as read:', err);
    });
  }

  deleteNotification(notificationId: string): void {
    console.log('Deleting notification:', notificationId); // Debug
    if (!notificationId) {
      console.error('No notification ID provided');
      return;
    }

    this.notificationService.deleteNotification(notificationId).then(() => {
      // Mise à jour optimiste de l'interface
      this.notifications = this.notifications.filter(n => n.id !== notificationId);
      if (this.notifications.find(n => n.id === notificationId && !n.read)) {
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      }
    }).catch(err => {
      console.error('Error deleting notification:', err);
    });
  }

  handleNotificationClick(notification: any): void {
    if (!notification.read) {
      this.markAsRead(notification.id);
    }
    
    if (notification.productId) {
      this.router.navigate(['/admin/details-products', notification.productId]);
    }
    this.showNotifications = false;
  }
}