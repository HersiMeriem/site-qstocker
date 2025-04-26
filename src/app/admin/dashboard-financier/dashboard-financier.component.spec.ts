import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardFinancierComponent } from './dashboard-financier.component';

describe('DashboardFinancierComponent', () => {
  let component: DashboardFinancierComponent;
  let fixture: ComponentFixture<DashboardFinancierComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DashboardFinancierComponent]
    });
    fixture = TestBed.createComponent(DashboardFinancierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
