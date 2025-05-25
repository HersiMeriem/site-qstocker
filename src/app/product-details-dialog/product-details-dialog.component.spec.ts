import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductDetailsDialogComponent } from './product-details-dialog.component';

describe('ProductDetailsDialogComponent', () => {
  let component: ProductDetailsDialogComponent;
  let fixture: ComponentFixture<ProductDetailsDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProductDetailsDialogComponent]
    });
    fixture = TestBed.createComponent(ProductDetailsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
