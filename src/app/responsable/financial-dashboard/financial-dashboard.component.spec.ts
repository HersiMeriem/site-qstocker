import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinancialDashboardComponent } from './financial-dashboard.component';

describe('FinancialDashboardComponent', () => {
  let component: FinancialDashboardComponent;
  let fixture: ComponentFixture<FinancialDashboardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FinancialDashboardComponent]
    });
    fixture = TestBed.createComponent(FinancialDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
