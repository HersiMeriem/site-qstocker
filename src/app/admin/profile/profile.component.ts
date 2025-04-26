import { Component, OnInit, OnDestroy } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { ProfileService } from '../../services/profile.service';
import { saveAs } from 'file-saver';
import { DataIntegrityService } from '../../services/data-integrity.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface DataCheck {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'valid' | 'error';
  lastRun: Date | null;
  isRunning: boolean;
  progress: number;
  result: { issues: string[]; timestamp?: Date } | null;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit, OnDestroy {
  adminProfile: any = {
    name: 'Salma Essid',
    email: 'salma.essid25@gmail.com',
    role: 'Administrateur',
    createdAt: '12/02/2025',
    photoUrl: null
  };
  editing = false;
  activityLog: any[] = [];
  showActivityLog = false;
  notifications = {
    email: true,
    push: true,
    sms: false
  };
  passwordStrength = {
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  };
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  uploadProgress: number | null = null;
  activeTab = 'profile';
  oldPassword = '';
  newPassword = '';
  showClearConfirmation = false;
  isRunningChecks = false;

  dataChecks: DataCheck[] = [
    {
      id: 'orphan_records',
      name: 'Enregistrements orphelins',
      description: 'Vérifie les données sans relation valide dans la base',
      status: 'pending',
      lastRun: null,
      isRunning: false,
      progress: 0,
      result: null
    },
    {
      id: 'data_integrity',
      name: 'Intégrité des références',
      description: 'Vérifie les clés étrangères valides',
      status: 'pending',
      lastRun: null,
      isRunning: false,
      progress: 0,
      result: null
    },
    {
      id: 'duplicates',
      name: 'Doublons',
      description: 'Détecte les entrées en double',
      status: 'pending',
      lastRun: null,
      isRunning: false,
      progress: 0,
      result: null
    }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private afAuth: AngularFireAuth,
    private db: AngularFireDatabase,
    private profileService: ProfileService,
    private dataIntegrityService: DataIntegrityService,
    private confirmationService: ConfirmationService
  ) {}

  async ngOnInit() {
    await this.loadUserProfile();
    this.loadActivityLog();
    this.loadNotifications();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async runAllChecks() {
    this.isRunningChecks = true;
    try {
      for (const check of this.dataChecks) {
        await this.runSingleCheck(check.id);
      }
    } finally {
      this.isRunningChecks = false;
    }
  }

  async runSingleCheck(checkId: string) {
    const check = this.dataChecks.find(c => c.id === checkId);
    if (!check) return;

    check.isRunning = true;
    check.progress = 0;

    try {
      const result = await this.dataIntegrityService.runCheck(checkId);
      
      check.result = {
        issues: result.issues || [],
        timestamp: new Date()
      };
      
      check.status = result.issues.length > 0 ? 'error' : 'valid';
      
    } catch (error: any) {
      check.status = 'error';
      check.result = {
        issues: ['Erreur lors de la vérification: ' + (error.message || 'Erreur inconnue')]
      };
    } finally {
      check.isRunning = false;
      check.progress = 100;
      check.lastRun = new Date();
    }
  }

  attemptAutoFix(checkId: string) {
    const check = this.dataChecks.find(c => c.id === checkId);
    if (!check?.result?.issues?.length) return;

    this.confirmationService.confirm({
      title: 'Correction automatique',
      message: `Cette action tentera de corriger ${check.result.issues.length} problèmes. Continuer?`,
      confirmText: 'Corriger',
      cancelText: 'Annuler'
    }).pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (confirmed) {
          this.fixIssues(checkId);
        }
      });
  }

  async fixIssues(checkId: string) {
    const check = this.dataChecks.find(c => c.id === checkId);
    if (!check) return;

    check.isRunning = true;
    try {
      const result = await this.dataIntegrityService.fixIssues(checkId);
      
      if (result.success) {
        this.showSuccess(`${result.fixedCount} problèmes corrigés`);
        await this.runSingleCheck(checkId);
      } else {
        this.showError('Certains problèmes n\'ont pas pu être corrigés');
      }
    } catch (error: any) {
      this.showError('Échec de la correction automatique: ' + error.message);
    } finally {
      check.isRunning = false;
    }
  }



async scheduleAutoChecks() {
  try {
    const frequency = await this.confirmationService.prompt(
      'Planification des vérifications',
      'Choisissez la fréquence:',
      ['Quotidienne', 'Hebdomadaire', 'Mensuelle']
    ).toPromise(); // Conversion en Promise

    if (!frequency) return;

    const freqMapping: {[key: string]: string} = {
      'Quotidienne': 'daily',
      'Hebdomadaire': 'weekly',
      'Mensuelle': 'monthly'
    };
    
    const frequencyKey = freqMapping[frequency];
    if (!frequencyKey) {
      throw new Error('Fréquence invalide');
    }

// Avec assertion de type
const nextRun = await this.dataIntegrityService.setSchedule(frequencyKey as 'daily' | 'weekly' | 'monthly');
    this.showSuccess(
      `Vérifications programmées (${frequency.toLowerCase()}). ` +
      `Prochaine exécution: ${nextRun.toLocaleDateString()}`
    );

    this.logActivity(
      'Planification vérifications',
      `Fréquence: ${frequency} | Next: ${nextRun.toISOString()}`
    );

    this.startScheduleListener();
  } catch (error: unknown) {
    let errorMessage = 'Erreur lors de la planification';
    if (error instanceof Error) {
      errorMessage += ': ' + error.message;
    }
    this.showError(errorMessage);
  }
}

private startScheduleListener() {
  this.db.object('config/dataCheckSchedule/nextRun')
    .valueChanges()
    .pipe(takeUntil(this.destroy$))
    .subscribe((nextRun: any) => { // Type temporaire
      if (nextRun && new Date(nextRun) <= new Date()) {
        this.runAllChecks();
        this.updateNextRun();
      }
    });
}

private async updateNextRun() {
  const snapshot = await this.db.object('config/dataCheckSchedule')
    .query.once('value');
  const config = snapshot.val();
  
  if (config?.frequency) {
    const nextRun = this.calculateNextRunDate(config.frequency);
    await this.db.object('config/dataCheckSchedule').update({
      nextRun: nextRun.toISOString(),
      lastUpdated: new Date().toISOString()
    });
  }
}

private calculateNextRunDate(frequency: string): Date {
  const date = new Date();
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    default:
      date.setDate(date.getDate() + 1);
  }
  return date;
}
  async loadUserProfile() {
    this.isLoading = true;
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        this.adminProfile.name = user.displayName || this.adminProfile.name;
        this.adminProfile.email = user.email || this.adminProfile.email;
        
        const userId = user.uid;
        const profileData = await this.db.object(`users/${userId}`).query.once('value');
        if (profileData.exists()) {
          this.adminProfile = { ...this.adminProfile, ...profileData.val() };
          if (profileData.val().photoUrl) {
            this.profileService.updateProfilePhoto(profileData.val().photoUrl);
          }
        }
      }
    } catch (error: any) {
      this.errorMessage = "Erreur lors du chargement du profil: " + error.message;
    } finally {
      this.isLoading = false;
    }
  }

  loadActivityLog() {
    this.afAuth.currentUser.then(user => {
      if (user) {
        this.db.list(`users/${user.uid}/activityLog`, ref => ref.limitToLast(10).orderByChild('timestamp'))
          .snapshotChanges()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (snapshots: any[]) => {
              this.activityLog = snapshots
                .map(snapshot => ({
                  $key: snapshot.key,
                  ...snapshot.payload.val()
                }))
                .reverse();
            },
            error: (err) => console.error('Erreur de chargement des activités:', err)
          });
      }
    });
  }

  loadNotifications() {
    this.afAuth.currentUser.then(user => {
      if (user) {
        this.db.object(`users/${user.uid}/preferences/notifications`)
          .valueChanges()
          .pipe(takeUntil(this.destroy$))
          .subscribe((prefs: any) => {
            if (prefs) this.notifications = prefs;
          });
      }
    });
  }

  private async logActivity(action: string, details?: string) {
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        const newActivity = {
          action: action,
          details: details || '',
          timestamp: new Date().toISOString()
        };
        
        await this.db.list(`users/${user.uid}/activityLog`).push(newActivity);
      }
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de l'activité:", error);
    }
  }

  getActivityIcon(action: string): string {
    const actionIcons: {[key: string]: string} = {
      'profil mis à jour': 'fa-user-edit',
      'photo de profil changée': 'fa-camera',
      'photo de profil supprimée': 'fa-trash-alt',
      'mot de passe changé': 'fa-key',
      'connexion': 'fa-sign-in-alt',
      'déconnexion': 'fa-sign-out-alt',
      'notification modifiée': 'fa-bell',
      'compte social connecté': 'fa-share-alt',
      'compte social déconnecté': 'fa-unlink',
      'données exportées': 'fa-file-export'
    };

    const lowerAction = action.toLowerCase();
    return actionIcons[lowerAction] || 'fa-info-circle';
  }

  toggleEdit() {
    this.editing = !this.editing;
  }

  async saveProfile() {
    this.isLoading = true;
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        await user.updateProfile({ displayName: this.adminProfile.name });
        await user.updateEmail(this.adminProfile.email);
        
        await this.db.object(`users/${user.uid}`).update({
          name: this.adminProfile.name,
          email: this.adminProfile.email
        });
        
        await this.logActivity('Profil mis à jour', 
          `Nom: ${this.adminProfile.name}, Email: ${this.adminProfile.email}`);
        
        this.editing = false;
        this.showSuccess("Profil mis à jour avec succès");
      }
    } catch (error: any) {
      this.errorMessage = `Erreur lors de la mise à jour: ${error.message}`;
    } finally {
      this.isLoading = false;
    }
  }

  async handleFileInput(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 1048576) {
        this.errorMessage = "❌ L'image est trop volumineuse (max 1MB)";
        return;
      }
      await this.uploadProfilePhoto(file);
    }
  }

  async uploadProfilePhoto(file: File) {
    this.isLoading = true;
    this.errorMessage = null;
    this.uploadProgress = 0;

    const user = await this.afAuth.currentUser;
    if (!user) {
      this.errorMessage = "❌ Aucun utilisateur connecté.";
      this.isLoading = false;
      return;
    }

    const progressInterval = setInterval(() => {
      if (this.uploadProgress === null || this.uploadProgress >= 90) {
        clearInterval(progressInterval);
      } else {
        this.uploadProgress = (this.uploadProgress || 0) + 10;
      }
    }, 200);

    const reader = new FileReader();
    
    reader.onload = async (e: any) => {
      clearInterval(progressInterval);
      this.uploadProgress = 100;
      
      try {
        const imageDataUrl = e.target.result;
        const userId = user.uid;
        
        await this.db.object(`users/${userId}`).update({
          photoUrl: imageDataUrl,
          lastUpdated: new Date().toISOString()
        });
        
        this.profileService.updateProfilePhoto(imageDataUrl);
        this.adminProfile.photoUrl = imageDataUrl;
        
        await this.logActivity('Photo de profil changée');
        this.showSuccess("Photo de profil mise à jour avec succès");
      } catch (error: any) {
        this.errorMessage = `❌ Erreur lors de la mise à jour : ${error.message}`;
      } finally {
        setTimeout(() => {
          this.isLoading = false;
          this.uploadProgress = null;
        }, 500);
      }
    };
    
    reader.onerror = () => {
      clearInterval(progressInterval);
      this.errorMessage = "❌ Erreur lors de la lecture du fichier.";
      this.isLoading = false;
      this.uploadProgress = null;
    };
    
    reader.readAsDataURL(file);
  }

  async removeProfilePhoto() {
    this.isLoading = true;
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        const userId = user.uid;
        
        await this.db.object(`users/${userId}/photoUrl`).remove();
        this.profileService.updateProfilePhoto('assets/default-profile.png');
        this.adminProfile.photoUrl = null;
        
        await this.logActivity('Photo de profil supprimée');
        this.showSuccess("Photo de profil supprimée avec succès");
      }
    } catch (error: any) {
      this.errorMessage = `❌ Erreur : ${error.message}`;
    } finally {
      this.isLoading = false;
    }
  }

  async saveNotifications() {
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        await this.db.object(`users/${user.uid}/preferences`).update({
          notifications: this.notifications
        });
        
        await this.logActivity('Notifications modifiées', 
          `Email: ${this.notifications.email ? 'activé' : 'désactivé'}, 
          Push: ${this.notifications.push ? 'activé' : 'désactivé'},
          SMS: ${this.notifications.sms ? 'activé' : 'désactivé'}`);
        
        this.showSuccess("Préférences enregistrées");
      }
    } catch (error: any) {
      this.errorMessage = "Erreur lors de l'enregistrement: " + error.message;
    }
  }

  async exportUserData() {
    this.isLoading = true;
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        const snapshot = await this.db.object(`users/${user.uid}`).query.once('value');
        const data = snapshot.val();
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        saveAs(blob, `user-data-${user.uid}.json`);
        
        await this.logActivity('Données exportées');
        this.showSuccess("Données exportées avec succès");
      }
    } catch (error: any) {
      this.errorMessage = "Erreur lors de l'export des données: " + error.message;
    } finally {
      this.isLoading = false;
    }
  }

  checkPasswordStrength(password: string) {
    this.passwordStrength = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    };
  }

  async changePassword() {
    if (!this.isPasswordStrong()) {
      this.errorMessage = "Le mot de passe ne respecte pas les exigences de sécurité";
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      const user = await this.afAuth.currentUser;
      if (user && user.email) {
        await this.afAuth.signInWithEmailAndPassword(user.email, this.oldPassword);
        await user.updatePassword(this.newPassword);
        
        await this.logActivity('Mot de passe changé');
        
        this.oldPassword = '';
        this.newPassword = '';
        this.showSuccess("Mot de passe mis à jour avec succès");
      }
    } catch (error: any) {
      this.errorMessage = `Erreur : ${error.message}`;
    } finally {
      this.isLoading = false;
    }
  }

  isPasswordStrong(): boolean {
    return Object.values(this.passwordStrength).every(v => v);
  }

  private showSuccess(message: string) {
    this.successMessage = message;
    setTimeout(() => this.successMessage = null, 5000);
  }

  private showError(message: string) {
    this.errorMessage = message;
    setTimeout(() => this.errorMessage = null, 5000);
  }

  clearMessages() {
    this.errorMessage = null;
    this.successMessage = null;
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  async deleteActivity(activityKey: string) {
    if (!activityKey) return;

    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        await this.db.object(`users/${user.uid}/activityLog/${activityKey}`).remove();
        this.showSuccess("Activité supprimée");
        this.activityLog = this.activityLog.filter(activity => activity.$key !== activityKey);
      }
    } catch (error: any) {
      this.errorMessage = "Erreur lors de la suppression de l'activité: " + error.message;
    }
  }

  async clearAllActivities() {
    this.isLoading = true;
    this.showClearConfirmation = false;
    
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        await this.db.object(`users/${user.uid}/activityLog`).remove();
        this.activityLog = [];
        this.showSuccess("Toutes les activités ont été supprimées");
        await this.logActivity('Journal des activités vidé');
      }
    } catch (error: any) {
      this.errorMessage = "Erreur lors de la suppression des activités: " + error.message;
    } finally {
      this.isLoading = false;
    }
  }

confirmClearAllActivities() {
  this.showClearConfirmation = true;
}
}
