import { TestBed } from '@angular/core/testing';

import { FinancialMockService } from './financial-mock.service';

describe('FinancialMockService', () => {
  let service: FinancialMockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FinancialMockService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
