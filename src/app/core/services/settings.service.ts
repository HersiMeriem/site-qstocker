import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StockSetting } from '../models/settings.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly SETTINGS_PATH = 'settings/stock';

  constructor(private db: AngularFireDatabase) {}

  getSettings(): Observable<StockSetting> {
    return this.db.object<StockSetting>(this.SETTINGS_PATH).valueChanges().pipe(
      map(settings => settings || this.getDefaultSettings())
    );
  }

  updateSettings(settings: Partial<StockSetting>): Promise<void> {
    const updates = {
      ...settings,
      lastModified: {
        by: 'current-user', // À remplacer par le vrai utilisateur
        at: Date.now()
      }
    };
    return this.db.object(this.SETTINGS_PATH).update(updates);
  }

  private getDefaultSettings(): StockSetting {
    return {
  lowStockThreshold: 10,
  criticalStockThreshold: 5,
  autoReorder: true,
  emailNotifications: true,
  notificationEmails: ['stock@entreprise.com'],
  notificationFrequency: 'daily',
  autoBackup: 'weekly',
  theme: 'light',
  language: 'fr',
  backupRetention: 30,
  aiSettings: {
    aiEnabled: false,
    predictionDays: 7,
    modelType: 'linear',
    anomalyDetection: false,
    sensitivity: 'medium',
    chatbotEnabled: true,
    chatbotLanguage: 'fr'
  },
  lastModified: {
    by: 'system',
    at: Date.now()
  },
  sessionTimeout: 0,
  twoFactorAuth: false,
  
};
  }
}