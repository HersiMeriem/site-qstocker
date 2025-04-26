import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-confirmation-dialog',
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <h2>{{data.title || 'Confirmation'}}</h2>
      </div>
      
      <div class="dialog-content">
        <p>{{data.message}}</p>
      </div>

      <div class="dialog-actions">
        <button class="cancel-btn" (click)="onCancel()">
          {{data.cancelText || 'Non'}}
        </button>
        <button class="confirm-btn" (click)="onConfirm()">
          {{data.confirmText || 'Oui'}}
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./confirmation-dialog.component.css']
})
export class ConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      title?: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
    }
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}