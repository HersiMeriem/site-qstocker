import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-settings-export-dialog',
  templateUrl: './settings-export-dialog.component.html',
  styleUrls: ['./settings-export-dialog.component.css']
})
export class SettingsExportDialogComponent {
  exportOptions = {
    includeBackupHistory: false,
    includeAuditLogs: false,
    format: 'json'
  };

  constructor(
    public dialogRef: MatDialogRef<SettingsExportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onExport(): void {
    this.dialogRef.close(this.exportOptions);
  }
}