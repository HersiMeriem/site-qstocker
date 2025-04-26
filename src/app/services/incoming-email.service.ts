// incoming-email.service.ts
import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Injectable({ providedIn: 'root' })
export class IncomingEmailService {
  constructor(
    private db: AngularFireDatabase,
    private afAuth: AngularFireAuth
  ) {}

  async processIncomingEmail(email: any): Promise<void> {
    // Extraire l'ID de conversation de l'adresse email de réponse
    const match = email.to.match(/reply-(.*?)@/);
    if (!match) return;

    const conversationId = match[1];
    const user = await this.afAuth.currentUser;
    if (!user) return;

    // Vérifier si la conversation existe
    const convRef = this.db.object(`conversations/${conversationId}`);
    const conv = await convRef.query.once('value');
    if (!conv.exists()) return;

    // Ajouter le message à la conversation
    const newMessage = {
      senderEmail: email.from,
      content: email.text,
      timestamp: new Date().toISOString(),
      isEmailReply: true
    };

    await this.db.list(`conversations/${conversationId}/messages`).push(newMessage);

    // Mettre à jour la dernière activité de la conversation
    await convRef.update({
      lastMessage: newMessage.content,
      lastMessageTime: newMessage.timestamp
    });
  }
}