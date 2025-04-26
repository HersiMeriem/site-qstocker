import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FacturationCommandesComponent } from './facturation-commandes.component';

describe('FacturationCommandesComponent', () => {
  let component: FacturationCommandesComponent;
  let fixture: ComponentFixture<FacturationCommandesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FacturationCommandesComponent]
    });
    fixture = TestBed.createComponent(FacturationCommandesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
