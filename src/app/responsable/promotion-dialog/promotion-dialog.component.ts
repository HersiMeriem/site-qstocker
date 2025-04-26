// promotion-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-promotion-dialog',
  templateUrl: './promotion-dialog.component.html',
  styleUrls: ['./promotion-dialog.component.css']
})
export class PromotionDialogComponent {
  promoForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<PromotionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.promoForm = this.fb.group({
      discount: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
      startDate: [new Date(), Validators.required],
      endDate: [this.getDefaultEndDate(), Validators.required],
      postPromoStatus: ['active', Validators.required]
    });
  }

  private getDefaultEndDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  }

  savePromotion(): void {
    if (this.promoForm.valid) {
      this.dialogRef.close(this.promoForm.value);
    }
  }
}