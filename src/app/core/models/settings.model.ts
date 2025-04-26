// src/app/core/models/stock-settings.model.ts
export interface StockSetting {
    // Paramètres généraux
    lowStockThreshold: number;
    criticalStockThreshold: number;
    autoReorder: boolean;
    
    // Notifications
    emailNotifications: boolean;
    notificationEmails: string[];
    notificationFrequency: 'daily' | 'weekly' | 'monthly';
    
    // Sécurité
    sessionTimeout: number;
    twoFactorAuth: boolean;
    
    // Sauvegarde
    autoBackup: 'disabled' | 'daily' | 'weekly';
    backupRetention: number;
    
    // Thème et langue
    theme: 'light' | 'dark' | 'system';
    language: string;
    
    // Paramètres IA
    aiSettings: {
      aiEnabled: boolean;
      predictionDays: number;
      modelType: 'linear' | 'neural';
      anomalyDetection: boolean;
      sensitivity: 'low' | 'medium' | 'high';
      chatbotEnabled: boolean;
      chatbotLanguage: string;
    };
    
    // Métadonnées
    lastModified: {
      by: string;
      at: number;
    };
  }