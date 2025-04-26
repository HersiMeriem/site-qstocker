import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { EventInput } from '@fullcalendar/core';

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
      theme: ['light', Validators.required],
      notifications: [true],
      emailNotifications: [true],
      language: ['en', Validators.required],
      accentColor: ['#3b82f6'],
      silentHours: this.fb.group({
        start: ['22:00'],
        end: ['07:00']
      })
    });
  
    // Désactiver les notifications email si les notifications générales sont désactivées
    this.settingsForm.get('notifications')?.valueChanges.subscribe(notifEnabled => {
      const emailNotifControl = this.settingsForm.get('emailNotifications');
      if (!notifEnabled) {
        emailNotifControl?.disable();
        emailNotifControl?.setValue(false);
      } else {
        emailNotifControl?.enable();
      }
    });
  }

  loadSettings(): void {
    this.isLoading = true;
    this.db.object('admin/settings').valueChanges().subscribe({
      next: (settings: any) => {
        if (settings) {
          this.settingsForm.patchValue(settings);
          this.applySettings(settings);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading settings:', error);
        this.isLoading = false;
      }
    });
  }

  saveSettings(): void {
    if (this.settingsForm.valid) {
      this.isLoading = true;
      const settings = this.settingsForm.value;

      this.db.object('admin/settings').set(settings)
        .then(() => {
          const activityLog = {
            action: 'Settings updated',
            user: 'Admin',
            type: 'settings',
            details: JSON.stringify(settings),
            timestamp: new Date().toISOString()
          };
          return this.db.list('activityLogs').push(activityLog);
        })
        .then(() => {
          this.showNotification('settingsSaved');
        })
        .catch((error) => {
          this.showNotification('settingsSaveError', { error });
        })
        .finally(() => {
          this.isLoading = false;
        });
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