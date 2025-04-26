import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-prompt-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      <mat-radio-group [(ngModel)]="selectedOption" class="options-list">
        <mat-radio-button *ngFor="let option of data.options" [value]="option">
          {{ option }}
        </mat-radio-button>
      </mat-radio-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="null">Annuler</button>
      <button mat-raised-button color="primary" 
              [mat-dialog-close]="selectedOption" 
              [disabled]="!selectedOption">
        Valider
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .options-list {
      display: flex;
      flex-direction: column;
      margin-top: 16px;
    }
    mat-radio-button {
      margin: 8px 0;
    }
    mat-dialog-actions {
      padding: 16px 24px;
    }
    mat-dialog-content { 
      padding: 16px 24px; 
      margin: 0;
    }
    .mat-dialog-title { 
      margin: 0; 
      padding: 16px 24px;
      border-bottom: 1px solid #eee;
      font-size: 1.25rem;
      font-weight: 500;
    }
  `]
})
export class PromptDialogComponent {
  selectedOption: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<PromptDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      title: string;
      message: string;
      options: string[];
    }
  ) {}
}