import { TestBed } from '@angular/core/testing';

import { EmailWebhookService } from './email-webhook.service';

describe('EmailWebhookService', () => {
  let service: EmailWebhookService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EmailWebhookService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
