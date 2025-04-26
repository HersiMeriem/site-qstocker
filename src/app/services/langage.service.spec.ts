import { TestBed } from '@angular/core/testing';

import { LangageService } from './langage.service';

describe('LangageService', () => {
  let service: LangageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LangageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
