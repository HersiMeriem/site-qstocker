import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailsProductsComponent } from './details-products.component';

describe('DetailsProductsComponent', () => {
  let component: DetailsProductsComponent;
  let fixture: ComponentFixture<DetailsProductsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DetailsProductsComponent]
    });
    fixture = TestBed.createComponent(DetailsProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
