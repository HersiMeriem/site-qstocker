import { Component } from '@angular/core';
import { MessagingService } from '../services/messaging.service';

@Component({
  selector: 'app-email-messaging',
  template: `
    <div class="email-container">
      <h2>Envoyer un message</h2>
      
      <div class="form-group">
        <label>Email du destinataire:</label>
        <input [(ngModel)]="recipientEmail" type="email" class="form-control">
      </div>
      
      <div class="form-group">
        <label>Votre message:</label>
        <textarea [(ngModel)]="messageContent" class="form-control" rows="3"></textarea>
      </div>
      
      <button (click)="sendMessage()" class="btn btn-primary">
        Envoyer le message
      </button>
      
      <div *ngIf="successMessage" class="alert alert-success">
        {{ successMessage }}
      </div>
      
      <div *ngIf="errorMessage" class="alert alert-danger">
        {{ errorMessage }}
      </div>
    </div>
  `,
  styleUrls: ['./email-messaging.component.css']
})
export class EmailMessagingComponent {
  recipientEmail = '';
  messageContent = '';
  successMessage = '';
  errorMessage = '';

  constructor(private messagingService: MessagingService) {}

  async sendMessage() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.recipientEmail || !this.messageContent) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    try {
      await this.messagingService.sendMessageWithEmail(
        this.recipientEmail, 
        this.messageContent
      );
      
      this.successMessage = `Message envoyé à ${this.recipientEmail} (simulation)`;
      this.messageContent = '';
      
      setTimeout(() => this.successMessage = '', 3000);
    } catch (error) {
      console.error('Erreur:', error);
      this.errorMessage = 'Erreur lors de l\'envoi du message';
    }
  }
}


