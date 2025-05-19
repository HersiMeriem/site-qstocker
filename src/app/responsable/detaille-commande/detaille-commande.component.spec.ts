import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailleCommandeComponent } from './detaille-commande.component';

describe('DetailleCommandeComponent', () => {
  let component: DetailleCommandeComponent;
  let fixture: ComponentFixture<DetailleCommandeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DetailleCommandeComponent]
    });
    fixture = TestBed.createComponent(DetailleCommandeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
