import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailSimulatorComponent } from './email-simulator.component';

describe('EmailSimulatorComponent', () => {
  let component: EmailSimulatorComponent;
  let fixture: ComponentFixture<EmailSimulatorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EmailSimulatorComponent]
    });
    fixture = TestBed.createComponent(EmailSimulatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
