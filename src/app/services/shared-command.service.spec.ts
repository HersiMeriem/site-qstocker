import { TestBed } from '@angular/core/testing';

import { SharedCommandService } from './shared-command.service';

describe('SharedCommandService', () => {
  let service: SharedCommandService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SharedCommandService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
