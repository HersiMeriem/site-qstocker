import { Component, OnInit, OnDestroy } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { StockManagerProfileService } from '../../services/stock-manager-profile.service';
import { StockManagerConfirmationService } from '../../services/stock-manager-confirmation.service';
import { saveAs } from 'file-saver';
import { interval, Subject, Subscription } from 'rxjs';
import { takeUntil, switchMap, map, take } from 'rxjs/operators';
import { MessagingService } from '../../services/messaging.service';
import { forkJoin } from 'rxjs';
import { EmailNotificationService } from '../../services/mail-notification.service';


interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-profil',
  templateUrl: './profil.component.html',
  styleUrls: ['./profil.component.css']
})
export class ProfilComponent implements OnInit, OnDestroy {
  managerProfile: any = {
    name: '',
    email: '',
    warehouse: '', // Ne sera plus vide
    hireDate: new Date().toISOString().split('T')[0], // Date du jour par défaut
    phone: '',
    address: '',
    photoUrl: null
  };



  conversations: any[] = [];
  activeConversation: any = null;
  conversationMessages: any[] = [];
  newMessageText: string = '';
  selectedRecipientEmail: string = '';
  newMessage = '';
  currentUserEmail: string = '';
  messages: any[] = [];
  newConversationEmail = '';
  currentUserId: string | null = null;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  messageSubscription: Subscription | undefined;
  private messagesSubscription: Subscription | undefined;

  warehouses = [
    { id: 'Entrepôt Principal', name: 'Entrepôt Principal' },
    { id: 'Entrepôt Nord', name: 'Entrepôt Nord' },
    { id: 'Entrepôt Sud', name: 'Entrepôt Sud' }
  ];

  showDialog = false;
  dialogTitle = '';
  dialogMessage = '';
  dialogConfirmText = '';
  dialogCancelText = '';
  private dialogPromiseResolve?: (value: boolean) => void;

  editing = false;
  activityLog: any[] = [];
  notifications = {
    email: true,
    push: true,
    sms: false
  };
  
  unreadCount = 0;
  
 
  passwordStrength = {
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  };
  
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  newTask = '';
  currentFilter = 'all';
  editingTask: Task | null = null;


 isLoading = false;
  uploadProgress: number | null = null;
  activeTab = 'profile';
  oldPassword = '';
  newPassword = '';
  showClearConfirmation = false;
  
  private destroy$ = new Subject<void>();
  messagesSub: any;

  constructor(
    private afAuth: AngularFireAuth,
    private db: AngularFireDatabase,
    private profileService: StockManagerProfileService,
    private confirmationService: StockManagerConfirmationService,
    private messagingService: MessagingService,
    private emailService: EmailNotificationService,
  ) {}
  
  async ngOnInit() {
    await this.loadUserProfile();
    this.loadActivityLog();
    this.loadNotifications();
    this.loadRealTimeTasks();
    this.setupEmailPolling();
    this.loadRealTimeTasks(); // Ajoutez cette ligne
    this.loadRealTimeConversations();
    this.loadUserConversations();
    const user = await this.afAuth.currentUser;
    
    if (user?.uid) {
      this.messagingService.loadUserConversations(user.uid).subscribe({
        next: (conversations) => {
          this.conversations = conversations || [];
          localStorage.setItem('lastConversations', JSON.stringify(this.conversations));
        },
        error: (err) => console.error('Erreur de chargement:', err)
      });

      // Récupération après actualisation
      const saved = localStorage.getItem('lastConversations');
      if (saved) {
        try {
          this.conversations = JSON.parse(saved) || [];
        } catch (e) {
          console.error('Erreur de parsing:', e);
        }
      }
    }
    this.currentUserId = user?.uid || null;
    if (this.currentUserId) {
      this.loadConversations();
    }

    if (user?.email) this.currentUserEmail = user.email;


  }

// profil.component.ts
trackByMessage(index: number, message: any): string {
  return `${message.timestamp}_${message.senderEmail}_${message.content.substring(0, 20)}`;
}

private setupEmailPolling() {
  // Vérifie toutes les 30 secondes
  interval(30000).pipe(
    takeUntil(this.destroy$)
  ).subscribe(() => {
    if (this.currentUserId) {
      this.messagingService.checkForEmailReplies(this.currentUserId);
    }
  });
}

ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
  
  if (this.messagesSubscription) {
    this.messagesSubscription.unsubscribe();
  }
  if (this.messagesSub) this.messagesSub.unsubscribe();

}
 
loadMessages(conversationId: string) {
  // Désabonnement précédent
  if (this.messagesSub) this.messagesSub.unsubscribe();

  this.messagesSub = this.messagingService.getMessages(conversationId)
    .subscribe({
      next: (msgs) => {
        this.messages = msgs;
        console.log('Messages affichés:', this.messages); // Debug
      },
      error: (err) => console.error('Erreur:', err)
    });
}


loadRealTimeTasks() {
  this.afAuth.currentUser.then(user => {
    if (user) {
      this.db.list<Task>(`users/${user.uid}/tasks`)
        .snapshotChanges()
        .pipe(takeUntil(this.destroy$))
        .subscribe(snapshots => {
          this.tasks = snapshots.map(snapshot => {
            const payload = snapshot.payload.val() as Task;
            return {
              id: snapshot.key || '',
              title: payload?.title || '',
              completed: payload?.completed || false,
              createdAt: payload?.createdAt || new Date().toISOString()
            };
          });
          this.filterTasks(this.currentFilter);
        });
    }
  });
}
  // Chargement des conversations en temps réel
  loadRealTimeConversations() {
    this.afAuth.currentUser.then(user => {
      if (user) {
        this.db.list(`users/${user.uid}/conversations`)
          .valueChanges()
          .pipe(takeUntil(this.destroy$))
          .subscribe(conversations => {
            this.conversations = conversations as any[];
            this.updateUnreadCount();
          });
      }
    });
  }

  async addTask() {
    if (!this.newTask.trim()) return;
  
    const user = await this.afAuth.currentUser;
    if (user) {
      const newTask: Omit<Task, 'id'> = {
        title: this.newTask.trim(),
        completed: false,
        createdAt: new Date().toISOString()
      };
  
      const taskRef = await this.db.list(`users/${user.uid}/tasks`).push(newTask);
      this.newTask = '';
      
      await this.logActivity('Tâche ajoutée', `"${newTask.title}"`);
    }
  }

  async deleteTask(taskId: string) {
    const confirmed = await this.openDialog(
      'Confirmer la suppression',
      'Êtes-vous sûr de vouloir supprimer cette tâche ?',
      'Supprimer',
      'Annuler'
    );
  
    if (confirmed) {
      const user = await this.afAuth.currentUser;
      if (user) {
        const taskToDelete = this.tasks.find(t => t.id === taskId);
        if (taskToDelete) {
          await this.db.object(`users/${user.uid}/tasks/${taskId}`).remove();
          await this.logActivity('Tâche supprimée', `"${taskToDelete.title}"`);
        }
      }
    }
  }
  async toggleTask(task: Task, event?: Event) {
    if (event) {
      event.preventDefault(); // Empêche le comportement par défaut
      event.stopPropagation(); // Empêche la propagation de l'événement
    }
  
    const user = await this.afAuth.currentUser;
    if (user) {
      await this.db.object(`users/${user.uid}/tasks/${task.id}`).update({
        completed: !task.completed
      });
      
      const action = task.completed ? 'marquée comme non terminée' : 'marquée comme terminée';
      await this.logActivity('Tâche mise à jour', `"${task.title}" ${action}`);
    }
  }
      editTask(task: Task) {
        this.editingTask = { ...task };
      }
      
      async saveTaskEdit() {
        if (!this.editingTask?.title.trim()) return;
      
        const user = await this.afAuth.currentUser;
        if (user && this.editingTask) {
          await this.db.object(`users/${user.uid}/tasks/${this.editingTask.id}`).update({
            title: this.editingTask.title.trim()
          });
          
          await this.logActivity('Tâche modifiée', `Nouveau titre: "${this.editingTask.title}"`);
          this.editingTask = null;
        }
      }
      
      cancelTaskEdit() {
        this.editingTask = null;
      }



async loadTasks() {
  const user = await this.afAuth.currentUser;
  if (user) {
    this.db.list<Task>(`users/${user.uid}/tasks`)
      .snapshotChanges()
      .pipe(takeUntil(this.destroy$))
      .subscribe(snapshots => {
        this.tasks = snapshots.map(snapshot => {
          const payload = snapshot.payload.val() as Task;
          return {
            id: snapshot.key || '',
            title: payload?.title || '',
            completed: payload?.completed || false,
            createdAt: payload?.createdAt || new Date().toISOString()
          };
        });
        this.filterTasks(this.currentFilter);
      });
  }
}

filterTasks(filter: string) {
  this.currentFilter = filter;
  switch (filter) {
    case 'active':
      this.filteredTasks = this.tasks.filter(task => !task.completed);
      break;
    case 'completed':
      this.filteredTasks = this.tasks.filter(task => task.completed);
      break;
    default:
      this.filteredTasks = [...this.tasks];
  }
}
get completedTasksCount(): number {
  return this.tasks.filter(task => task.completed).length;
}

// profil.component.ts
async sendMessage() {
  if (!this.activeConversation?.id || !this.newMessage.trim()) return;

  try {
    const user = await this.afAuth.currentUser;
    if (!user?.email) throw new Error('Non authentifié');

    // Envoyer le message
    await this.messagingService.addMessageToConversation(
      this.activeConversation.id,
      user.email,
      this.newMessage
    );

    // Envoyer l'email au destinataire
    const recipientEmail = this.getOtherParticipant(this.activeConversation);
    await this.messagingService.sendRealEmail(
      this.activeConversation.id,
      recipientEmail,
      this.newMessage,
      user.email
    );

    this.newMessage = '';
    this.showSuccess('Message envoyé avec succès');
  } catch (error: any) {
    this.errorMessage = error.message;
  }
}
  private async sendEmailNotification(conversationId: string, senderEmail: string, messageContent: string) {
    const conv = await this.db.object(`conversations/${conversationId}`).query.once('value');
    const convData = conv.val();

    if (!convData?.participantEmails) return;

    const recipientEntry = Object.entries(convData.participantEmails)
      .find(async ([id]) => id !== (await this.afAuth.currentUser)?.uid);

    if (!recipientEntry) return;
    const [_, recipientEmail] = recipientEntry;

    await this.emailService.sendNotificationEmail(
      recipientEmail as string,
      `Nouveau message de ${senderEmail}`,
      `Vous avez reçu un nouveau message:\n\n${messageContent}\n\n` +
      `Répondre: ${window.location.origin}/profile?tab=messages`,
      {
        conversationId,
        sender: senderEmail,
        messageId: null
      }
    );
}



getConversationName(conversation: any): string {
  if (!conversation || !conversation.participants) return 'Nouvelle conversation';
  
  const currentUserEmail = this.managerProfile.email;
  const otherParticipant = conversation.participants.find((email: string) => email !== currentUserEmail);
  
  return otherParticipant || 'Conversation de groupe';
}


getOtherParticipant(conversation: any): string {
  if (!this.currentUserId || !conversation?.participants) return 'Inconnu';
  
  for (const [userId, email] of Object.entries(conversation.participants)) {
    if (userId !== this.currentUserId) {
      return email as string;
    }
  }
  return 'Inconnu';
}


private validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// profil.component.ts
async createNewConversation() {
  try {
    const conversationId = await this.messagingService.createConversation(this.newConversationEmail);
    this.selectConversation(conversationId);
  } catch (error) {
    console.error('Erreur création conversation:', error);
    // Gérer l'erreur dans l'interface
  }
}

private scrollToBottom() {
  setTimeout(() => {
    const container = document.querySelector('.messages-container');
    if (container) container.scrollTop = container.scrollHeight;
  }, 100);
}


async handleNewUserRegistration(userId: string, userEmail: string): Promise<void> {
  const conversations = await this.db.list('conversations', ref => 
    ref.orderByChild('participantEmails/unknown').equalTo(userEmail)
  ).query.once('value');

  if (conversations.exists()) {
    const updates: Promise<void>[] = []; // Typage explicite pour éviter les erreurs
    conversations.forEach(conv => {
      if (conv.key) { // Vérification que `conv.key` n'est pas `null` ou `undefined`
        updates.push(
          this.messagingService.associateRecipient(conv.key, userId)
        );
      }
    });
    await Promise.all(updates);
  }
}

// Exemple d'utilisation
async someRegistrationMethod() {
  const userId = '...'; // Récupérer l'ID du nouvel utilisateur
  const userEmail = '...'; // Son email
  await this.handleNewUserRegistration(userId, userEmail);
}


selectConversation(conversationId: string) {
  // Désabonnement précédent
  if (this.messagesSubscription) {
    this.messagesSubscription.unsubscribe();
  }

  // Charger la conversation active
  this.messagingService.getConversation(conversationId)
    .pipe(takeUntil(this.destroy$))
    .subscribe(conv => {
      this.activeConversation = conv;
    });

  // Souscrire aux messages
  this.messagesSubscription = this.messagingService.getMessages(conversationId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (messages) => {
        this.messages = messages;
        this.scrollToBottom();
        this.markMessagesAsRead(conversationId);
      },
      error: (err) => console.error('Erreur de chargement des messages:', err)
    });
}

private async markMessagesAsRead(conversationId: string) {
  // Ajout de await pour obtenir l'utilisateur courant
  const user = await this.afAuth.currentUser;
  
  // Vérification que l'utilisateur existe et a un uid
  if (!user || !user.uid) return;

  this.db.list(`conversations/${conversationId}/messages`, ref =>
    ref.orderByChild('read').equalTo(false)
  ).snapshotChanges()
    .pipe(take(1))
    .subscribe(snapshots => {
      snapshots.forEach(snap => {
        const message = snap.payload.val() as any;
        // Maintenant user.uid est accessible car user est de type User (pas Promise)
        if (message.senderId !== user.uid) {
          this.db.object(`conversations/${conversationId}/messages/${snap.key}/read`).set(true);
        }
      });
    });
}

private async updateMessagesReadStatus(conversationId: string): Promise<void> {
  const user = await this.afAuth.currentUser;
  if (!user?.email) return;

  await Promise.all(
    this.messages
      .filter(msg => msg.senderEmail !== user.email && !msg.read)
      .map(msg => 
        this.db.object(`conversations/${conversationId}/messages/${msg.id}/read`).set(true)
      )
  );
}


async loadUserConversations() {
  const user = await this.afAuth.currentUser;
  if (!user?.uid) return;

  this.db.list(`userConversations/${user.uid}`).snapshotChanges().pipe(
    takeUntil(this.destroy$)
  ).subscribe(snapshots => {
    const conversationPromises = snapshots.map(snap => 
      this.db.object(`conversations/${snap.key}`).valueChanges().pipe(
        take(1),
        map((conv: any) => ({ id: snap.key, ...conv })) // Typage explicite ici
      ).toPromise()
    );

    Promise.all(conversationPromises).then(conversations => {
      this.conversations = conversations;
      this.updateUnreadCount();
    });
  });
}

loadConversations() {
  if (!this.currentUserId) return;

  this.db.list(`userConversations/${this.currentUserId}`).snapshotChanges().pipe(
    switchMap(snapshots => {
      const conversationIds = snapshots.map(snap => snap.key);
      const conversationObservables = conversationIds.map(id => 
        this.db.object(`conversations/${id}`).valueChanges().pipe(
          map((conv: any) => ({ id, ...conv }))
        )
      );
      return forkJoin(conversationObservables);
    }),
    takeUntil(this.destroy$)
  ).subscribe({
    next: (conversations) => {
      this.conversations = conversations;
    },
    error: (error) => {
      this.errorMessage = 'Erreur de chargement des conversations';
      console.error(error);
    }
  });
}


  updateUnreadCount() {
    this.unreadCount = this.conversations.filter(c => c.unread).length;
  }


  openDialog(
    title: string,
    message: string,
    confirmText?: string,
    cancelText?: string
  ): Promise<boolean> {
    this.showDialog = true;
    this.dialogTitle = title;
    this.dialogMessage = message;
    this.dialogConfirmText = confirmText || '';
    this.dialogCancelText = cancelText || '';
    
    return new Promise((resolve) => {
      this.dialogPromiseResolve = resolve;
    });
  }
  
  closeDialog(result: boolean): void {
    this.showDialog = false;
    if (this.dialogPromiseResolve) {
      this.dialogPromiseResolve(result);
      this.dialogPromiseResolve = undefined;
    }
  }



  async loadUserProfile() {
    this.isLoading = true;
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        this.managerProfile.name = user.displayName || '';
        this.managerProfile.email = user.email || '';
        
        const userId = user.uid;
        const profileData = await this.db.object(`users/${userId}`).query.once('value');
        
        if (profileData.exists()) {
          this.managerProfile = { 
            ...this.managerProfile,
            ...profileData.val(),
            warehouse: profileData.val().warehouse || this.warehouses[0].id,
            hireDate: profileData.val().hireDate || new Date().toISOString().split('T')[0],
            phone: profileData.val().phone || '',
            address: profileData.val().address || ''
          };
        }
        
        if (profileData.val()?.photoUrl) {
          this.profileService.updateProfilePhoto(profileData.val().photoUrl);
          this.managerProfile.photoUrl = profileData.val().photoUrl;
        }
      }
    } catch (error: any) {
      this.errorMessage = "Erreur lors du chargement du profil: " + error.message;
    } finally {
      this.isLoading = false;
    }
  }


  toggleEdit() {
    this.editing = !this.editing;
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


  async saveProfile() {
    this.isLoading = true;
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        await user.updateProfile({ displayName: this.managerProfile.name });
        await user.updateEmail(this.managerProfile.email);
        
        await this.db.object(`users/${user.uid}`).update({
          name: this.managerProfile.name,
          email: this.managerProfile.email,
          warehouse: this.managerProfile.warehouse,
          hireDate: this.managerProfile.hireDate,
          phone: this.managerProfile.phone,
          address: this.managerProfile.address
        });
        
        await this.logActivity('Profil mis à jour');
        this.showSuccess("Profil mis à jour avec succès");
        this.editing = false;
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
        await this.profileService.updateStockManagerProfile(user.uid, {
          photoUrl: imageDataUrl,
          lastUpdated: new Date().toISOString()
        });
        
        this.profileService.updateProfilePhoto(imageDataUrl);
        this.managerProfile.photoUrl = imageDataUrl;
        
        await this.profileService.logStockManagerActivity(user.uid, 'Photo de profil changée');
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
        this.profileService.updateProfilePhoto('assets/images/responsable.png');
        this.showSuccess("Photo de profil supprimée avec succès");
    
        
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
    setTimeout(() => this.successMessage = null, 3000);
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


  async confirmClearAllActivities() {
    const confirmed = await this.openDialog(
      'Confirmation',
      'Êtes-vous sûr de vouloir supprimer toutes les activités ?',
      'Supprimer',
      'Annuler'
    );
    
    if (confirmed) {
      this.clearAllActivities();
    }
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
      'données exportées': 'fa-file-export',
      'inventaire modifié': 'fa-boxes',
      'transfert effectué': 'fa-exchange-alt',
      'rapport généré': 'fa-file-pdf'
    };

    const lowerAction = action.toLowerCase();
    return actionIcons[lowerAction] || 'fa-info-circle';
  }
}