import { TestBed } from '@angular/core/testing';

import { MailNotificationService } from './mail-notification.service';

describe('MailNotificationService', () => {
  let service: MailNotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MailNotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
