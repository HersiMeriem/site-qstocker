import { TestBed } from '@angular/core/testing';

import { StockManagerProfileService } from './stock-manager-profile.service';

describe('StockManagerProfileService', () => {
  let service: StockManagerProfileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StockManagerProfileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
