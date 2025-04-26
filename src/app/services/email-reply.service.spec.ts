import { TestBed } from '@angular/core/testing';

import { EmailReplyService } from './email-reply.service';

describe('EmailReplyService', () => {
  let service: EmailReplyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EmailReplyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
