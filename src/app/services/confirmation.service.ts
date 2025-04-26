import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ConfirmationDialogComponent } from '../admin/confirmation-dialog/confirmation-dialog.component';
import { PromptDialogComponent } from '../admin/prompt-dialog/prompt-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {
  constructor(private dialog: MatDialog) {}

  confirm(params: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  }): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: params.title,
        message: params.message,
        confirmText: params.confirmText || 'Confirmer',
        cancelText: params.cancelText || 'Annuler'
      }
    });
    return dialogRef.afterClosed();
  }

  prompt(title: string, message: string, options: string[]): Observable<string | null> {
    const dialogRef = this.dialog.open(PromptDialogComponent, {
      width: '400px',
      data: { title, message, options }
    });
    return dialogRef.afterClosed();
  }

  confirmSimple(message: string): Observable<boolean> {
    return this.confirm({
      title: 'Confirmation',
      message,
      confirmText: 'Oui',
      cancelText: 'Non'
    });
  }
}