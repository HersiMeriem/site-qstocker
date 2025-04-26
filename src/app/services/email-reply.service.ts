import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import * as emailjs from 'emailjs-com';

@Injectable({ providedIn: 'root' })
export class EmailReplyService {
  constructor(private db: AngularFireDatabase) {
    emailjs.init('MenLOkOOO3JnDBx4Y'); // Votre user ID EmailJS
  }

  async processIncomingEmail(from: string, to: string, content: string): Promise<void> {
    // Trouver la conversation correspondante
    const convSnapshot = await this.db.list('conversations', 
      ref => ref.orderByChild('participants/external').equalTo(from)
    ).query.once('value');

    if (!convSnapshot.exists()) return;

    let conversationId: string | null = null;
    convSnapshot.forEach((conv: any) => {
      conversationId = conv.key;
      return true; // Pour sortir après le premier résultat
    });

    if (!conversationId) return;

    // Ajouter le message à la conversation
    await this.db.list(`conversations/${conversationId}/messages`).push({
      senderEmail: from,
      content: content,
      timestamp: new Date().toISOString(),
      isEmailReply: true,
      processed: false
    });

    // Mettre à jour le dernier message
    await this.db.object(`conversations/${conversationId}`).update({
      lastMessage: content,
      lastMessageTime: new Date().toISOString()
    });
  }
}