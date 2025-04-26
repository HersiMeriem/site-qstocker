import { Component } from '@angular/core';

@Component({
  selector: 'app-confirmation-dialog',
  template: `
    <div class="dialog-container" *ngIf="visible">
      <div class="dialog-overlay" (click)="close(false)"></div>
      <div class="dialog-box">
        <h2 class="dialog-title">{{ data.title }}</h2>
        <div class="dialog-content">
          {{ data.message }}
        </div>
        <div class="dialog-actions">
          <button 
            type="button" 
            class="cancel-btn"
            (click)="close(false)">
            {{ data.cancelText || 'Annuler' }}
          </button>
          <button 
            type="button" 
            class="confirm-btn"
            (click)="close(true)">
            {{ data.confirmText || 'Confirmer' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
    }
    
    .dialog-overlay {
      position: absolute;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
    }
    
    .dialog-box {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 4px;
      min-width: 300px;
      max-width: 80%;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    
    .dialog-title {
      margin-top: 0;
      color: #333;
    }
    
    .dialog-content {
      margin: 15px 0;
    }
    
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    
    .cancel-btn {
      padding: 8px 16px;
      background: #f0f0f0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .confirm-btn {
      padding: 8px 16px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  `]
})
export class ConfirmationDialogComponent {
  visible = false;
  data: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  } = {
    title: '',
    message: ''
  };

  private resolveFn: ((value: boolean) => void) | null = null;

  open(data: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  }): Promise<boolean> {
    this.data = data;
    this.visible = true;
    
    return new Promise(resolve => {
      this.resolveFn = resolve;
    });
  }

  close(result: boolean): void {
    this.visible = false;
    if (this.resolveFn) {
      this.resolveFn(result);
      this.resolveFn = null;
    }
  }
}