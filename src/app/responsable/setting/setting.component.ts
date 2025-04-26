import { Component, OnInit, OnDestroy, Inject, ChangeDetectorRef, AfterViewChecked } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable, Subscription, from, of } from 'rxjs';
import { switchMap, map, take, catchError, tap } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { DOCUMENT } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { saveAs } from 'file-saver';
import { SettingsService } from '../../core/services/settings.service';
// Services
import { AuditLogService } from '../../core/services/audit-log.service';
import { UserService } from '../../core/services/user.service';
import { BackupService } from '../../core/services/backup.service';
import { ThemeService } from '../../core/services/theme.service';
import { TranslationService } from '../../core/services/translation.service';
import { StockSetting } from '../../core/models/settings.model'; // Import correct

// Components
import { SettingsExportDialogComponent } from '../../settings-export-dialog/settings-export-dialog.component';
import { Settings } from 'jspdf-autotable';

type SettingsTab = 'general' | 'notifications' | 'ai-settings' | 'backup' | 'advanced';
interface SettingsTabConfig {
  id: SettingsTab;  // Utilisez le type SettingsTab au lieu de string
  label: string;
  icon: string;
  permission?: string;
}



interface StockSettings {
  // Paramètres existants
  lowStockThreshold: number;
  criticalStockThreshold: number;
  autoReorder: boolean;
  emailNotifications: boolean;
  notificationEmails: string[];
  notificationFrequency: 'daily' | 'weekly' | 'monthly';
  sessionTimeout: number;
  twoFactorAuth: boolean;
  autoBackup: 'disabled' | 'daily' | 'weekly';
  theme: 'light' | 'dark' | 'system';
  language: string;
  backupRetention: number;

  inventoryAccessLevel?: 'full' | 'readonly' | 'restricted'; // Optionnel si non utilisé
  restrictedCategories?: string[]; // Optionnel si non utilisé
  approvalThreshold?: number; // Optionnel si non utilisé
  requireManagerApproval?: boolean; // Optionnel si non utilisé
  limitStockAdjustments?: boolean; // Optionnel si non utilisé
  
  // Nouveaux paramètres IA
  aiSettings: {
    aiEnabled: boolean;
    predictionDays: number;
    modelType: 'linear' | 'neural';
    anomalyDetection: boolean;
    sensitivity: 'low' | 'medium' | 'high';
    chatbotEnabled: boolean;
    chatbotLanguage: string;
  };
  lastModified: {
    by: string;
    at: number; // Timestamp
  };
}

interface Backup {
  id: string;
  timestamp: number;
  size: number;
  status: 'pending' | 'success' | 'error' | 'restoring' | 'restored';
  createdBy: string;
  type: 'manual' | 'auto';
}

interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  icon: string;
  permission?: string;
}

@Component({
  selector: 'app-settings',
  templateUrl: './setting.component.html',
  styleUrls: ['./setting.component.css']
})
export class SettingComponent implements OnInit, OnDestroy ,  AfterViewChecked {

  availableLanguages = ['fr', 'en', 'ar'];

  tabs: SettingsTabConfig[] = [
    { id: 'general', label: 'GENERAL.TITLE', icon: 'inventory_2' },
    { id: 'notifications', label: 'NOTIFICATIONS.TITLE', icon: 'notifications' },
    { id: 'ai-settings', label: 'AI.TITLE', icon: 'insights' },
    { id: 'backup', label: 'BACKUP.TITLE', icon: 'backup' },
    { id: 'advanced', label: 'ADVANCED.TITLE', icon: 'tune' }
  ];

  activeTab$ = new BehaviorSubject<string>('general');
  loading = true;
  saving = false;
  hasUnsavedChanges = false;
  settingsForm!: FormGroup;
  isMakingBackup = false;
  isRestoring = false;

  currentSettings!: StockSettings;
  backups: Backup[] = [];
  auditLogs: any[] = [];

  private subscriptions: Subscription[] = [];


  constructor(
    private db: AngularFireDatabase,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private settingsService: SettingsService,
    private fb: FormBuilder,
    private auditLogService: AuditLogService,
    public userService: UserService,
    private backupService: BackupService,
    public themeService: ThemeService,
    public translationService: TranslationService,
    private cdr: ChangeDetectorRef,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.initializeSettings();
    this.initializeForm();
    this.settingsForm = this.createForm();
  }


  ngOnInit(): void {
    this.loadData();
    setTimeout(() => {
      this.loading = false;
      this.cdr.detectChanges();
    }, 1000);
    this.initializeForm();
    this.loadSettings();
    this.loadBackups();
    this.setupFormListeners();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngAfterViewChecked(): void {
    this.fixTabHeight();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      general: this.fb.group({
        lowStockThreshold: [10, [Validators.required, Validators.min(1)]],
        criticalStockThreshold: [5, [Validators.required, Validators.min(0)]],
        autoReorder: [true]
      }),
      notifications: this.fb.group({
        emailNotifications: [true],
        notificationEmails: this.fb.array([
          this.fb.control('', [Validators.email, Validators.required])
        ]),
        notificationFrequency: ['daily']
      }),
      security: this.fb.group({
        sessionTimeout: [30, [Validators.required, Validators.min(1)]],
        twoFactorAuth: [false]
      }),
      aiSettings: this.fb.group({
        aiEnabled: [false],
        predictionDays: [7, [Validators.min(1), Validators.max(30)]],
        modelType: ['linear'],
        anomalyDetection: [false],
        sensitivity: ['medium'],
        chatbotEnabled: [true],
        chatbotLanguage: ['fr']
      }),
      backup: this.fb.group({
        autoBackup: ['weekly'],
        backupRetention: [30, [Validators.min(1), Validators.max(365)]]
      })
    });
  }

  private initializeSettings(): void {
    this.currentSettings = {
      lowStockThreshold: 10,
      criticalStockThreshold: 5,
      autoReorder: true,
      sessionTimeout: 30, // Ajouté
      twoFactorAuth: false, // Ajouté
      emailNotifications: true,
      notificationEmails: ['stock@entreprise.com'],
      notificationFrequency: 'daily',
      autoBackup: 'weekly',
      theme: 'light',
      language: 'fr',
      backupRetention: 30,
      
      // Nouveaux paramètres IA
      aiSettings: {
        aiEnabled: false,
        predictionDays: 7,
        modelType: 'linear',
        anomalyDetection: false,
        sensitivity: 'medium',
        chatbotEnabled: true,
        chatbotLanguage: 'fr'
      },
  
      // Dernière modification
      lastModified: {
        by: this.userService.getCurrentUserName(),
        at: Date.now()
      }
    };
  }

  private initializeForm(): void {
    this.settingsForm = this.fb.group({
      general: this.fb.group({
        lowStockThreshold: [10, [Validators.required, Validators.min(1)]],
        criticalStockThreshold: [5, [Validators.required, Validators.min(0)]],
        autoReorder: [true]
      }),
      notifications: this.fb.group({
        emailNotifications: [true],
        notificationEmails: this.fb.array([
          this.fb.control('', [Validators.email, Validators.required])
        ]),
        notificationFrequency: ['daily']
      }),
      aiSettings: this.fb.group({
        aiEnabled: [false],
        predictionDays: [7, [Validators.min(1), Validators.max(30)]],
        modelType: ['linear'],
        anomalyDetection: [false],
        sensitivity: ['medium'],
        chatbotEnabled: [true],
        chatbotLanguage: ['fr']
      }),
      backup: this.fb.group({
        autoBackup: ['weekly'],
        backupRetention: [30, [Validators.min(1), Validators.max(365)]]
      })
    });
  }
  
  get notificationEmailsArray(): FormArray {
    return this.settingsForm.get('notifications.notificationEmails') as FormArray;
  }

  get notificationEmailControls(): FormControl[] {
    return this.notificationEmailsArray.controls as FormControl[];
  }


  private fixTabHeight(): void {
    const tabBodies = document.querySelectorAll('.mat-tab-body');
    tabBodies.forEach(body => {
      (body as HTMLElement).style.height = 'auto';
      (body as HTMLElement).style.overflow = 'visible';
    });
  }


  
  private loadData(): void {
    this.loadSettings();
    this.loadBackups();
    this.loadAuditLogs();
    this.setupFormListeners();
  }


  get securityForm(): FormGroup { // Ajouté pour accéder au groupe security
    return this.settingsForm.get('security') as FormGroup;
  }


  private loadSettings(): void {
    const sub = this.settingsService.getSettings().subscribe(settings => {
      this.currentSettings = settings;
      this.applySettingsToForm(settings);
      this.loading = false;
      this.cdr.detectChanges();
    }, error => {
      console.error('Error loading settings:', error);
      this.showError('SETTINGS.LOAD_ERROR');
      this.loading = false;
      this.cdr.detectChanges();
    });
    this.subscriptions.push(sub);
  }

  private applySettingsToForm(settings: StockSettings): void {
    this.settingsForm.patchValue({
      general: {
        lowStockThreshold: settings.lowStockThreshold,
        criticalStockThreshold: settings.criticalStockThreshold,
        autoReorder: settings.autoReorder
      },
      notifications: {
        emailNotifications: settings.emailNotifications,
        notificationFrequency: settings.notificationFrequency
      },
      security: {
        sessionTimeout: settings.sessionTimeout,
        twoFactorAuth: settings.twoFactorAuth
      },
      aiSettings: settings.aiSettings,
      backup: {
        autoBackup: settings.autoBackup,
        backupRetention: settings.backupRetention
      }
    });

    // Gestion des emails
    const emailArray = this.notificationEmailsArray;
    emailArray.clear();
    if (settings.notificationEmails?.length) {
      settings.notificationEmails.forEach(email => {
        emailArray.push(this.fb.control(email, [Validators.email, Validators.required]));
      });
    }
  }

  private handleSettingsError(err: any): Observable<StockSettings> {
    console.error('Error loading settings:', err);
    this.loading = false;
    this.cdr.detectChanges();
    this.showError('SETTINGS.LOAD_ERROR');
    return of(this.currentSettings);
  }

  private applySettings(settings: StockSettings): void {
    try {
      this.currentSettings = {...this.currentSettings, ...settings};
      
      this.settingsForm.patchValue({
        general: {
          lowStockThreshold: this.currentSettings.lowStockThreshold,
          criticalStockThreshold: this.currentSettings.criticalStockThreshold,
          autoReorder: this.currentSettings.autoReorder
        },
        notifications: {
          emailNotifications: this.currentSettings.emailNotifications,
          notificationFrequency: this.currentSettings.notificationFrequency
        },
        security: {
          inventoryAccessLevel: this.currentSettings.inventoryAccessLevel,
          restrictedCategories: this.currentSettings.restrictedCategories,
          approvalThreshold: this.currentSettings.approvalThreshold,
          requireManagerApproval: this.currentSettings.requireManagerApproval,
          limitStockAdjustments: this.currentSettings.limitStockAdjustments
        },
        backup: {
          autoBackup: this.currentSettings.autoBackup,
          backupRetention: this.currentSettings.backupRetention
        }
      });

      const emailArray = this.notificationEmailsArray;
      emailArray.clear();
      if (this.currentSettings.notificationEmails?.length) {
        this.currentSettings.notificationEmails.forEach(email => {
          emailArray.push(this.fb.control(email, [Validators.email, Validators.required]));
        });
      }

      this.themeService.setTheme(this.currentSettings.theme);
      this.translationService.setLanguage(this.currentSettings.language);
      
    } catch (error) {
      console.error('Error applying settings:', error);
      this.showError('SETTINGS.APPLY_ERROR');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private initializeDefaultSettings(): Observable<StockSettings> {
    const defaultSettings: StockSettings = {
      ...this.currentSettings,
      lastModified: {
        by: this.userService.getCurrentUserName(),
        at: Date.now()
      }
    };
    
    return from(this.db.object('settings/stock').set(defaultSettings))
      .pipe(
        map(() => defaultSettings),
        tap(() => this.auditLogService.log('SETTINGS_INIT', 'Default settings initialized')),
        catchError(error => {
          console.error('Error initializing default settings:', error);
          this.showError('SETTINGS.INIT_ERROR');
          return of(defaultSettings);
        })
      );
  }

  private loadBackups(): void {
    const sub = this.backupService.getBackups('stock').subscribe({
      next: (backups) => this.backups = backups,
      error: (err) => this.showError('BACKUP.ERRORS.LOAD')
    });
    this.subscriptions.push(sub);
  }


  private loadAuditLogs(): void {
    const auditSub = this.auditLogService.getLogs('settings')
      .subscribe({
        next: (logs) => this.auditLogs = logs,
        error: (err) => console.error('Failed to load audit logs:', err)
      });
    this.subscriptions.push(auditSub);
  }

  private setupFormListeners(): void {
    const sub = this.settingsForm.valueChanges.subscribe(() => {
      this.checkForChanges();
    });
    this.subscriptions.push(sub);
  }

  private checkForChanges(): void {
    const formValues = this.settingsForm.value;
    this.hasUnsavedChanges = !this.areSettingsEqual(formValues, this.currentSettings);
    this.cdr.detectChanges();
  }

  private areSettingsEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }


  get backupForm(): FormGroup {
    return this.settingsForm.get('backup') as FormGroup;
  }

  private showSuccess(message: string): void {
    this.snackBar.open(this.translationService.translate(message), this.translationService.translate('COMMON.CLOSE'), { duration: 3000 });
  }

  private showError(message: string): void {
    this.snackBar.open(this.translationService.translate(message), this.translationService.translate('COMMON.CLOSE'), { duration: 5000 });
  }

  private showInfo(message: string): void {
    this.snackBar.open(this.translationService.translate(message), this.translationService.translate('COMMON.CLOSE'), { duration: 3000 });
  }


  async saveSettings(): Promise<void> {
    if (this.settingsForm.invalid || this.saving) return;

    this.saving = true;
    try {
      const formValues = this.settingsForm.value;
      const updatedSettings: Partial<StockSettings> = {
        ...formValues.general,
        ...formValues.notifications,
        aiSettings: formValues.aiSettings,
        ...formValues.backup,
        notificationEmails: formValues.notifications.notificationEmails
      };

      await this.settingsService.updateSettings(updatedSettings);
      this.hasUnsavedChanges = false;
      this.showSuccess('SETTINGS.SAVED');
    } catch (error) {
      this.showError('SETTINGS.SAVE_ERROR');
    } finally {
      this.saving = false;
    }
  }


  resetSettings(): void {
    this.applySettingsToForm(this.currentSettings);
    this.hasUnsavedChanges = false;
    this.showInfo('SETTINGS.RESET');
  }


  async createBackup(): Promise<void> {
    if (this.isMakingBackup) return;

    const confirmed = await this.showConfirmation('BACKUP.CONFIRM_TITLE', 'BACKUP.CONFIRM_MESSAGE');
    if (!confirmed) return;

    this.isMakingBackup = true;
    try {
      await this.backupService.createBackup('stock', 'manual');
      this.showSuccess('BACKUP.CREATED');
      this.loadBackups();
    } catch (error) {
      this.showError('BACKUP.CREATE_ERROR');
    } finally {
      this.isMakingBackup = false;
      this.cdr.detectChanges();
    }
  }

  async restoreBackup(backupId: string): Promise<void> {
    if (this.isRestoring) return;

    const confirmed = await this.showConfirmation('BACKUP.RESTORE_TITLE', 'BACKUP.RESTORE_MESSAGE');
    if (!confirmed) return;

    this.isRestoring = true;
    try {
      await this.backupService.restoreBackup('stock', backupId);
      this.showSuccess('BACKUP.RESTORED');
      this.loadSettings();
    } catch (error) {
      this.showError('BACKUP.RESTORE_ERROR');
    } finally {
      this.isRestoring = false;
      this.cdr.detectChanges();
    }
  }

  async deleteBackup(backupId: string): Promise<void> {
    const confirmed = await this.showConfirmation('BACKUP.DELETE_TITLE', 'BACKUP.DELETE_MESSAGE');
    if (!confirmed) return;

    try {
      await this.backupService.deleteBackup('stock', backupId);
      this.showSuccess('BACKUP.DELETED');
      this.loadBackups();
    } catch (error) {
      this.showError('BACKUP.DELETE_ERROR');
    }
  }

  async exportSettings(): Promise<void> {
    const dialogRef = this.dialog.open(SettingsExportDialogComponent, {
      width: '500px',
      data: { settings: this.currentSettings }
    });

    const result = await dialogRef.afterClosed().toPromise();
    if (result) {
      try {
        const blob = new Blob([JSON.stringify(this.currentSettings, null, 2)], { type: 'application/json' });
        saveAs(blob, `stock_settings_${new Date().toISOString().split('T')[0]}.json`);
        this.showSuccess('SETTINGS.EXPORTED');
      } catch (error) {
        this.showError('SETTINGS.EXPORT_ERROR');
      }
    }
  }

  async importSettings(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importedSettings = JSON.parse(content) as StockSettings;

        if (!this.validateImportedSettings(importedSettings)) {
          this.showError('SETTINGS.IMPORT_INVALID');
          return;
        }

        const confirmed = await this.showConfirmation('SETTINGS.IMPORT_TITLE', 'SETTINGS.IMPORT_MESSAGE');
        if (!confirmed) return;

        await this.db.object('settings/stock').update(importedSettings);
        this.showSuccess('SETTINGS.IMPORTED');
        this.loadSettings();
      } catch (error) {
        this.showError('SETTINGS.IMPORT_ERROR');
      }
    };

    reader.readAsText(file);
    input.value = '';
  }

  private validateImportedSettings(settings: any): settings is StockSettings {
    return settings &&
      typeof settings.lowStockThreshold === 'number' &&
      typeof settings.criticalStockThreshold === 'number' &&
      Array.isArray(settings.notificationEmails);
  }


  addNotificationEmail(): void {
    this.notificationEmailsArray.push(this.fb.control('', [Validators.email, Validators.required]));
    this.cdr.detectChanges();
  }

  removeNotificationEmail(index: number): void {
    if (this.notificationEmailsArray.length > 1) {
      this.notificationEmailsArray.removeAt(index);
    }
    this.cdr.detectChanges();
  }

  get generalForm(): FormGroup {
    return this.settingsForm.get('general') as FormGroup;
  }

  get notificationsForm(): FormGroup {
    return this.settingsForm.get('notifications') as FormGroup;
  }

  get aiSettingsForm(): FormGroup {
    return this.settingsForm.get('aiSettings') as FormGroup;
  }

  changeTheme(theme: 'light' | 'dark' | 'system'): void {
    this.themeService.setTheme(theme);
    this.checkForChanges();
  }

  changeLanguage(language: string): void {
    this.translationService.setLanguage(language);
    
    // Sauvegarder la préférence de langue dans Firebase
    this.db.object('settings/stock').update({
      language: language,
      lastModified: {
        by: this.userService.getCurrentUserName(),
        at: Date.now()
      }
    }).then(() => {
      this.currentSettings.language = language;
      this.showSuccess('SETTINGS.SAVED');
    }).catch(error => {
      console.error('Error saving language preference:', error);
      this.showError('SETTINGS.SAVE_ERROR');
    });
  }


  private async showConfirmation(titleKey: string, messageKey: string): Promise<boolean> {
    const dialogRef = this.dialog.open(MatDialog, {
      width: '350px',
      data: {
        title: this.translationService.translate(titleKey),
        message: this.translationService.translate(messageKey),
        confirmText: this.translationService.translate('COMMON.CONFIRM'),
        cancelText: this.translationService.translate('COMMON.CANCEL')
      }
    });
    return dialogRef.afterClosed().toPromise();
  }

  trackByBackupId(index: number, backup: Backup): string {
    return backup.id;
  }
}