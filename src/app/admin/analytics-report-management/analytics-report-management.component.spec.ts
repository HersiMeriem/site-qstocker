import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalyticsReportManagementComponent } from './analytics-report-management.component';

describe('AnalyticsReportManagementComponent', () => {
  let component: AnalyticsReportManagementComponent;
  let fixture: ComponentFixture<AnalyticsReportManagementComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AnalyticsReportManagementComponent]
    });
    fixture = TestBed.createComponent(AnalyticsReportManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
