import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResponsableDashboardComponent } from './responsable-dashboard.component';

describe('ResponsableDashboardComponent', () => {
  let component: ResponsableDashboardComponent;
  let fixture: ComponentFixture<ResponsableDashboardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ResponsableDashboardComponent]
    });
    fixture = TestBed.createComponent(ResponsableDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
