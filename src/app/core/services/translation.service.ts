import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface TranslationDictionary {
  [key: string]: string;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private currentLang = new BehaviorSubject<string>('fr');
  private translations: { [lang: string]: TranslationDictionary } = {
    fr: this.getFrenchTranslations(),
    en: this.getEnglishTranslations(),
    ar: this.getArabicTranslations()
  };

  constructor() {
    this.initializeLanguage();
  }

  private initializeLanguage(): void {
    const savedLang = localStorage.getItem('lang');
    const browserLang = navigator.language.substring(0, 2);
    const defaultLang = this.translations[browserLang] ? browserLang : 'fr';
    this.setLanguage(savedLang || defaultLang);
  }

  private getFrenchTranslations(): TranslationDictionary {
    return {
      // Général
      'COMMON.SAVE': 'Enregistrer',
      'COMMON.CANCEL': 'Annuler',
      'COMMON.LOADING': 'Chargement...',
      'COMMON.CLOSE': 'Fermer',
      'COMMON.CONFIRM': 'Confirmer',
      'COMMON.UNITS': 'unités',
      'COMMON.BY': 'Par',
      
      // Paramètres
      'SETTINGS.TITLE': 'Paramètres',
      'SETTINGS.EXPORT': 'Exporter',
      'SETTINGS.IMPORT': 'Importer',
      'SETTINGS.LAST_MODIFIED': 'Dernière modification',
      'SETTINGS.SAVED': 'Paramètres enregistrés avec succès',
      'SETTINGS.SAVE_ERROR': 'Erreur lors de la sauvegarde des paramètres',
      'SETTINGS.RESET': 'Paramètres réinitialisés',
      'SETTINGS.EXPORT_TITLE': 'Exporter les paramètres',
      'SETTINGS.EXPORT_FORMAT': 'Format d\'exportation',
      'SETTINGS.INCLUDE_BACKUP_HISTORY': 'Inclure l\'historique des sauvegardes',
      'SETTINGS.INCLUDE_AUDIT_LOGS': 'Inclure les journaux d\'audit',
      'SETTINGS.EXPORTED': 'Paramètres exportés avec succès',
      'SETTINGS.IMPORT_TITLE': 'Importer les paramètres',
      'SETTINGS.IMPORT_MESSAGE': 'Voulez-vous vraiment importer ces paramètres?',
      'SETTINGS.IMPORTED': 'Paramètres importés avec succès',
      'SETTINGS.IMPORT_INVALID': 'Fichier de paramètres invalide',
      
      // Onglet Général
      'GENERAL.TITLE': 'Paramètres généraux',
      'GENERAL.LOW_STOCK_THRESHOLD': 'Seuil de stock bas',
      'GENERAL.CRITICAL_STOCK_THRESHOLD': 'Seuil de stock critique',
      'GENERAL.AUTO_REORDER': 'Réapprovisionnement automatique',
      'GENERAL.AUTO_REORDER_HELP': 'Le système passera automatiquement des commandes lorsque le stock est bas',
      
      // Onglet Notifications
      'NOTIFICATIONS.TITLE': 'Notifications',
      'NOTIFICATIONS.EMAIL_NOTIFICATIONS': 'Notifications par email',
      'NOTIFICATIONS.EMAILS': 'Emails de notification',
      'NOTIFICATIONS.EMAIL_PLACEHOLDER': 'email@exemple.com',
      'NOTIFICATIONS.ADD_EMAIL': 'Ajouter un email',
      'NOTIFICATIONS.FREQUENCY': 'Fréquence des notifications',
      'NOTIFICATIONS.DAILY': 'Quotidienne',
      'NOTIFICATIONS.WEEKLY': 'Hebdomadaire',
      'NOTIFICATIONS.MONTHLY': 'Mensuelle',
      
      'AI.TITLE': 'Intelligence Artificielle',
      'AI.ENABLE_AI': 'Activer les fonctionnalités IA',
      'AI.PREDICTION_SETTINGS': 'Paramètres de prédiction',
      'AI.PREDICTION_DAYS': 'Jours à prédire',
      'AI.MODEL_TYPE': 'Type de modèle',
      'AI.LINEAR_MODEL': 'Modèle linéaire',
      'AI.NEURAL_NET': 'Réseau neuronal',
      'AI.ANOMALY_DETECTION': 'Détection d\'anomalies',
      'AI.SENSITIVITY': 'Sensibilité',
      'AI.LOW': 'Basse',
      'AI.MEDIUM': 'Moyenne',
      'AI.HIGH': 'Haute',
      'AI.ENABLE_CHATBOT': 'Activer l\'assistant vocal',
      'AI.CHATBOT_LANGUAGE': 'Langue de l\'assistant',
      
      // Onglet Sauvegarde
      'BACKUP.TITLE': 'Sauvegarde',
      'BACKUP.CREATE': 'Créer une sauvegarde',
      'BACKUP.AUTO_BACKUP': 'Sauvegarde automatique',
      'BACKUP.DISABLED': 'Désactivée',
      'BACKUP.DAILY': 'Quotidienne',
      'BACKUP.WEEKLY': 'Hebdomadaire',
      'BACKUP.RETENTION': 'Rétention des sauvegardes',
      'BACKUP.DAYS': 'jours',
      'BACKUP.HISTORY': 'Historique des sauvegardes',
      'BACKUP.NO_BACKUPS': 'Aucune sauvegarde disponible',
      'BACKUP.CONFIRM_TITLE': 'Confirmer la sauvegarde',
      'BACKUP.CONFIRM_MESSAGE': 'Voulez-vous vraiment créer une nouvelle sauvegarde?',
      'BACKUP.CREATED': 'Sauvegarde créée avec succès',
      'BACKUP.RESTORE': 'Restaurer',
      'BACKUP.RESTORE_TITLE': 'Confirmer la restauration',
      'BACKUP.RESTORE_MESSAGE': 'Voulez-vous vraiment restaurer cette sauvegarde?',
      'BACKUP.RESTORED': 'Sauvegarde restaurée avec succès',
      'BACKUP.DELETE_TITLE': 'Confirmer la suppression',
      'BACKUP.DELETE_MESSAGE': 'Voulez-vous vraiment supprimer cette sauvegarde?',
      'BACKUP.DELETED': 'Sauvegarde supprimée avec succès',
      
      // Onglet Avancé
      'ADVANCED.TITLE': 'Paramètres avancés',
      'ADVANCED.THEME': 'Thème',
      'ADVANCED.LIGHT_THEME': 'Clair',
      'ADVANCED.DARK_THEME': 'Sombre',
      'ADVANCED.SYSTEM_THEME': 'Système',
      'ADVANCED.LANGUAGE': 'Langue',
      'ADVANCED.AUDIT_LOG': 'Journal d\'audit',
      
      // Validation
      'VALIDATION.REQUIRED': 'Ce champ est requis',
      'VALIDATION.INVALID_EMAIL': 'Email invalide'
    };
  }

  private getEnglishTranslations(): TranslationDictionary {
    return {
      // General
      'COMMON.SAVE': 'Save',
      'COMMON.CANCEL': 'Cancel',
      'COMMON.LOADING': 'Loading...',
      'COMMON.CLOSE': 'Close',
      'COMMON.CONFIRM': 'Confirm',
      'COMMON.UNITS': 'units',
      'COMMON.BY': 'By',
      
      // Settings
      'SETTINGS.TITLE': 'Settings',
      'SETTINGS.EXPORT': 'Export',
      'SETTINGS.IMPORT': 'Import',
      'SETTINGS.LAST_MODIFIED': 'Last modified',
      'SETTINGS.SAVED': 'Settings saved successfully',
      'SETTINGS.SAVE_ERROR': 'Error saving settings',
      'SETTINGS.RESET': 'Settings reset',
      'SETTINGS.EXPORT_TITLE': 'Export Settings',
      'SETTINGS.EXPORT_FORMAT': 'Export format',
      'SETTINGS.INCLUDE_BACKUP_HISTORY': 'Include backup history',
      'SETTINGS.INCLUDE_AUDIT_LOGS': 'Include audit logs',
      'SETTINGS.EXPORTED': 'Settings exported successfully',
      'SETTINGS.IMPORT_TITLE': 'Import Settings',
      'SETTINGS.IMPORT_MESSAGE': 'Do you really want to import these settings?',
      'SETTINGS.IMPORTED': 'Settings imported successfully',
      'SETTINGS.IMPORT_INVALID': 'Invalid settings file',
      
      // General Tab
      'GENERAL.TITLE': 'General Settings',
      'GENERAL.LOW_STOCK_THRESHOLD': 'Low stock threshold',
      'GENERAL.CRITICAL_STOCK_THRESHOLD': 'Critical stock threshold',
      'GENERAL.AUTO_REORDER': 'Auto reorder',
      'GENERAL.AUTO_REORDER_HELP': 'System will automatically place orders when stock is low',
      
      // Notifications Tab
      'NOTIFICATIONS.TITLE': 'Notifications',
      'NOTIFICATIONS.EMAIL_NOTIFICATIONS': 'Email notifications',
      'NOTIFICATIONS.EMAILS': 'Notification emails',
      'NOTIFICATIONS.EMAIL_PLACEHOLDER': 'email@example.com',
      'NOTIFICATIONS.ADD_EMAIL': 'Add email',
      'NOTIFICATIONS.FREQUENCY': 'Notification frequency',
      'NOTIFICATIONS.DAILY': 'Daily',
      'NOTIFICATIONS.WEEKLY': 'Weekly',
      'NOTIFICATIONS.MONTHLY': 'Monthly',
      
      // Security Tab
      'AI.TITLE': 'Artificial Intelligence',
    'AI.ENABLE_AI': 'Enable AI Features',
    'AI.PREDICTION_SETTINGS': 'Prediction Settings',
    'AI.PREDICTION_DAYS': 'Days to Predict',
    'AI.MODEL_TYPE': 'Model Type',
    'AI.LINEAR_MODEL': 'Linear Model',
    'AI.NEURAL_NET': 'Neural Network',
    'AI.ANOMALY_DETECTION': 'Anomaly Detection',
    'AI.SENSITIVITY': 'Sensitivity',
    'AI.LOW': 'Low',
    'AI.MEDIUM': 'Medium',
    'AI.HIGH': 'High',
    'AI.ENABLE_CHATBOT': 'Enable Voice Assistant',
    'AI.CHATBOT_LANGUAGE': 'Assistant Language',
      
      // Backup Tab
      'BACKUP.TITLE': 'Backup',
      'BACKUP.CREATE': 'Create backup',
      'BACKUP.AUTO_BACKUP': 'Auto backup',
      'BACKUP.DISABLED': 'Disabled',
      'BACKUP.DAILY': 'Daily',
      'BACKUP.WEEKLY': 'Weekly',
      'BACKUP.RETENTION': 'Backup retention',
      'BACKUP.DAYS': 'days',
      'BACKUP.HISTORY': 'Backup history',
      'BACKUP.NO_BACKUPS': 'No backups available',
      'BACKUP.CONFIRM_TITLE': 'Confirm backup',
      'BACKUP.CONFIRM_MESSAGE': 'Do you really want to create a new backup?',
      'BACKUP.CREATED': 'Backup created successfully',
      'BACKUP.RESTORE': 'Restore',
      'BACKUP.RESTORE_TITLE': 'Confirm restore',
      'BACKUP.RESTORE_MESSAGE': 'Do you really want to restore this backup?',
      'BACKUP.RESTORED': 'Backup restored successfully',
      'BACKUP.DELETE_TITLE': 'Confirm deletion',
      'BACKUP.DELETE_MESSAGE': 'Do you really want to delete this backup?',
      'BACKUP.DELETED': 'Backup deleted successfully',
      
      // Advanced Tab
      'ADVANCED.TITLE': 'Advanced Settings',
      'ADVANCED.THEME': 'Theme',
      'ADVANCED.LIGHT_THEME': 'Light',
      'ADVANCED.DARK_THEME': 'Dark',
      'ADVANCED.SYSTEM_THEME': 'System',
      'ADVANCED.LANGUAGE': 'Language',
      'ADVANCED.AUDIT_LOG': 'Audit log',
      
      // Validation
      'VALIDATION.REQUIRED': 'This field is required',
      'VALIDATION.INVALID_EMAIL': 'Invalid email'
    };
  }



  private getArabicTranslations(): TranslationDictionary {
    return {
      // General
      'COMMON.SAVE': 'حفظ',
      'COMMON.CANCEL': 'إلغاء',
      'COMMON.LOADING': 'جار التحميل...',
      'COMMON.CLOSE': 'إغلاق',
      'COMMON.CONFIRM': 'تأكيد',
      'COMMON.UNITS': 'وحدات',
      'COMMON.BY': 'بواسطة',
      
      // Settings
      'SETTINGS.TITLE': 'الإعدادات',
      'SETTINGS.EXPORT': 'تصدير',
      'SETTINGS.IMPORT': 'استيراد',
      'SETTINGS.LAST_MODIFIED': 'آخر تعديل',
      'SETTINGS.SAVED': 'تم حفظ الإعدادات بنجاح',
      'SETTINGS.SAVE_ERROR': 'خطأ في حفظ الإعدادات',
      'SETTINGS.RESET': 'تم إعادة تعيين الإعدادات',
      'SETTINGS.EXPORT_TITLE': 'تصدير الإعدادات',
      'SETTINGS.EXPORT_FORMAT': 'تنسيق التصدير',
      'SETTINGS.INCLUDE_BACKUP_HISTORY': 'تضمين سجل النسخ الاحتياطي',
      'SETTINGS.INCLUDE_AUDIT_LOGS': 'تضمين سجلات التدقيق',
      'SETTINGS.EXPORTED': 'تم تصدير الإعدادات بنجاح',
      'SETTINGS.IMPORT_TITLE': 'استيراد الإعدادات',
      'SETTINGS.IMPORT_MESSAGE': 'هل تريد حقًا استيراد هذه الإعدادات؟',
      'SETTINGS.IMPORTED': 'تم استيراد الإعدادات بنجاح',
      'SETTINGS.IMPORT_INVALID': 'ملف إعدادات غير صالح',
      
      // General Tab
      'GENERAL.TITLE': 'الإعدادات العامة',
      'GENERAL.LOW_STOCK_THRESHOLD': 'حد المخزون المنخفض',
      'GENERAL.CRITICAL_STOCK_THRESHOLD': 'حد المخزون الحرج',
      'GENERAL.AUTO_REORDER': 'إعادة الطلب التلقائي',
      'GENERAL.AUTO_REORDER_HELP': 'سيقوم النظام تلقائيًا بوضع الطلبات عندما يكون المخزون منخفضًا',
      
      // Notifications Tab
      'NOTIFICATIONS.TITLE': 'الإشعارات',
      'NOTIFICATIONS.EMAIL_NOTIFICATIONS': 'إشعارات البريد الإلكتروني',
      'NOTIFICATIONS.EMAILS': 'رسائل البريد الإلكتروني للإشعارات',
      'NOTIFICATIONS.EMAIL_PLACEHOLDER': 'email@example.com',
      'NOTIFICATIONS.ADD_EMAIL': 'إضافة بريد إلكتروني',
      'NOTIFICATIONS.FREQUENCY': 'تكرار الإشعارات',
      'NOTIFICATIONS.DAILY': 'يومي',
      'NOTIFICATIONS.WEEKLY': 'أسبوعي',
      'NOTIFICATIONS.MONTHLY': 'شهري',
      
      // Security Tab
      'AI.TITLE': 'الذكاء الاصطناعي',
    'AI.ENABLE_AI': 'تفعيل ميزات الذكاء الاصطناعي',
    'AI.PREDICTION_SETTINGS': 'إعدادات التنبؤ',
    'AI.PREDICTION_DAYS': 'أيام التنبؤ',
    'AI.MODEL_TYPE': 'نوع النموذج',
    'AI.LINEAR_MODEL': 'نموذج خطي',
    'AI.NEURAL_NET': 'شبكة عصبية',
    'AI.ANOMALY_DETECTION': 'كشف الشذوذ',
    'AI.SENSITIVITY': 'الحساسية',
    'AI.LOW': 'منخفضة',
    'AI.MEDIUM': 'متوسطة',
    'AI.HIGH': 'عالية',
    'AI.ENABLE_CHATBOT': 'تفعيل المساعد الصوتي',
    'AI.CHATBOT_LANGUAGE': 'لغة المساعد',
      
      // Backup Tab
      'BACKUP.TITLE': 'النسخ الاحتياطي',
      'BACKUP.CREATE': 'إنشاء نسخة احتياطية',
      'BACKUP.AUTO_BACKUP': 'نسخ احتياطي تلقائي',
      'BACKUP.DISABLED': 'معطل',
      'BACKUP.DAILY': 'يومي',
      'BACKUP.WEEKLY': 'أسبوعي',
      'BACKUP.RETENTION': 'الاحتفاظ بالنسخ الاحتياطية',
      'BACKUP.DAYS': 'أيام',
      'BACKUP.HISTORY': 'سجل النسخ الاحتياطية',
      'BACKUP.NO_BACKUPS': 'لا توجد نسخ احتياطية متاحة',
      'BACKUP.CONFIRM_TITLE': 'تأكيد النسخ الاحتياطي',
      'BACKUP.CONFIRM_MESSAGE': 'هل تريد حقًا إنشاء نسخة احتياطية جديدة؟',
      'BACKUP.CREATED': 'تم إنشاء النسخة الاحتياطية بنجاح',
      'BACKUP.RESTORE': 'استعادة',
      'BACKUP.RESTORE_TITLE': 'تأكيد الاستعادة',
      'BACKUP.RESTORE_MESSAGE': 'هل تريد حقًا استعادة هذه النسخة الاحتياطية؟',
      'BACKUP.RESTORED': 'تم استعادة النسخة الاحتياطية بنجاح',
      'BACKUP.DELETE_TITLE': 'تأكيد الحذف',
      'BACKUP.DELETE_MESSAGE': 'هل تريد حقًا حذف هذه النسخة الاحتياطية؟',
      'BACKUP.DELETED': 'تم حذف النسخة الاحتياطية بنجاح',
      
      // Advanced Tab
      'ADVANCED.TITLE': 'الإعدادات المتقدمة',
      'ADVANCED.THEME': 'السمة',
      'ADVANCED.LIGHT_THEME': 'فاتح',
      'ADVANCED.DARK_THEME': 'غامق',
      'ADVANCED.SYSTEM_THEME': 'النظام',
      'ADVANCED.LANGUAGE': 'اللغة',
      'ADVANCED.AUDIT_LOG': 'سجل التدقيق',
      
      // Validation
      'VALIDATION.REQUIRED': 'هذا الحقل مطلوب',
      'VALIDATION.INVALID_EMAIL': 'بريد إلكتروني غير صالح'
    };
  }

  getCurrentLanguage(): string {
    return this.currentLang.value;
  }

  getLanguageChanges(): Observable<string> {
    return this.currentLang.asObservable();
  }

  setLanguage(lang: string): void {
    if (this.translations[lang]) {
      this.currentLang.next(lang);
      localStorage.setItem('lang', lang);
      document.documentElement.lang = lang;
      
      // Adjust direction for RTL languages
      if (lang === 'ar') {
        document.documentElement.dir = 'rtl';
      } else {
        document.documentElement.dir = 'ltr';
      }
    }
  }

  translate(key: string): string {
    const lang = this.currentLang.value;
    return this.translations[lang]?.[key] || key;
  }

  getAvailableLanguages(): string[] {
    return Object.keys(this.translations);
  }

  getLanguageName(langCode: string): string {
    const names: {[key: string]: string} = {
      'fr': 'Français',
      'en': 'English',
      'ar': 'العربية'
    };
    return names[langCode] || langCode;
  }
}