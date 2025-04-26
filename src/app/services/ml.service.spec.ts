import { TestBed } from '@angular/core/testing';

import { MlService } from './ml.service';

describe('MlService', () => {
  let service: MlService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MlService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
