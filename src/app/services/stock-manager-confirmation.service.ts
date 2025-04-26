// stock-manager-confirmation.service.ts
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ConfirmationDialogComponent } from '../components/confirmation-dialog/confirmation-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class StockManagerConfirmationService {
  
  constructor(private dialog: MatDialog) { }

  confirm(
    title: string,
    message: string,
    confirmText: string = 'Confirmer',
    cancelText: string = 'Annuler'
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title,
        message,
        confirmText,
        cancelText
      }
    });

    return dialogRef.afterClosed();
  }

  confirmDangerousAction(actionDescription: string): Observable<boolean> {
    return this.confirm(
      'Action dangereuse',
      `Vous êtes sur le point d'effectuer l'action suivante : ${actionDescription}. Cette action est irréversible. Souhaitez-vous continuer ?`,
      'Je confirme',
      'Annuler'
    );
  }

  confirmWithCustomOptions(options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    showDanger?: boolean;
  }): Observable<boolean> {
    return this.confirm(
      options.title,
      options.message,
      options.confirmText,
      options.cancelText
    );
  }
}

