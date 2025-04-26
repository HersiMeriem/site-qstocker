
import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import emailjs from 'emailjs-com';
import { distinctUntilChanged, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';


interface Conversation {
  id: string;
  participants: {
    [key: string]: string;
  };
  createdAt: string;
  lastMessage?: string;
  lastMessageTime?: string;
}

interface Message {
  id?: string;
  senderEmail: string;
  content: string;
  timestamp: string | number;
  isEmailReply?: boolean;
  read?: boolean;
}
@Injectable({ providedIn: 'root' })
export class MessagingService {
  associateRecipient(key: string, userId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  private readonly EMAILJS_SERVICE_ID = 'service_0rrjpf9';
  private readonly EMAILJS_TEMPLATE_ID = 'template_af3qbub';
  private readonly EMAILJS_USER_ID = 'MenLOkOOO3JnDBx4Y';

  constructor(
    private db: AngularFireDatabase,
    private afAuth: AngularFireAuth
  ) {
    emailjs.init(this.EMAILJS_USER_ID);
  }

  async sendMessage(conversationId: string, content: string): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user || !user.email) throw new Error('Utilisateur non connecté');

    const newMessage = {
      id: this.db.createPushId(),
      senderEmail: user.email,
      content: content,
      timestamp: new Date().toISOString(),
      read: false
    };

    await this.db.list(`conversations/${conversationId}/messages`).push(newMessage);
  }

  loadUserConversations(userId: string | null): Observable<Conversation[]> {
    if (!userId) {
      return of([]); // Retourne un Observable vide si userId est null
    }

    return this.db.list<string>(`userConversations/${userId}`).valueChanges().pipe(
      switchMap((conversationIds: string[]) => {
        if (!conversationIds || conversationIds.length === 0) {
          return of([]);
        }
        
        const conversationObservables = conversationIds.map(id => 
          this.db.object<Conversation>(`conversations/${id}`).valueChanges()
        );

        return forkJoin(conversationObservables) as Observable<Conversation[]>;
      })
    );
  }

  async createConversation(recipientEmail: string): Promise<string> {
    const user = await this.afAuth.currentUser;
    if (!user || !user.uid || !user.email) {
      throw new Error('Utilisateur non authentifié');
    }

    const conversationId = this.db.createPushId();
    
    await this.db.object(`conversations/${conversationId}`).set({
      id: conversationId,
      participants: {
        [user.uid]: user.email,
        external: recipientEmail
      },
      createdAt: new Date().toISOString()
    });

    await this.db.object(`userConversations/${user.uid}/${conversationId}`).set(true);
    return conversationId;
  }
  async sendEmailReply(conversationId: string, recipientEmail: string, message: string) {
    const user = await this.afAuth.currentUser;
    if (!user?.email) return;
  
    const templateParams = {
      to_email: recipientEmail,
      from_email: user.email,
      message: message,
      reply_to: user.email,
      conversation_id: conversationId
    };
  
    try {
      await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.EMAILJS_TEMPLATE_ID,
        templateParams
      );
      console.log('Email de réponse envoyé');
    } catch (error) {
      console.error('Erreur envoi email:', error);
    }
  }

  async sendRealEmail(conversationId: string, recipientEmail: string, message: string, senderEmail: string): Promise<void> {
    try {
      const templateParams = {
        to_email: recipientEmail,
        from_email: 'herssimeriem@gmail.com', // Email fixe du responsable
        reply_to: 'herssimeriem@gmail.com', // Pour les réponses
        message: message,
        conversation_id: conversationId
      };
  
      await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.EMAILJS_TEMPLATE_ID,
        templateParams
      );
      
      console.log('Email envoyé avec succès');
    } catch (error) {
      console.error('Erreur envoi email:', error);
      throw new Error('Échec de l\'envoi de l\'email');
    }
  }

  async sendMessageWithEmail(recipientEmail: string, message: string): Promise<string> {
    const user = await this.afAuth.currentUser;
    if (!user?.email) throw new Error('Utilisateur non connecté');
  
    const conversationId = this.db.createPushId();
    
    await this.db.object(`conversations/${conversationId}`).set({
      id: conversationId,
      participants: {
        [user.uid]: user.email,
        external: recipientEmail
      },
      createdAt: new Date().toISOString(),
      lastMessage: message,
      lastMessageTime: new Date().toISOString()
    });
  
    // Envoyer l'email avec l'adresse fixe du responsable
    await this.sendRealEmail(
      conversationId,
      recipientEmail,
      message,
      'herssimeriem@gmail.com' // Toujours utiliser cet email comme expéditeur
    );
  
    return conversationId;
  }

 async addMessageToConversation(conversationId: string, senderEmail: string, content: string): Promise<void> {
    if (!conversationId || !senderEmail || !content) {
      throw new Error('Paramètres manquants');
    }

    await this.db.list(`conversations/${conversationId}/messages`).push({
      senderEmail,
      content,
      timestamp: new Date().toISOString(),
      isEmailReply: false
    });

    // Mettre à jour le dernier message
    await this.db.object(`conversations/${conversationId}`).update({
      lastMessage: content,
      lastMessageTime: new Date().toISOString()
    });
  }


async simulateExternalReply(conversationId: string, content: string): Promise<void> {
  const conv = await this.db.object(`conversations/${conversationId}`).query.once('value');
  const recipientEmail = conv.val().participants.external;
  
  await this.db.list(`conversations/${conversationId}/messages`).push({
    senderEmail: recipientEmail,
    content,
    timestamp: Date.now(),
    isEmailReply: true
  });
}

  getConversation(conversationId: string) {
    return this.db.object(`conversations/${conversationId}`).valueChanges();
  }
  
  getMessages(conversationId: string): Observable<any[]> {
    return this.db.list(`conversations/${conversationId}/messages`, 
      ref => ref.orderByChild('timestamp')
    ).valueChanges().pipe(
      map(messages => {
        if (!messages) return [];
        return messages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
        }));
      })
    );
  }
  getConversationWithReplies(conversationId: string): Observable<any> {
    return this.db.list(`conversations/${conversationId}/messages`, ref =>
      ref.orderByChild('timestamp')
    ).valueChanges().pipe(
      map(messages => {
        // Marquer les réponses externes
        return messages.map((msg: any) => {
          return {
            ...msg,
            isExternalReply: msg.isEmailReply && !this.isCurrentUser(msg.senderEmail)
          };
        });
      })
    );
  }

  private async isCurrentUser(email: string): Promise<boolean> {
    const user = await this.afAuth.currentUser;
    return user?.email === email;
  }


  // Ajoutez cette méthode pour vérifier les réponses emails
async checkForEmailReplies(userId: string): Promise<void> {
  // Vérifie les conversations de l'utilisateur
  const conversations = await this.db.list(`userConversations/${userId}`)
    .query.once('value');
  
  if (!conversations.exists()) return;

  // Pour chaque conversation
  for (const convId in conversations.val()) {
    const convSnapshot = await this.db.object(`conversations/${convId}`)
      .query.once('value');
    const conv = convSnapshot.val();
    
    // Vérifie les messages marqués comme réponses email
    const messages = await this.db.list(`conversations/${convId}/messages`, 
      ref => ref.orderByChild('isEmailReply').equalTo(true)
    ).query.once('value');

    if (messages.exists()) {
      // Traite chaque message de réponse
      messages.forEach((msg: any) => {
        if (!msg.processed) {
          // Marque comme traité et affiche dans l'interface
          this.db.object(`conversations/${convId}/messages/${msg.key}/processed`)
            .set(true);
        }
      });
    }
  }
}
}
