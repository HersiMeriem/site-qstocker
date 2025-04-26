import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface EmailOptions {
  conversationId: string;
  messageId: string | null;
  sender: string;
}

@Injectable({ providedIn: 'root' })
export class EmailNotificationService {
  private readonly apiUrl = environment.apiUrl + '/email';
  processIncomingEmail: any;

  constructor(private http: HttpClient) {}

  async sendNotificationEmail(
    to: string,
    subject: string,
    text: string,
    options: EmailOptions
  ): Promise<any> {
    const emailData = {
      to,
      subject,
      text,
      html: this.generateEmailHtml(text, options),
      metadata: options
    };

    return this.http.post(this.apiUrl, emailData).toPromise();
  }

  private generateEmailHtml(content: string, options: EmailOptions): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c7be5;">Nouveau message</h2>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
          ${content.replace(/\n/g, '<br>')}
        </div>
        <p style="margin-top: 20px;">
          <a href="${window.location.origin}/profile?tab=messages&conversation=${options.conversationId}"
             style="background: #2c7be5; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
            Répondre dans l'application
          </a>
        </p>
      </div>
    `;
  }
}