import { Injectable } from '@angular/core';
import { of } from 'rxjs';

interface Activity {
  type: 'sales' | 'stock' | 'alerts' | 'system';
  icon: string;
  message: string;
  time: Date | string;
  user: string;
  location?: string;
  product?: any;
  amount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  private activities: Activity[] = [
    {
      type: 'sales',
      icon: 'shopping_cart',
      message: 'Nouvelle vente enregistrée - REF-12345',
      time: new Date(),
      user: 'Mohamed Ali',
      amount: 450.50
    },
    {
      type: 'stock',
      icon: 'inventory',
      message: 'Stock mis à jour - Produit ABC',
      time: new Date(Date.now() - 1000 * 60 * 30),
      user: 'Système',
      product: { id: 'ABC', name: 'Produit Alpha' }
    },
    {
      type: 'alerts',
      icon: 'warning',
      message: 'Alerte stock bas - Produit XYZ',
      time: new Date(Date.now() - 1000 * 60 * 120),
      user: 'Système',
      location: 'Entrepôt B'
    },
    {
      type: 'system',
      icon: 'person_add',
      message: 'Nouveau client enregistré',
      time: new Date(Date.now() - 1000 * 60 * 60 * 5),
      user: 'Système'
    },
    {
      type: 'system',
      icon: 'update',
      message: 'Mise à jour système effectuée',
      time: new Date(Date.now() - 1000 * 60 * 60 * 24),
      user: 'Administrateur'
    }
  ];

  constructor() {}

  getRecentActivities() {
    return of([...this.activities].sort((a, b) => 
      new Date(b.time).getTime() - new Date(a.time).getTime()
    ));
  }

  logActivity(message: string, type: 'sales' | 'stock' | 'alerts' | 'system' = 'system') {
    const newActivity: Activity = {
      type,
      icon: 'info',
      message,
      time: new Date(),
      user: 'Système'
    };
    this.activities.unshift(newActivity);
    console.log('Activité enregistrée:', message);
  }
}