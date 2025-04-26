import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailMessagingComponent } from './email-messaging.component';

describe('EmailMessagingComponent', () => {
  let component: EmailMessagingComponent;
  let fixture: ComponentFixture<EmailMessagingComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EmailMessagingComponent]
    });
    fixture = TestBed.createComponent(EmailMessagingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
