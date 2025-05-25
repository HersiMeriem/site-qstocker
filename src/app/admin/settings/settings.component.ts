import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { EventInput } from '@fullcalendar/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit, OnDestroy {
  settingsForm!: FormGroup;
  isLoading = false;
  logoPreview: string | null = null;
  activityLogs: any[] = [];
  filteredLogs: any[] = [];
  paginatedLogs: any[] = [];
  users: any[] = [];
  onlineUsers: string[] = [];
  currentPage = 1;
  itemsPerPage = 5;
  totalPages = 1;
  filterType = 'all';
  selectedActivity: any = null;
  showUserManagement = false;
  userSearchQuery = '';
  onlineStatusSubscription: any;

  themes = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' }
  ];
  
  languages = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'French' },
    { value: 'es', label: 'Spanish' }
  ];

  constructor(
    private fb: FormBuilder,
    private db: AngularFireDatabase,
    private snackBar: MatSnackBar,
    private fns: AngularFireFunctions,
    private translate: TranslateService,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadSettings();
    this.loadActivityLogs();
    this.initLanguage();
  }

  ngOnDestroy(): void {
    if (this.onlineStatusSubscription) {
      this.onlineStatusSubscription.unsubscribe();
    }
  }

  onLanguageChange() {
    const lang = this.settingsForm.get('language')?.value;
    this.translate.use(lang);
  }
  

  initForm(): void {
    this.settingsForm = this.fb.group({
      notifications: [false],
      emailNotifications: [false],
      webNotifications: [false],
      adminEmail: ['admin@example.com', Validators.email]
    });

    // Désactiver les sous-notifications si la notification principale est désactivée
    this.settingsForm.get('notifications')?.valueChanges.subscribe(notifEnabled => {
      const emailControl = this.settingsForm.get('emailNotifications');
      const webControl = this.settingsForm.get('webNotifications');
      
      if (!notifEnabled) {
        emailControl?.disable();
        webControl?.disable();
        emailControl?.setValue(false);
        webControl?.setValue(false);
      } else {
        emailControl?.enable();
        webControl?.enable();
      }
    });
  }

  loadSettings(): void {
    this.db.object('admin/settings').valueChanges().subscribe(settings => {
      if (settings) {
        this.settingsForm.patchValue(settings);
      }
    });
  }
  private async sendTestNotifications(settings: any) {
    // Notification par email
    if (settings.emailNotifications && settings.adminEmail) {
      const sendEmail = this.fns.httpsCallable('sendEmailNotification');
      await sendEmail({
        to: settings.adminEmail,
        subject: 'Test de notification',
        message: 'Ceci est un test de notification depuis votre panneau admin.'
      }).toPromise();
    }

    // Notification web
    if (settings.webNotifications) {
      await this.db.list('notifications').push({
        title: 'Test de notification',
        message: 'Ceci est un test de notification web',
        timestamp: new Date().toISOString(),
        read: false
      });
    }
  }


  async saveSettings() {
    if (this.settingsForm.valid) {
      this.isLoading = true;
      const settings = this.settingsForm.value;
  
      try {
        // 1. Sauvegarde des paramètres
        console.log('Tentative de sauvegarde des paramètres...', settings);
        await this.db.object('admin/settings').set(settings);
        console.log('Paramètres sauvegardés avec succès');
  
        // 2. Vérification activation notifications email
        if (settings.emailNotifications && settings.adminEmail) {
          console.log('Notifications email activées, email admin:', settings.adminEmail);
          await this.testEmailNotifications(settings.adminEmail);
        } else {
          console.log('Notifications email non activées ou email manquant');
        }
  
        this.snackBar.open('Paramètres sauvegardés avec succès', 'Fermer', { 
          duration: 3000,
          panelClass: ['success-snackbar']
        });
  
      } catch (error: any) {
        console.error('Erreur complète:', error);
        this.snackBar.open('Échec de la sauvegarde: ' + (error.message || 'Erreur inconnue'), 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      } finally {
        this.isLoading = false;
      }
    }
  }
  
  private async testEmailNotifications(email: string) {
    try {
      console.log('Tentative d\'envoi d\'email de test à:', email);
      const sendEmail = this.fns.httpsCallable('sendTestEmail');
      const result = await sendEmail({ email }).toPromise();
      console.log('Résultat de l\'envoi:', result);
      
      if (result?.success) {
        this.snackBar.open('Email de test envoyé avec succès', 'Fermer', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
      } else {
        throw new Error('Échec de l\'envoi de l\'email');
      }
    } catch (error) {
      console.error('Erreur d\'envoi d\'email:', error);
      throw error; // Propager l'erreur
    }
  }
  
  loadActivityLogs(): void {
    this.db.list('activityLogs', ref => ref.orderByChild('timestamp'))
      .valueChanges()
      .subscribe({
        next: (logs: any[]) => {
          this.activityLogs = logs.reverse();
          this.filteredLogs = [...this.activityLogs];
          this.updatePagination();
          this.cdRef.detectChanges();
        },
        error: (error) => {
          console.error('Error loading activity logs:', error);
        }
      });
  }

  loadUsers(): void {
    this.db.list('users').valueChanges().subscribe({
      next: (users: any[]) => {
        this.users = users;
        this.loadOnlineStatus();
        this.cdRef.detectChanges();
      },
      error: (error) => {
        console.error('Error loading users:', error);
      }
    });
  }

  loadOnlineStatus(): void {
    if (this.onlineStatusSubscription) {
      this.onlineStatusSubscription.unsubscribe();
    }

    this.onlineStatusSubscription = this.db.list('users', ref => 
      ref.orderByChild('online').equalTo(true)
    ).valueChanges().subscribe((onlineUsers: any[]) => {
      this.onlineUsers = onlineUsers.map(user => user.uid);
      this.cdRef.detectChanges();
    });
  }

  applySettings(settings: any): void {
    document.body.classList.remove('dark-theme', 'light-theme');
    document.body.classList.add(`${settings.theme}-theme`);
    document.documentElement.style.setProperty('--accent-color', settings.accentColor);
    this.translate.use(settings.language);
  }

  initLanguage(): void {
    this.translate.setDefaultLang('en');
    const browserLang = navigator.language.split('-')[0];
    this.translate.use(browserLang.match(/en|fr|es/) ? browserLang : 'en');
  }
  filterActivities(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.filterType = selectElement.value;
    
    // Réinitialise toujours filteredLogs
    this.filteredLogs = [...this.activityLogs];
    
    // Filtre seulement si ce n'est pas "all"
    if (this.filterType !== 'all') {
      this.filteredLogs = this.activityLogs.filter(log => log.type === this.filterType);
    }
    
    this.updatePagination();
    
    // Charge les utilisateurs si nécessaire
    if (this.filterType === 'all' || this.filterType === 'users') {
      this.loadUsers();
    }
  }

  updatePagination(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredLogs.length / this.itemsPerPage));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    this.updatePaginatedLogs();
  }

  updatePaginatedLogs(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedLogs = [...this.filteredLogs.slice(startIndex, endIndex)];
    this.cdRef.detectChanges();
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedLogs();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedLogs();
    }
  }



  approveUser(uid: string): void {
    this.db.object(`users/${uid}/status`).set('approved')
      .then(() => {
        this.showNotification('userApproved');
        this.loadUsers();
      })
      .catch(error => {
        this.showNotification('userApprovalError', { error });
      });
  }


  filterUsers(): void {
    if (!this.userSearchQuery) {
      this.loadUsers();
      return;
    }
    
    this.users = this.users.filter(user => 
      (user.email && user.email.toLowerCase().includes(this.userSearchQuery.toLowerCase())) ||
      (user.status && user.status.toLowerCase().includes(this.userSearchQuery.toLowerCase()))
    );
  }

  showActivityDetails(log: any): void {
    this.selectedActivity = log;
  }

  onLogoUpload(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.logoPreview = reader.result as string;
        this.settingsForm.patchValue({ logo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  }

  addEvent(title: string, date: string): void {
    const newEvent: EventInput = { 
      title, 
      date,
      backgroundColor: '#4CAF50',
      borderColor: '#4CAF50'
    };
    this.db.list('events').push(newEvent)
      .then(() => {
        this.showNotification('eventAdded');
      })
      .catch((error) => {
        this.showNotification('eventAddError', { error });
      });
  }

  exportActivityLog(): void {
    const headers = ['Timestamp', 'Action', 'User', 'Type', 'Details'];
    const csvContent = [
      headers.join(','),
      ...this.filteredLogs.map(log => 
        `"${log.timestamp}","${log.action}","${log.user}","${log.type}","${log.details}"`
      )
    ].join('\n');
    
    this.downloadFile(csvContent, 'activity_log.csv', 'text/csv');
  }

  exportSettings(): void {
    const settings = JSON.stringify(this.settingsForm.value, null, 2);
    this.downloadFile(settings, 'settings.json', 'application/json');
  }

  importSettings(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const settings = JSON.parse(reader.result as string);
          this.settingsForm.patchValue(settings);
          this.showNotification('settingsImported');
        } catch (error) {
          this.showNotification('settingsImportError');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  private downloadFile(data: string, filename: string, type: string): void {
    const blob = new Blob([data], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  private showNotification(messageKey: string, params?: any): void {
    this.snackBar.open(
      this.translate.instant(messageKey, params),
      this.translate.instant('close'),
      { duration: 3000 }
    );
  }

// Dans votre composant (.ts)
ngAfterViewInit() {
  const select = document.getElementById('theme') as HTMLSelectElement;
  
  // Force l'affichage du placeholder au départ
  if (select.value === "") {
    select.style.color = '#6b7280';
  }

  // Gère le changement de couleur
  select.addEventListener('change', function() {
    this.style.color = this.value === "" ? '#6b7280' : '#333';
  });
}
}