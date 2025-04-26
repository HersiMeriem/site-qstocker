import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VentesComponent } from './ventes.component';

describe('VentesComponent', () => {
  let component: VentesComponent;
  let fixture: ComponentFixture<VentesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [VentesComponent]
    });
    fixture = TestBed.createComponent(VentesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
