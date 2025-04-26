import { TestBed } from '@angular/core/testing';

import { DataIntegrityService } from './data-integrity.service';

describe('DataIntegrityService', () => {
  let service: DataIntegrityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataIntegrityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
