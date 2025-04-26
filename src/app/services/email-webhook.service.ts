// email-webhook.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EmailNotificationService } from './mail-notification.service';

@Injectable({ providedIn: 'root' })
export class EmailWebhookService {
  constructor(
    private http: HttpClient,
    private emailService: EmailNotificationService
  ) {}

  async setupEmailWebhook(): Promise<void> {
    // Configuration initiale du webhook avec votre fournisseur d'email
    // Cela dépend de votre service d'email (SendGrid, Mailgun, etc.)
  }

  async handleIncomingEmail(payload: any): Promise<void> {
    await this.emailService.processIncomingEmail(payload);
  }
}