import { TestBed } from '@angular/core/testing';

import { StockManagerConfirmationService } from './stock-manager-confirmation.service';

describe('StockManagerConfirmationService', () => {
  let service: StockManagerConfirmationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StockManagerConfirmationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
