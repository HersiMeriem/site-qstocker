import { TestBed } from '@angular/core/testing';

import { IncomingEmailService } from './incoming-email.service';

describe('IncomingEmailService', () => {
  let service: IncomingEmailService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IncomingEmailService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
