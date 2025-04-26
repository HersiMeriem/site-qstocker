import { Component } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';

@Component({
  selector: 'app-email-simulator',
  template: `
    <div class="simulator-container">
      <h3>Simulateur de Réponse Email</h3>
      
      <div class="form-group">
        <label>ID de Conversation:</label>
        <input [(ngModel)]="conversationId" class="form-control">
      </div>
      
      <div class="form-group">
        <label>Réponse du destinataire:</label>
        <textarea [(ngModel)]="replyContent" class="form-control" rows="3"></textarea>
      </div>
      
      <button (click)="sendReply()" class="btn btn-secondary">
        Simuler la réponse
      </button>
    </div>
  `,
  styleUrls: ['./email-simulator.component.css']
})
export class EmailSimulatorComponent {
  conversationId = '';
  replyContent = '';

  constructor(private db: AngularFireDatabase) {}

  async sendReply() {
    if (!this.conversationId || !this.replyContent) return;

    // Ajouter la réponse à la conversation
    await this.db.list(`conversations/${this.conversationId}/messages`).push({
      senderEmail: this.conversationId.includes('@') ? this.conversationId : 'external@example.com',
      content: this.replyContent,
      timestamp: new Date().toISOString(),
      isEmailReply: true
    });

    // Mettre à jour le dernier message
    await this.db.object(`conversations/${this.conversationId}`).update({
      lastMessage: this.replyContent,
      lastMessageTime: new Date().toISOString()
    });

    this.replyContent = '';
    alert('Réponse simulée ajoutée avec succès!');
  }
}