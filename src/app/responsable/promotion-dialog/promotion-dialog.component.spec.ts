import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PromotionDialogComponent } from './promotion-dialog.component';

describe('PromotionDialogComponent', () => {
  let component: PromotionDialogComponent;
  let fixture: ComponentFixture<PromotionDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PromotionDialogComponent]
    });
    fixture = TestBed.createComponent(PromotionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
