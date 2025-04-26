import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { EmailService } from './email.service';
import { map, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SharedCommandService {
  private commandsSource = new BehaviorSubject<any[]>([]);
  currentCommands = this.commandsSource.asObservable();

  constructor(private emailService: EmailService) {}

  async refreshCommands(): Promise<void> {
    try {
      const commands = await this.emailService.getCommandes().pipe(
        map(commands => commands || []), // Garantit qu'on a toujours un tableau
        take(1) // Prend seulement la première valeur et complète l'observable
      ).toPromise() || []; // Fallback vers tableau vide si undefined
      
      const normalized = commands.map(c => this.normalizeCommand(c));
      this.commandsSource.next(normalized);
    } catch (error) {
      console.error('Error refreshing commands:', error);
      this.commandsSource.next([]);
    }
  }

  private normalizeCommand(c: any): any {
    return {
      ...c,
      paymentStatus: this.calculatePaymentStatus(c),
      dueDate: c.dueDate || this.calculateDueDate(c.dateCommande),
      totalTTC: (c.totalHT || 0) * 1.19
    };
  }

  private calculatePaymentStatus(c: any): string {
    if (c.paymentStatus === 'Payé') return 'Payé';
    if (c.paymentStatus === 'En retiens') return 'En attente';
    if (!c.dueDate) return 'En attente';
    
    const today = new Date();
    const dueDate = new Date(c.dueDate);
    return today > dueDate ? 'En retard' : 'En attente';
  }

  private calculateDueDate(date: string): string {
    const d = new Date(date);
    d.setDate(d.getDate() + 30);
    return d.toISOString();
  }
}